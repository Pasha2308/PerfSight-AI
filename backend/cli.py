import typer
import httpx
import json
import time
from typing import Optional

app = typer.Typer(help="PerfSight-AI Command Line Interface")

BASE_URL = "http://localhost:8000"

def get_client():
    return httpx.Client(base_url=BASE_URL)

@app.command()
def start(
    project_name: str = typer.Option(..., "--project", "-p", help="Project name"),
    target_url: str = typer.Option(..., "--url", "-u", help="Target URL"),
    scenario_type: str = typer.Option("load", "--type", "-t", help="Scenario type (load, stress, etc.)"),
    tool: str = typer.Option("k6", "--tool", help="Load testing tool to use"),
    description: Optional[str] = typer.Option(None, "--desc", "-d", help="Natural language description of the test scenario")
):
    """Start a new performance test run."""
    with get_client() as client:
        if description:
            payload = {
                "project_name": project_name,
                "target_url": target_url,
                "scenario_type": scenario_type,
                "tool": tool,
                "description": description
            }
            resp = client.post("/api/tests/start-nl", json=payload)
        else:
            payload = {
                "project_name": project_name,
                "target_url": target_url,
                "scenario_type": scenario_type,
                "tool": tool
            }
            resp = client.post("/api/tests/start", json=payload)
        
        if resp.status_code == 200:
            data = resp.json()
            run_id = data.get("run_id")
            typer.echo(f"Successfully started test run! Run ID: {run_id}")
            typer.echo(f"Check status with: python cli.py status {run_id}")
        else:
            typer.echo(f"Failed to start test. Status: {resp.status_code}, Details: {resp.text}")

@app.command()
def status(
    run_id: str = typer.Argument(..., help="The ID of the test run to check")
):
    """Get the status of a performance test run."""
    with get_client() as client:
        resp = client.get(f"/api/tests/{run_id}")
        if resp.status_code == 200:
            data = resp.json()
            typer.echo(f"Status for Run {run_id}: {data.get('status')}")
            if data.get('status') == 'completed':
                typer.echo(f"Test is completed. Fetch report with: python cli.py report {run_id}")
        else:
            typer.echo(f"Failed to fetch status. Status: {resp.status_code}, Details: {resp.text}")

@app.command()
def wait(
    run_id: str = typer.Argument(..., help="The ID of the test run to wait for")
):
    """Wait for a test run to complete."""
    with get_client() as client:
        while True:
            resp = client.get(f"/api/tests/{run_id}")
            if resp.status_code == 200:
                data = resp.json()
                status = data.get('status')
                typer.echo(f"Current status: {status}")
                if status in ['completed', 'failed']:
                    typer.echo(f"Test finished with status: {status}")
                    break
                time.sleep(5)
            else:
                typer.echo(f"Error fetching status: {resp.status_code}")
                break

@app.command()
def report(
    run_id: str = typer.Argument(..., help="The ID of the test run")
):
    """Get the full AI-analyzed report for a test run."""
    with get_client() as client:
        resp = client.get(f"/api/tests/{run_id}/report")
        if resp.status_code == 200:
            data = resp.json()
            report_data = data.get("report")
            
            # Print cleanly if it's parsed JSON, otherwise raw string
            if isinstance(report_data, str):
                try:
                    report_data = json.loads(report_data)
                except json.JSONDecodeError:
                    pass
            
            if isinstance(report_data, dict):
                typer.echo("\n" + "="*50)
                typer.echo("PERFSIGHT AI REPORT")
                typer.echo("="*50 + "\n")
                
                typer.echo("EXECUTIVE SUMMARY:")
                typer.echo(report_data.get("executive_summary", "N/A") + "\n")
                
                typer.echo("TECHNICAL RCA:")
                typer.echo(report_data.get("technical_rca", "N/A") + "\n")
                
                typer.echo("REMEDIATION STEPS:")
                typer.echo(report_data.get("remediation_steps", "N/A") + "\n")
            else:
                typer.echo(json.dumps(report_data, indent=2))
        else:
            typer.echo(f"Failed to fetch report. Status: {resp.status_code}, Details: {resp.text}")

@app.command()
def chat(
    run_id: str = typer.Argument(..., help="The ID of the test run"),
    message: str = typer.Argument(..., help="The message/question for the QA agent")
):
    """Ask the QA agent a question about a completed test run."""
    with get_client() as client:
        payload = {
            "test_run_id": run_id,
            "message": message
        }
        resp = client.post("/api/chat", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            typer.echo("\n[PerfSight AI Assistant]")
            typer.echo(data.get("answer"))
        else:
            typer.echo(f"Chat request failed. Status: {resp.status_code}, Details: {resp.text}")

if __name__ == "__main__":
    app()
