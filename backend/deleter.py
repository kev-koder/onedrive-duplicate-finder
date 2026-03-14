import asyncio
import httpx
from auth import get_access_token
from database import SessionLocal, File, GroupFile, DuplicateGroup

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

_delete_task: asyncio.Task | None = None
_progress: dict = {
    "status": "idle",
    "total": 0,
    "succeeded": 0,
    "failed": 0,
    "failures": [],
}


def get_progress() -> dict:
    return dict(_progress)


async def start_deletion(session_id: int) -> None:
    global _delete_task, _progress

    db = SessionLocal()
    try:
        rows = (
            db.query(File.id, File.onedrive_id, File.name)
            .join(GroupFile, GroupFile.file_id == File.id)
            .join(DuplicateGroup, DuplicateGroup.id == GroupFile.group_id)
            .filter(
                DuplicateGroup.session_id == session_id,
                GroupFile.decision == "delete",
            )
            .all()
        )
        files = [(r.id, r.onedrive_id, r.name) for r in rows]
    finally:
        db.close()

    _progress = {
        "status": "deleting",
        "total": len(files),
        "succeeded": 0,
        "failed": 0,
        "failures": [],
    }

    _delete_task = asyncio.create_task(_run(session_id, files))


async def _run(session_id: int, files: list[tuple]) -> None:
    global _progress

    async with httpx.AsyncClient() as client:
        for file_id, onedrive_id, name in files:
            try:
                headers = {"Authorization": f"Bearer {get_access_token()}"}
                r = await client.delete(
                    f"{GRAPH_BASE}/me/drive/items/{onedrive_id}",
                    headers=headers,
                )
                r.raise_for_status()
                _progress["succeeded"] += 1

                # Mark as deleted in DB so it won't be re-processed
                db = SessionLocal()
                try:
                    gf = (
                        db.query(GroupFile)
                        .join(DuplicateGroup, DuplicateGroup.id == GroupFile.group_id)
                        .filter(
                            GroupFile.file_id == file_id,
                            DuplicateGroup.session_id == session_id,
                        )
                        .first()
                    )
                    if gf:
                        gf.decision = "deleted"
                        db.commit()
                finally:
                    db.close()

            except Exception as e:
                _progress["failed"] += 1
                _progress["failures"].append({"name": name, "error": str(e)})

    _progress["status"] = "complete"
