import httpx
import asyncio
from mcp.server.fastmcp import FastMCP
from typing import Optional, Dict, Any

# Create an MCP server
mcp = FastMCP("PerfSight")

# Configure the base URL for the PerfSight-AI backend
PERFSIGHT_BASE_URL = "http://localhost:8000"

@mcp.tool()
async def start_performance_test(
    project_name: str,
    target_url: str,
    scenario_type: str = "load",
    tool: str = "k6",
    nl_description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Start a new AI-driven performance test.
    Args:
        project_name: Name of the project/test run.
        target_url: The URL to test.
        scenario_type: load, spike, stress, soak, or breakpoint.
        tool: k6, jmeter, gatling, or locust.
        nl_description: Optional natural language description of the scenario.
    """
    async with httpx.AsyncClient(base_url=PERFSIGHT_BASE_URL) as client:
        if nl_description:
            payload = {
                "project_name": project_name,
                "target_url": target_url,
                "scenario_type": scenario_type,
                "tool": tool,
                "description": nl_description
            }
            resp = await client.post("/api/tests/start-nl", json=payload)
        else:
            payload = {
                "project_name": project_name,
                "target_url": target_url,
                "scenario_type": scenario_type,
                "tool": tool
            }
            resp = await client.post("/api/tests/start", json=payload)
            
        resp.raise_for_status()
        return resp.json()

@mcp.tool()
async def get_test_status(run_id: str) -> Dict[str, Any]:
    """
    Get the current status of a performance test run.
    Args:
        run_id: The UUID of the test run.
    """
    async with httpx.AsyncClient(base_url=PERFSIGHT_BASE_URL) as client:
        resp = await client.get(f"/api/tests/{run_id}")
        resp.raise_for_status()
        data = resp.json()
        return {"run_id": data.get("id"), "status": data.get("status")}

@mcp.tool()
async def get_test_report(run_id: str) -> Dict[str, Any]:
    """
    Retrieve the full AI-analyzed report and findings for a completed test run.
    Args:
        run_id: The UUID of the test run.
    """
    async with httpx.AsyncClient(base_url=PERFSIGHT_BASE_URL) as client:
        resp = await client.get(f"/api/tests/{run_id}/report")
        resp.raise_for_status()
        return resp.json()

@mcp.tool()
async def ask_perfsight_qa(run_id: str, message: str) -> Dict[str, Any]:
    """
    Ask the AI QA Agent a question about a completed performance test.
    Args:
        run_id: The UUID of the test run.
        message: The question or request for the QA agent.
    """
    async with httpx.AsyncClient(base_url=PERFSIGHT_BASE_URL) as client:
        payload = {
            "test_run_id": run_id,
            "message": message
        }
        resp = await client.post("/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()

if __name__ == "__main__":
    # Initialize and run the FastMCP server
    print("Starting PerfSight MCP Server...")
    mcp.run()
