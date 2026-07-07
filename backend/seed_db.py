import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Session, FileEvent, FileChurn, PromptNote, Review

DATABASE_URL = "sqlite:///./sessions.db"

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed():
    db = SessionLocal()
    
    # Session 1: Bad Write Amplification
    s1_id = "sess_mock_001"
    now = datetime.datetime.utcnow()
    
    s1 = Session(
        id=s1_id,
        created_at=now - datetime.timedelta(hours=1),
        end_time=now - datetime.timedelta(minutes=45),
        duration_seconds=900,
        project_path="/Users/user/projects/old-app",
        session_name="Setup Backend (Messy)",
        status="stopped"
    )
    db.add(s1)
    
    for i in range(25):
        db.add(FileEvent(
            session_id=s1_id,
            time=now - datetime.timedelta(minutes=60 - i),
            type="file_modified",
            path="/src/api.py",
            lines_before=100 + i*5,
            lines_after=105 + i*5,
            delta_added=5,
            delta_deleted=0,
        ))
        
    db.add(FileChurn(
        session_id=s1_id,
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
    ))
    
    db.add(Review(
        session_id=s1_id,
        quality_score=4,
        notes="Agent kept rewriting the same file."
    ))

    # Session 2: Efficient
    s2_id = "sess_mock_002"
    
    s2 = Session(
        id=s2_id,
        created_at=now - datetime.timedelta(minutes=30),
        end_time=now - datetime.timedelta(minutes=10),
        duration_seconds=1200,
        project_path="/Users/user/projects/new-app",
        session_name="Setup Dashboard (Clean)",
        status="stopped"
    )
    db.add(s2)
    
    paths = ["/src/main.ts", "/src/utils.ts", "/src/components/Button.tsx"]
    
    for i, path in enumerate(paths):
        db.add(FileEvent(
            session_id=s2_id,
            time=now - datetime.timedelta(minutes=25 - i*2),
            type="file_created",
            path=path,
            lines_before=0,
            lines_after=50,
            delta_added=50,
            delta_deleted=0,
        ))
        
        db.add(FileChurn(
            session_id=s2_id,
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
        ))

    db.add(Review(
        session_id=s2_id,
        quality_score=9,
        notes="Very direct and efficient."
    ))

    db.commit()
    db.close()
    print("Database seeded with mock sessions.")

if __name__ == "__main__":
    seed()
