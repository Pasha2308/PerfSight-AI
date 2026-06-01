import asyncio
import sys
from main import run_full_pipeline, StartTestRequest
from db.database import init_db

async def run():
    await init_db()
    req = StartTestRequest(
        project_name="debug",
        target_url="https://reqres.in",
        scenario_type="load",
        tool="k6"
    )
    try:
        await run_full_pipeline("debug-run-123", req)
        print("PIPELINE FINISHED SUCCESSFULLY")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
