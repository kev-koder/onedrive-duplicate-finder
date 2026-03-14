from sqlalchemy import func
from database import SessionLocal, File, DuplicateGroup, GroupFile, ScanSession


def detect_duplicates(session_id: int, skip_hash_check: bool) -> None:
    """
    Find duplicate files within a scan session and record them as groups.

    Pass 1 (unless skip_hash_check): group by quickXorHash — definitive duplicates.
      - Same hash, same name  → match_type "content_hash"
      - Same hash, diff names → match_type "cross_name"

    Pass 2: group by name+size for any files not already placed in a hash group.
      - Catches files OneDrive didn't return a hash for.
      - match_type "name_size"
    """
    db = SessionLocal()
    try:
        grouped_file_ids: set[int] = set()

        if not skip_hash_check:
            hash_groups = (
                db.query(File.hash)
                .filter(
                    File.session_id == session_id,
                    File.hash.isnot(None),
                    File.hash != "",
                )
                .group_by(File.hash)
                .having(func.count(File.id) > 1)
                .all()
            )

            for (hash_val,) in hash_groups:
                files = (
                    db.query(File)
                    .filter(File.session_id == session_id, File.hash == hash_val)
                    .all()
                )
                names = {f.name for f in files}
                match_type = "cross_name" if len(names) > 1 else "content_hash"
                group = DuplicateGroup(session_id=session_id, match_type=match_type)
                db.add(group)
                db.flush()
                for f in files:
                    db.add(GroupFile(group_id=group.id, file_id=f.id))
                    grouped_file_ids.add(f.id)

            db.commit()

        # Pass 2: name+size for files not already in a hash group
        name_size_groups = (
            db.query(File.name, File.size)
            .filter(File.session_id == session_id)
            .group_by(File.name, File.size)
            .having(func.count(File.id) > 1)
            .all()
        )

        for name, size in name_size_groups:
            files = (
                db.query(File)
                .filter(
                    File.session_id == session_id,
                    File.name == name,
                    File.size == size,
                )
                .all()
            )
            ungrouped = [f for f in files if f.id not in grouped_file_ids]
            if len(ungrouped) < 2:
                continue
            group = DuplicateGroup(session_id=session_id, match_type="name_size")
            db.add(group)
            db.flush()
            for f in ungrouped:
                db.add(GroupFile(group_id=group.id, file_id=f.id))
                grouped_file_ids.add(f.id)

        db.commit()

        total_groups = (
            db.query(func.count(DuplicateGroup.id))
            .filter(DuplicateGroup.session_id == session_id)
            .scalar()
        )
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        session.total_groups = total_groups
        db.commit()

    finally:
        db.close()
