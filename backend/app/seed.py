import os

from app.database import SessionLocal
from app.models.user import User


def seed_users():
    """Seed default users if none exist. Skips gracefully in test environments."""
    if os.environ.get("TESTING"):
        return
    try:
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                db.add_all([
                    User(name="Alice"),
                    User(name="Bob"),
                ])
                db.commit()
                print("Seeded 2 users: Alice, Bob")
            else:
                print(f"Users already exist ({db.query(User).count()}), skipping seed")
        finally:
            db.close()
    except Exception as exc:
        print(f"Seed skipped (database not available): {exc}")
