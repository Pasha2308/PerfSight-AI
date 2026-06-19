import json
from typing import Dict, Any
from pydantic import BaseModel, Field

class ReportOutput(BaseModel):
    executive_summary: str = Field(description="Write a concise executive summary (3-4 sentences) that states the overall test verdict (Pass/Fail), describes the most critical finding in plain business language, states the business impact, and gives one clear action item. Plain English, no technical jargon.")
    technical_rca: str = Field(description="Write a technical RCA that includes what happened (timeline of events), why it happened (root cause with evidence), how it was detected (which metrics revealed the issue), and which components were affected. Use specific numbers.")
    remediation_steps: str = Field(description="For each root cause identified, provide a specific, actionable fix with example config values where relevant, estimated fix effort in hours, expected improvement, and how to validate the fix. Format as a numbered list with headers.")
    key_observations: str = Field(description="List 5 key observations as bullet points, starting each with a relevant emoji. Each observation should be a single, specific, data-backed insight.")

async def run_report_agent(findings: Dict[str, Any], scenario: Dict[str, Any]) -> Dict[str, Any]:
    """
    Report Agent: Uses Gemini to generate multi-format reports from structured findings.
    Produces: Executive Summary, Technical RCA, and Remediation Steps.
    """
    findings_str = json.dumps(findings, indent=2)
    scenario_str = json.dumps({
        "name": scenario.get("scenario_name"),
        "type": scenario.get("scenario_type"),
        "target": scenario.get("target_url"),
        "app_type": scenario.get("app_type"),
    }, indent=2)

    prompt = f"""You are a senior performance engineer analyzing a performance test.

SCENARIO: {scenario_str}
FINDINGS: {findings_str}

Please generate a comprehensive report.
"""
    from agents.gemini_client import call_gemini_json
    report_data = await call_gemini_json(
        prompt, 
        temperature=0.3, 
        task_type="reasoning",
        response_schema=ReportOutput
    )

    # Fallback strings in case JSON parsing fails
    exec_summary = report_data.get("executive_summary", "Executive summary not available.")
    tech_rca = report_data.get("technical_rca", "Technical RCA not available.")
    remediation = report_data.get("remediation_steps", "Remediation steps not available.")
    observations = report_data.get("key_observations", "Key observations not available.")

    # If it failed to parse completely, use the raw response as RCA
    if report_data.get("parse_error"):
        print("[Report] Failed to parse JSON report. Using raw text.")
        tech_rca = report_data.get("raw_response", "")

    return {
        "executive_summary": exec_summary,
        "technical_rca": tech_rca,
        "remediation_steps": remediation,
        "key_observations": observations,
        "verdict": findings.get("verdict", {}),
        "kpis": findings.get("kpis", {}),
        "anomalies": findings.get("anomalies", []),
        "root_causes": findings.get("root_causes", []),
        "correlations": findings.get("correlations", []),
        "regressions": findings.get("regressions", []),
        "trend": findings.get("trend", {}),
    }
