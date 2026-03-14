import asyncio
import json
from database import SessionLocal, ScanSession, File, init_db
import onedrive
import detector

# Tracks the single active background scan task
_active_task: asyncio.Task | None = None
_active_session_id: int | None = None


def get_active_session_id() -> int | None:
    return _active_session_id


async def start_scan(folder_ids: list[str], folder_names: list[str], skip_hash_check: bool) -> int:
    """Create a session record and launch the scan as a background task."""
    global _active_task, _active_session_id

    # Cancel any existing scan first
    if _active_task and not _active_task.done():
        _active_task.cancel()
        try:
            await _active_task
        except asyncio.CancelledError:
            pass

    init_db()
    db = SessionLocal()
    try:
        session = ScanSession(
            folders_scanned=json.dumps(
                [{"id": fid, "name": name} for fid, name in zip(folder_ids, folder_names)]
            ),
            status="scanning",
            skip_hash_check=skip_hash_check,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    finally:
        db.close()

    _active_session_id = session_id
    _active_task = asyncio.create_task(_run_scan(session_id, folder_ids, folder_names, skip_hash_check))
    return session_id


async def cancel_scan() -> None:
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()
        try:
            await _active_task
        except asyncio.CancelledError:
            pass
    _active_task = None


async def _run_scan(session_id: int, folder_ids: list[str], folder_names: list[str], skip_hash_check: bool) -> None:
    db = SessionLocal()
    try:
        for folder_id, folder_name in zip(folder_ids, folder_names):
            await _index_folder(db, session_id, folder_id, folder_name)

        # Sync final file count before detection
        count = db.query(File).filter(File.session_id == session_id).count()
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        session.total_files = count
        session.status = "detecting"
        db.commit()

        # Run duplicate detection in a thread (synchronous DB work)
        await asyncio.to_thread(detector.detect_duplicates, session_id, skip_hash_check)

        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        session.status = "complete"
        db.commit()

    except asyncio.CancelledError:
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if session:
            session.status = "cancelled"
            db.commit()
        raise

    except Exception:
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if session:
            session.status = "error"
            db.commit()
        raise

    finally:
        db.close()


_MEDIA_MIME_PREFIXES = ("image/", "video/")
_MEDIA_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".raw",
    ".cr2", ".nef", ".arw", ".dng", ".tiff", ".tif", ".bmp", ".webp",
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".m4v", ".3gp", ".mts", ".m2ts",
}


def _is_media(mime: str, name: str) -> bool:
    if mime and any(mime.startswith(p) for p in _MEDIA_MIME_PREFIXES):
        return True
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1].lower()
        return ext in _MEDIA_EXTENSIONS
    return False


async def _index_folder(db, session_id: int, folder_id: str, path_prefix: str) -> None:
    items = await onedrive.list_folder_items(folder_id)
    files_to_add = []
    subfolders = []

    for item in items:
        if "folder" in item:
            child_path = f"{path_prefix}/{item['name']}" if path_prefix else item["name"]
            subfolders.append((item["id"], child_path))
        elif "file" in item:
            mime = item.get("file", {}).get("mimeType", "") or ""
            name = item.get("name", "")
            if not _is_media(mime, name):
                continue
            path = f"{path_prefix}/{name}" if path_prefix else name
            files_to_add.append(
                File(
                    session_id=session_id,
                    onedrive_id=item["id"],
                    name=name,
                    path=path,
                    size=item.get("size", 0),
                    hash=item.get("file", {}).get("hashes", {}).get("quickXorHash"),
                    modified_at=item.get("fileSystemInfo", {}).get("lastModifiedDateTime"),
                    mime_type=mime or None,
                )
            )

    if files_to_add:
        db.add_all(files_to_add)
        db.commit()
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if session:
            session.total_files = db.query(File).filter(File.session_id == session_id).count()
            db.commit()

    for subfolder_id, subfolder_path in subfolders:
        await _index_folder(db, session_id, subfolder_id, subfolder_path)
