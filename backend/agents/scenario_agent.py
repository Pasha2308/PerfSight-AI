import json
from .gemini_client import call_gemini, call_gemini_json
from typing import Dict, Any

SCENARIO_TYPES = {
    "load": {
        "name": "Load Test",
        "description": "Steady expected traffic to validate SLAs",
        "pattern": "ramp to target → hold steady → ramp down",
    },
    "spike": {
        "name": "Spike Test",
        "description": "Sudden traffic burst (10x in 30 seconds) — simulates flash sales, viral events",
        "pattern": "baseline → sudden spike → hold → recovery",
    },
    "stress": {
        "name": "Stress Test",
        "description": "Gradually increase load until the system breaks",
        "pattern": "incremental steps up until failure",
    },
    "soak": {
        "name": "Soak Test",
        "description": "Moderate sustained load for extended period — detects memory leaks",
        "pattern": "ramp to moderate load → hold for 30-60 minutes",
    },
    "breakpoint": {
        "name": "Breakpoint Test",
        "description": "Find the absolute maximum capacity of the system",
        "pattern": "aggressive ramp until system is unresponsive",
    },
}

async def run_scenario_agent(target_url: str, scenario_type: str, project_name: str) -> Dict[str, Any]:
    """
    Scenario Agent: Maps the target application and designs a realistic test scenario.
    """
    scenario = SCENARIO_TYPES.get(scenario_type, SCENARIO_TYPES["load"])

    prompt = f"""You are a senior performance engineering expert. Analyze this web application and design a realistic performance test scenario.

TARGET URL: {target_url}
PROJECT: {project_name}
SCENARIO TYPE: {scenario["name"]} — {scenario["description"]}
TRAFFIC PATTERN: {scenario["pattern"]}

Your task:
1. Infer realistic API endpoints this application likely has (based on the URL/domain)
2. Design a realistic user journey that reflects actual user behavior
3. Determine realistic load parameters for this scenario type

Return ONLY valid JSON with this exact structure:
{{
  "app_type": "e.g. E-Commerce, Banking, SaaS, Social Media",
  "inferred_endpoints": [
    {{"path": "/api/v1/login", "method": "POST", "weight": 20, "description": "User authentication"}},
    {{"path": "/api/v1/products", "method": "GET", "weight": 40, "description": "Product listing"}},
    {{"path": "/api/v1/cart", "method": "POST", "weight": 25, "description": "Add to cart"}},
    {{"path": "/api/v1/checkout", "method": "POST", "weight": 15, "description": "Order placement"}}
  ],
  "user_journey": "Description of how a real user would interact with this app",
  "load_parameters": {{
    "peak_vus": 100,
    "ramp_up_duration_sec": 120,
    "steady_state_duration_sec": 300,
    "ramp_down_duration_sec": 60,
    "think_time_sec": 2
  }},
  "sla_targets": {{
    "p99_ms": 500,
    "error_rate_pct": 1.0,
    "min_throughput_rps": 50
  }},
  "risk_areas": ["e.g. Database under high concurrency", "Session management at scale"]
}}"""

    raw = await call_gemini(prompt, temperature=0.3, task_type="reasoning")

    # Extract JSON from response
    try:
        # Find JSON block
        start = raw.find("{")
        end = raw.rfind("}") + 1
        result = json.loads(raw[start:end])
        result["scenario_type"] = scenario_type
        result["scenario_name"] = scenario["name"]
        result["target_url"] = target_url
        return result
    except Exception:
        # Fallback
        return {
            "app_type": "Web Application",
            "scenario_type": scenario_type,
            "scenario_name": scenario["name"],
            "target_url": target_url,
            "inferred_endpoints": [
                {"path": "/", "method": "GET", "weight": 30, "description": "Home page"},
                {"path": "/api/data", "method": "GET", "weight": 40, "description": "Data endpoint"},
                {"path": "/api/submit", "method": "POST", "weight": 30, "description": "Submit endpoint"},
            ],
            "user_journey": f"Simulating {scenario['name']} traffic pattern against {target_url}",
            "load_parameters": {
                "peak_vus": 100,
                "ramp_up_duration_sec": 120,
                "steady_state_duration_sec": 300,
                "ramp_down_duration_sec": 60,
                "think_time_sec": 2,
            },
            "sla_targets": {"p99_ms": 500, "error_rate_pct": 1.0, "min_throughput_rps": 50},
            "risk_areas": ["High concurrency handling", "Database connection pooling"],
        }
