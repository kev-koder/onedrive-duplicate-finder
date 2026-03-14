import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DATABASE_URL = f"sqlite:///{os.path.join(_DATA_DIR, 'media_manager.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ScanSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    folders_scanned = Column(Text)       # JSON: [{"id": "...", "name": "..."}]
    status = Column(String, default="scanning")  # scanning | detecting | complete | cancelled | error
    total_files = Column(Integer, default=0)
    total_groups = Column(Integer, default=0)
    skip_hash_check = Column(Boolean, default=False)
    files = relationship("File", back_populates="session", cascade="all, delete-orphan")
    groups = relationship("DuplicateGroup", back_populates="session", cascade="all, delete-orphan")


class File(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    onedrive_id = Column(String)
    name = Column(String)
    path = Column(String)
    size = Column(BigInteger, default=0)
    hash = Column(String, nullable=True)
    is_cloud_only = Column(Boolean, default=False)
    modified_at = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    session = relationship("ScanSession", back_populates="files")
    group_files = relationship("GroupFile", back_populates="file", cascade="all, delete-orphan")


class DuplicateGroup(Base):
    __tablename__ = "duplicate_groups"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    match_type = Column(String)   # content_hash | cross_name | name_size
    status = Column(String, default="open")  # open | resolved | skipped
    session = relationship("ScanSession", back_populates="groups")
    group_files = relationship("GroupFile", back_populates="group", cascade="all, delete-orphan")


class GroupFile(Base):
    __tablename__ = "group_files"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("duplicate_groups.id"))
    file_id = Column(Integer, ForeignKey("files.id"))
    decision = Column(String, default="pending")  # pending | keep | delete | skip
    group = relationship("DuplicateGroup", back_populates="group_files")
    file = relationship("File", back_populates="group_files")


def init_db():
    os.makedirs(_DATA_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)
