import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

SESSIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sessions")

def get_engine_for_session(session_id: str):
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    db_path = os.path.join(session_dir, "session.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return engine

def get_session_local(session_id: str):
    engine = get_engine_for_session(session_id)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()
