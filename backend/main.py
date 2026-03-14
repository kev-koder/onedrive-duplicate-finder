import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from auth import router as auth_router
import onedrive
from onedrive import get_me, get_drive_quota, list_root_folders
from database import SessionLocal, ScanSession, DuplicateGroup, GroupFile, File, init_db
import indexer
import deleter
import uvicorn

ENV_PATH = Path(__file__).parent / ".env"

app = FastAPI(title="OneDrive Duplicate Finder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Setup endpoints
# ---------------------------------------------------------------------------

@app.get("/setup/status")
def setup_status():
    client_id = ""
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line.startswith("AZURE_CLIENT_ID="):
                client_id = line.split("=", 1)[1].strip()
                break
    return {"configured": bool(client_id)}


class SetupRequest(BaseModel):
    client_id: str


@app.post("/setup/configure")
def setup_configure(req: SetupRequest):
    client_id = req.client_id.strip()
    if not client_id:
        raise HTTPException(status_code=400, detail="Client ID cannot be empty.")
    ENV_PATH.write_text(f"AZURE_CLIENT_ID={client_id}\n", encoding="utf-8")
    return {"saved": True}


@app.get("/me")
async def me():
    user = await get_me()
    quota = await get_drive_quota()

    def fmt(bytes_val):
        if bytes_val is None:
            return "Unknown"
        gb = bytes_val / (1024 ** 3)
        return f"{gb:.1f} GB"

    return {
        "display_name": user.get("displayName"),
        "email": user.get("userPrincipalName") or user.get("mail"),
        "quota": {
            "used": fmt(quota.get("used")),
            "total": fmt(quota.get("total")),
            "remaining": fmt(quota.get("remaining")),
        },
    }


@app.get("/folders")
async def folders():
    items = await list_root_folders()
    return {"folders": items}


@app.get("/folders/{folder_id}/children")
async def folder_children(folder_id: str):
    items = await onedrive.list_folder_items(folder_id)
    subfolders = [i for i in items if "folder" in i]
    return {"folders": subfolders}


# ---------------------------------------------------------------------------
# Scan endpoints
# ---------------------------------------------------------------------------

class ScanStartRequest(BaseModel):
    folder_ids: list[str]
    folder_names: list[str]
    skip_hash_check: bool = False


@app.post("/scan/start")
async def scan_start(req: ScanStartRequest):
    if not req.folder_ids:
        raise HTTPException(status_code=400, detail="Select at least one folder.")
    session_id = await indexer.start_scan(req.folder_ids, req.folder_names, req.skip_hash_check)
    return {"session_id": session_id}


@app.get("/scan/status")
def scan_status(session_id: int | None = None):
    sid = session_id or indexer.get_active_session_id()
    if sid is None:
        raise HTTPException(status_code=404, detail="No active scan.")
    db = SessionLocal()
    try:
        session = db.query(ScanSession).filter(ScanSession.id == sid).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {
            "session_id": session.id,
            "status": session.status,
            "total_files": session.total_files,
            "total_groups": session.total_groups,
        }
    finally:
        db.close()


@app.post("/scan/cancel")
async def scan_cancel():
    await indexer.cancel_scan()
    return {"cancelled": True}


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@app.get("/sessions")
def sessions_list():
    db = SessionLocal()
    try:
        rows = (
            db.query(ScanSession)
            .order_by(ScanSession.created_at.desc())
            .all()
        )
        return {
            "sessions": [
                {
                    "id": s.id,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "status": s.status,
                    "total_files": s.total_files,
                    "total_groups": s.total_groups,
                    "folders": json.loads(s.folders_scanned or "[]"),
                }
                for s in rows
            ]
        }
    finally:
        db.close()


@app.get("/sessions/{session_id}")
def session_detail(session_id: int):
    db = SessionLocal()
    try:
        s = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {
            "id": s.id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "status": s.status,
            "total_files": s.total_files,
            "total_groups": s.total_groups,
            "skip_hash_check": s.skip_hash_check,
            "folders": json.loads(s.folders_scanned or "[]"),
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Groups endpoints
# ---------------------------------------------------------------------------

def _fmt_size(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"


@app.get("/groups")
def groups_list(session_id: int, match_type: str | None = None, status: str | None = None):
    db = SessionLocal()
    try:
        q = db.query(DuplicateGroup).filter(DuplicateGroup.session_id == session_id)
        if match_type:
            q = q.filter(DuplicateGroup.match_type == match_type)
        if status:
            q = q.filter(DuplicateGroup.status == status)
        groups = q.order_by(DuplicateGroup.id).all()

        result = []
        for g in groups:
            files = [
                {
                    "id": gf.file.id,
                    "name": gf.file.name,
                    "path": gf.file.path,
                    "size": gf.file.size,
                    "size_display": _fmt_size(gf.file.size),
                    "mime_type": gf.file.mime_type,
                    "modified_at": gf.file.modified_at,
                    "decision": gf.decision,
                }
                for gf in g.group_files
            ]
            result.append({
                "id": g.id,
                "match_type": g.match_type,
                "status": g.status,
                "file_count": len(files),
                "total_size": _fmt_size(sum(gf.file.size for gf in g.group_files)),
                "files": files,
            })

        return {"session_id": session_id, "total_groups": len(result), "groups": result}
    finally:
        db.close()


@app.get("/groups/{group_id}")
def group_detail(group_id: int):
    db = SessionLocal()
    try:
        g = db.query(DuplicateGroup).filter(DuplicateGroup.id == group_id).first()
        if not g:
            raise HTTPException(status_code=404, detail="Group not found.")
        files = [
            {
                "id": gf.file.id,
                "name": gf.file.name,
                "path": gf.file.path,
                "size": gf.file.size,
                "size_display": _fmt_size(gf.file.size),
                "mime_type": gf.file.mime_type,
                "modified_at": gf.file.modified_at,
                "decision": gf.decision,
            }
            for gf in g.group_files
        ]
        return {
            "id": g.id,
            "session_id": g.session_id,
            "match_type": g.match_type,
            "status": g.status,
            "files": files,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

@app.get("/summary")
def summary(session_id: int):
    db = SessionLocal()
    try:
        rows = (
            db.query(File, GroupFile)
            .join(GroupFile, GroupFile.file_id == File.id)
            .join(DuplicateGroup, DuplicateGroup.id == GroupFile.group_id)
            .filter(
                DuplicateGroup.session_id == session_id,
                GroupFile.decision == "delete",
            )
            .all()
        )
        files = []
        total_bytes = 0
        for f, gf in rows:
            files.append({
                "id": f.id,
                "name": f.name,
                "path": f.path,
                "size": f.size,
                "size_display": _fmt_size(f.size),
                "mime_type": f.mime_type,
            })
            total_bytes += f.size or 0
        return {
            "session_id": session_id,
            "total_count": len(files),
            "total_size": _fmt_size(total_bytes),
            "total_bytes": total_bytes,
            "files": files,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Apply (deletion) endpoints
# ---------------------------------------------------------------------------

class ApplyRequest(BaseModel):
    session_id: int


@app.post("/apply")
async def apply(req: ApplyRequest):
    await deleter.start_deletion(req.session_id)
    return {"started": True}


@app.get("/apply/status")
def apply_status():
    return deleter.get_progress()


# ---------------------------------------------------------------------------
# Stream URL endpoint
# ---------------------------------------------------------------------------

@app.get("/files/{file_id}/stream-url")
async def file_stream_url(file_id: int):
    db = SessionLocal()
    try:
        f = db.query(File).filter(File.id == file_id).first()
        if not f:
            raise HTTPException(status_code=404, detail="File not found.")
        onedrive_id = f.onedrive_id
    finally:
        db.close()
    url = await onedrive.get_stream_url(onedrive_id)
    if not url:
        raise HTTPException(status_code=404, detail="Stream URL not available.")
    return {"url": url}


# ---------------------------------------------------------------------------
# Bulk decision endpoint
# ---------------------------------------------------------------------------

class BulkDecisionRequest(BaseModel):
    session_id: int
    keep_folder: str
    delete_folder: str


@app.post("/bulk-decision")
def bulk_decision(req: BulkDecisionRequest):
    if req.keep_folder == req.delete_folder:
        raise HTTPException(status_code=400, detail="Keep and delete folders must be different.")

    def file_folder(path: str) -> str:
        return path.rsplit("/", 1)[0] if "/" in path else ""

    db = SessionLocal()
    try:
        groups = (
            db.query(DuplicateGroup)
            .filter(
                DuplicateGroup.session_id == req.session_id,
                DuplicateGroup.status != "skipped",
            )
            .all()
        )

        groups_updated = 0
        for group in groups:
            keep_gfs = [gf for gf in group.group_files if file_folder(gf.file.path) == req.keep_folder]
            delete_gfs = [gf for gf in group.group_files if file_folder(gf.file.path) == req.delete_folder]

            if keep_gfs and delete_gfs:
                for gf in keep_gfs:
                    gf.decision = "keep"
                for gf in delete_gfs:
                    gf.decision = "delete"
                groups_updated += 1

        db.commit()
        return {"groups_updated": groups_updated}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Thumbnail endpoint
# ---------------------------------------------------------------------------

@app.get("/files/{file_id}/thumbnail")
async def file_thumbnail(file_id: int):
    db = SessionLocal()
    try:
        f = db.query(File).filter(File.id == file_id).first()
        if not f:
            raise HTTPException(status_code=404, detail="File not found.")
        onedrive_id = f.onedrive_id
    finally:
        db.close()
    url = await onedrive.get_thumbnail_url(onedrive_id)
    if not url:
        raise HTTPException(status_code=404, detail="No thumbnail available.")
    return RedirectResponse(url)


# ---------------------------------------------------------------------------
# Decision endpoints
# ---------------------------------------------------------------------------

class DecisionRequest(BaseModel):
    decision: str  # pending | keep | delete | skip


class GroupStatusRequest(BaseModel):
    status: str  # open | resolved | skipped


@app.patch("/groups/{group_id}/files/{file_id}")
def update_file_decision(group_id: int, file_id: int, req: DecisionRequest):
    if req.decision not in ("pending", "keep", "delete", "skip"):
        raise HTTPException(status_code=400, detail="Invalid decision value.")
    db = SessionLocal()
    try:
        gf = db.query(GroupFile).filter(
            GroupFile.group_id == group_id,
            GroupFile.file_id == file_id,
        ).first()
        if not gf:
            raise HTTPException(status_code=404, detail="Group file not found.")
        gf.decision = req.decision
        db.commit()
        return {"group_id": group_id, "file_id": file_id, "decision": req.decision}
    finally:
        db.close()


@app.patch("/groups/{group_id}")
def update_group_status(group_id: int, req: GroupStatusRequest):
    if req.status not in ("open", "resolved", "skipped"):
        raise HTTPException(status_code=400, detail="Invalid status value.")
    db = SessionLocal()
    try:
        g = db.query(DuplicateGroup).filter(DuplicateGroup.id == group_id).first()
        if not g:
            raise HTTPException(status_code=404, detail="Group not found.")
        g.status = req.status
        db.commit()
        return {"group_id": group_id, "status": req.status}
    finally:
        db.close()


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
