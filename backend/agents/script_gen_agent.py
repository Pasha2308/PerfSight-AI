import json
from .gemini_client import call_gemini
from typing import Dict, Any

async def run_script_gen_agent(scenario: Dict[str, Any], tool: str = "k6") -> Dict[str, Any]:
    """
    Script Generation Agent: Generates production-quality test scripts.
    Supports k6, JMeter, Gatling, Locust.
    """
    endpoints_json = json.dumps(scenario.get("inferred_endpoints", []), indent=2)
    load_params = scenario.get("load_parameters", {})
    sla = scenario.get("sla_targets", {})
    target_url = scenario.get("target_url", "https://example.com")
    scenario_type = scenario.get("scenario_type", "load")
    scenario_name = scenario.get("scenario_name", "Load Test")
    user_journey = scenario.get("user_journey", "")

    if tool == "k6":
        prompt = f"""You are a performance engineering expert. Generate a production-quality k6 test script.

SCENARIO: {scenario_name}
TARGET URL: {target_url}
USER JOURNEY: {user_journey}

ENDPOINTS TO TEST:
{endpoints_json}

LOAD PARAMETERS:
- Peak Virtual Users: {load_params.get('peak_vus', 100)}
- Ramp-up: {load_params.get('ramp_up_duration_sec', 120)} seconds
- Steady state: {load_params.get('steady_state_duration_sec', 300)} seconds
- Ramp-down: {load_params.get('ramp_down_duration_sec', 60)} seconds
- Think time: {load_params.get('think_time_sec', 2)} seconds

SLA THRESHOLDS:
- p99 < {sla.get('p99_ms', 500)}ms
- Error rate < {sla.get('error_rate_pct', 1)}%

REQUIREMENTS:
1. Use realistic session-based user flows (not random endpoint hammering)
2. Include parameterized test data (different users, product IDs, etc.)
3. Add proper assertions/checks for response validation
4. Include realistic think times between requests (randomized ±50%)
5. Configure stages based on the {scenario_type} pattern
6. Add proper thresholds for SLA enforcement
7. Add tags for each request group

Return ONLY the complete k6 JavaScript code, no explanation, no markdown fences."""

        script = await call_gemini(prompt, temperature=0.2, task_type="fast")
        # Clean up markdown fences if present
        script = script.replace("```javascript", "").replace("```js", "").replace("```", "").strip()

    elif tool == "jmeter":
        prompt = f"""Generate a complete JMeter test plan in JMX XML format for:
SCENARIO: {scenario_name}
TARGET: {target_url}
ENDPOINTS: {endpoints_json}
LOAD: {load_params.get('peak_vus', 100)} users, {load_params.get('steady_state_duration_sec', 300)}s duration

Return ONLY valid JMX XML, no explanation."""
        script = await call_gemini(prompt, temperature=0.2, task_type="fast")
        script = script.replace("```xml", "").replace("```", "").strip()

    elif tool == "gatling":
        prompt = f"""Generate a complete Gatling Scala simulation for:
SCENARIO: {scenario_name}
TARGET: {target_url}
ENDPOINTS: {endpoints_json}
LOAD: {load_params.get('peak_vus', 100)} users, {load_params.get('steady_state_duration_sec', 300)}s duration

Return ONLY valid Scala code, no explanation."""
        script = await call_gemini(prompt, temperature=0.2, task_type="fast")
        script = script.replace("```scala", "").replace("```", "").strip()

    elif tool == "locust":
        prompt = f"""Generate a complete Locust Python test script for:
SCENARIO: {scenario_name}
TARGET: {target_url}
ENDPOINTS: {endpoints_json}
LOAD: {load_params.get('peak_vus', 100)} users

Return ONLY valid Python code, no explanation."""
        script = await call_gemini(prompt, temperature=0.2, task_type="fast")
        script = script.replace("```python", "").replace("```", "").strip()

    else:
        script = f"# Tool '{tool}' not supported. Please select: k6, jmeter, gatling, locust"

    return {
        "tool": tool,
        "script": script,
        "language": _get_language(tool),
        "scenario_name": scenario_name,
        "estimated_duration_sec": (
            load_params.get("ramp_up_duration_sec", 120)
            + load_params.get("steady_state_duration_sec", 300)
            + load_params.get("ramp_down_duration_sec", 60)
        ),
        "peak_vus": load_params.get("peak_vus", 100),
        "sla_targets": sla,
    }

def _get_language(tool: str) -> str:
    return {
        "k6": "javascript",
        "jmeter": "xml",
        "gatling": "scala",
        "locust": "python",
    }.get(tool, "javascript")
