import datetime
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys

sys.path.append(os.path.dirname(__file__))
from app.models import Base, Session, FileEvent, FileChurn, PromptNote, Review
from app.db import SESSIONS_DIR, get_engine_for_session

def seed_session(s_id, is_messy):
    engine = get_engine_for_session(s_id)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Check if exists
    if db.query(Session).filter(Session.id == s_id).first():
        db.close()
        return

    now = datetime.datetime.utcnow()
    
    if is_messy:
        s = Session(
            id=s_id,
            created_at=now - datetime.timedelta(hours=1),
            end_time=now - datetime.timedelta(minutes=45),
            duration_seconds=900,
            project_path="/Users/user/projects/old-app",
            session_name="Setup Backend (Messy)",
            status="stopped"
        )
        db.add(s)
        
        for i in range(25):
            db.add(FileEvent(
                session_id=s_id,
                time=now - datetime.timedelta(minutes=60 - i),
                type="file_modified",
                path="/src/api.py",
                lines_before=100 + i*5,
                lines_after=105 + i*5,
                delta_added=5,
                delta_deleted=0,
            ))
            
        db.add(FileChurn(
            session_id=s_id,
            path="/src/api.py",
            created=False,
            deleted=False,
            modify_count=25,
            rewrite_count=5,
            total_lines_written=125,
            total_lines_deleted=0,
            write_amplification=3.5,
            first_seen=now - datetime.timedelta(minutes=60),
            last_seen=now - datetime.timedelta(minutes=35),
            current_lines=150
        ))
        
        db.add(Review(
            session_id=s_id,
            quality_score=4,
            notes="Agent kept rewriting the same file."
        ))
    else:
        s = Session(
            id=s_id,
            created_at=now - datetime.timedelta(minutes=30),
            end_time=now - datetime.timedelta(minutes=10),
            duration_seconds=1200,
            project_path="/Users/user/projects/new-app",
            session_name="Setup Dashboard (Clean)",
            status="stopped"
        )
        db.add(s)
        
        paths = ["/src/main.ts", "/src/utils.ts", "/src/components/Button.tsx"]
        
        for i, path in enumerate(paths):
            db.add(FileEvent(
                session_id=s_id,
                time=now - datetime.timedelta(minutes=25 - i*2),
                type="file_created",
                path=path,
                lines_before=0,
                lines_after=50,
                delta_added=50,
                delta_deleted=0,
            ))
            
            db.add(FileChurn(
                session_id=s_id,
                path=path,
                created=True,
                deleted=False,
                modify_count=1,
                rewrite_count=0,
                total_lines_written=50,
                total_lines_deleted=0,
                write_amplification=1.0,
                first_seen=now - datetime.timedelta(minutes=25 - i*2),
                last_seen=now - datetime.timedelta(minutes=25 - i*2),
                current_lines=50
            ))

        db.add(Review(
            session_id=s_id,
            quality_score=9,
            notes="Very direct and efficient."
        ))

    db.commit()
    db.close()

if __name__ == "__main__":
    seed_session("sess_mock_001", True)
    seed_session("sess_mock_002", False)
    print("Fixed database seeded with mock sessions.")
