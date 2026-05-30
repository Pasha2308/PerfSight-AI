import asyncio
import uuid
import json
import random
from datetime import datetime, timedelta
import aiosqlite
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db.database import DB_PATH
from auth import get_password_hash

async def seed_data():
    print("Starting data seeding process...")
    async with aiosqlite.connect(DB_PATH) as db:
        # Create a default user
        admin_id = "admin-1234-5678"
        email = "judge@feuji.com"
        
        # Check if user exists
        async with db.execute("SELECT id FROM users WHERE email = ?", (email,)) as cur:
            if await cur.fetchone():
                print(f"User {email} already exists. Proceeding with seeding tests...")
            else:
                pw = get_password_hash("password123")
                await db.execute(
                    "INSERT INTO users (id, email, hashed_password, name) VALUES (?, ?, ?, ?)",
                    (admin_id, email, pw, "Feuji Judge")
                )
                print(f"Created admin user: {email} / password123")
        
        # Create a workspace
        workspace_id = "workspace-abc-def"
        async with db.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)) as cur:
            if not await cur.fetchone():
                await db.execute(
                    "INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)",
                    (workspace_id, "Enterprise Demo Workspace", admin_id)
                )

        # Generate realistic historical tests
        scenarios = [
            ("E-Commerce Flash Sale", "https://api.retail.com", "spike"),
            ("B2B API Nightly Sync", "https://sync.enterprise.com", "stress"),
            ("User Login Sustained Load", "https://auth.company.com", "load"),
            ("Inventory DB Query", "https://db.internal.net", "soak"),
            ("Payment Gateway Black Friday", "https://payments.net", "spike"),
        ]

        now = datetime.utcnow()
        for i, (proj, url, stype) in enumerate(scenarios):
            run_id = f"test-run-{uuid.uuid4().hex[:8]}"
            created_at = now - timedelta(days=i, hours=random.randint(1, 10))
            completed_at = created_at + timedelta(minutes=random.randint(15, 60))

            # Mock Report
            report = {
                "executive_summary": f"The {stype} test for {proj} revealed critical insights. The system handled initial loads well but degraded during peak thresholds.",
                "key_findings": [
                    {
                        "category": "Bottleneck",
                        "severity": "high" if random.random() > 0.5 else "medium",
                        "description": "Database connection pool exhausted during peak VU load.",
                        "recommendation": "Increase pgBouncer limits or implement read replicas."
                    },
                    {
                        "category": "Latency",
                        "severity": "medium",
                        "description": "P99 latency spiked to 1.2s on the /api/checkout endpoint.",
                        "recommendation": "Implement Redis caching for inventory checks."
                    }
                ],
                "system_health": {
                    "cpu_saturation": random.randint(60, 95),
                    "memory_utilization": random.randint(50, 85),
                    "network_io": "High"
                }
            }

            # Mock Metrics
            metrics = {
                "overall": {
                    "p50_ms": random.randint(40, 100),
                    "p95_ms": random.randint(150, 400),
                    "p99_ms": random.randint(300, 1500),
                    "error_rate_pct": round(random.uniform(0.1, 3.5), 2),
                    "requests_per_sec": random.randint(500, 5000)
                }
            }

            await db.execute("""
                INSERT INTO test_runs (
                    id, project_name, target_url, scenario_type, tool, status, 
                    metrics_json, report_json, user_id, workspace_id, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id, proj, url, stype, "k6", "completed",
                json.dumps(metrics), json.dumps(report), admin_id, workspace_id,
                created_at.strftime('%Y-%m-%d %H:%M:%S'), completed_at.strftime('%Y-%m-%d %H:%M:%S')
            ))

        await db.commit()
        print("Successfully seeded 5 realistic test runs into the database.")

if __name__ == "__main__":
    asyncio.run(seed_data())
