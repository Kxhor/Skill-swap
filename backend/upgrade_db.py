from app import create_app
from app.extensions import db
from sqlalchemy import text
import random
import re

app = create_app()
with app.app_context():
    with db.engine.begin() as conn:
        # PostgreSQL syntax for adding columns safely
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(150);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(150);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(150);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR(50);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS swap_id VARCHAR(50);"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS swap_username VARCHAR(50);"))
        try:
            conn.execute(text("ALTER TABLE users ADD CONSTRAINT users_swap_id_key UNIQUE (swap_id);"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD CONSTRAINT users_swap_username_key UNIQUE (swap_username);"))
        except Exception:
            pass
            
    print("Database columns checked/added.")

    # Fill in swap_id and swap_username for existing users if they are null
    from app.models.user import User
    users = User.query.all()
    for u in users:
        updated = False
        if not u.swap_id:
            while True:
                s_id = f"SWAP-{random.randint(100000, 999999)}"
                if not User.query.filter_by(swap_id=s_id).first():
                    u.swap_id = s_id
                    updated = True
                    break
        if not u.swap_username:
            base_username = re.sub(r'[^a-z0-9_]', '', u.name.lower().replace(" ", "_"))
            s_username = base_username
            while True:
                if not User.query.filter_by(swap_username=s_username).first():
                    u.swap_username = s_username
                    updated = True
                    break
                s_username = f"{base_username}_{random.randint(100, 999)}"
        if u.name == "Kishor Demo":
            u.name = "Kishor"
            updated = True
            
        if updated:
            db.session.add(u)
    db.session.commit()
    print("Existing users updated with swap_id and swap_username.")
