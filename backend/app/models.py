from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class Session(Base):
    __tablename__ = 'sessions'
    
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    project_path = Column(String)
    codex_log_path = Column(String, nullable=True)
    session_name = Column(String, nullable=True)
    status = Column(String, default="recording") # recording, stopped
    
    events = relationship("FileEvent", back_populates="session", cascade="all, delete-orphan")
    file_churns = relationship("FileChurn", back_populates="session", cascade="all, delete-orphan")

class FileEvent(Base):
    __tablename__ = 'file_events'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey('sessions.id'))
    time = Column(DateTime, default=datetime.datetime.utcnow)
    type = Column(String) # file_modified, file_deleted, file_created, file_recreated
    path = Column(String)
    lines_before = Column(Integer, default=0)
    lines_after = Column(Integer, default=0)
    delta_added = Column(Integer, default=0)
    delta_deleted = Column(Integer, default=0)
    change_kind = Column(String, nullable=True) # e.g. large_write
    
    session = relationship("Session", back_populates="events")

class FileChurn(Base):
    __tablename__ = 'file_churns'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey('sessions.id'))
    path = Column(String)
    created = Column(Boolean, default=False)
    deleted = Column(Boolean, default=False)
    recreated_count = Column(Integer, default=0)
    modify_count = Column(Integer, default=0)
    rewrite_count = Column(Integer, default=0)
    total_lines_written = Column(Integer, default=0)
    total_lines_deleted = Column(Integer, default=0)
    current_lines = Column(Integer, default=0)
    final_git_added = Column(Integer, default=0)
    final_git_deleted = Column(Integer, default=0)
    write_amplification = Column(Float, default=0.0)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    
    session = relationship("Session", back_populates="file_churns")

class PromptNote(Base):
    __tablename__ = 'prompt_notes'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey('sessions.id'))
    time = Column(DateTime, default=datetime.datetime.utcnow)
    text = Column(Text)

class Review(Base):
    __tablename__ = 'reviews'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey('sessions.id'), unique=True)
    quality_score = Column(Integer, nullable=True)
    followed_instruction = Column(Boolean, nullable=True)
    code_worked = Column(Boolean, nullable=True)
    seemed_confused = Column(Boolean, nullable=True)
    overused_tools = Column(Boolean, nullable=True)
    notes = Column(Text, nullable=True)
