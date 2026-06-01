import asyncio
import os
from agents.report_agent import run_report_agent
from agents.gemini_client import get_model_name
import json

async def run():
    findings = {"kpis": {"p99_ms": 150}, "verdict": {"status": "PASS"}}
    scenario = {"scenario_name": "Test", "scenario_type": "load", "target_url": "http://test"}
    print(f"Using model: {get_model_name('reasoning')}")
    try:
        report = await run_report_agent(findings, scenario)
        print("REPORT SUCCESS:", list(report.keys()))
        print("Exec summary:", str(report.get("executive_summary"))[:50])
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
