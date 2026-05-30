import aiosqlite
import json
from pathlib import Path

DB_PATH = "./perfsight.db"

async def get_db():
    return await aiosqlite.connect(DB_PATH)

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(owner_id) REFERENCES users(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS test_runs (
                id TEXT PRIMARY KEY,
                project_name TEXT,
                target_url TEXT,
                scenario_type TEXT,
                tool TEXT,
                status TEXT DEFAULT 'pending',
                generated_script TEXT,
                metrics_json TEXT,
                findings_json TEXT,
                report_json TEXT,
                nl_description TEXT,
                user_id TEXT,
                workspace_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id TEXT,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS baselines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_name TEXT,
                endpoint TEXT,
                p50_ms REAL,
                p95_ms REAL,
                p99_ms REAL,
                error_pct REAL,
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()

async def save_test_run(run_id: str, data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        cols = ", ".join(data.keys())
        placeholders = ", ".join(["?" for _ in data])
        vals = []
        for v in data.values():
            vals.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
        await db.execute(
            f"INSERT OR REPLACE INTO test_runs (id, {cols}) VALUES (?, {placeholders})",
            [run_id] + vals
        )
        await db.commit()

async def update_test_run(run_id: str, data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        set_clause = ", ".join([f"{k} = ?" for k in data])
        vals = []
        for v in data.values():
            vals.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
        await db.execute(
            f"UPDATE test_runs SET {set_clause} WHERE id = ?",
            vals + [run_id]
        )
        await db.commit()

async def get_test_run(run_id: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM test_runs WHERE id = ?", [run_id]) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            result = dict(row)
            for field in ["metrics_json", "findings_json", "report_json"]:
                if result.get(field):
                    try:
                        result[field] = json.loads(result[field])
                    except Exception:
                        pass
            return result

async def get_all_test_runs() -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, project_name, target_url, scenario_type, tool, status, created_at, completed_at FROM test_runs ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

async def save_chat_message(test_run_id: str, role: str, content: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO chat_messages (test_run_id, role, content) VALUES (?, ?, ?)",
            [test_run_id, role, content]
        )
        await db.commit()

async def get_chat_history(test_run_id: str) -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT role, content, created_at FROM chat_messages WHERE test_run_id = ? ORDER BY created_at",
            [test_run_id]
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

async def get_baseline(project_name: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM baselines WHERE project_name = ? ORDER BY computed_at DESC LIMIT 10",
            [project_name]
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

async def create_user(user_id: str, email: str, hashed_password: str, name: str = ""):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO users (id, email, hashed_password, name) VALUES (?, ?, ?, ?)",
            (user_id, email, hashed_password, name)
        )
        await db.commit()

async def get_user_by_email(email: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def get_user_by_id(user_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None
