import json
from typing import Dict, Any
from agents.gemini_client import call_gemini

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

    # --- Executive Summary ---
    exec_prompt = f"""You are a performance engineering expert writing a report for a CTO/VP Engineering.

SCENARIO: {scenario_str}
FINDINGS: {findings_str}

Write a concise executive summary (3-4 sentences) that:
1. States the overall test verdict (Pass/Fail)
2. Describes the most critical finding in plain business language
3. States the business impact (e.g., "users will experience 4+ second delays during peak traffic")
4. Gives one clear action item

Write in plain English, no technical jargon. Return ONLY the summary text."""

    exec_summary = await call_gemini(exec_prompt, temperature=0.4, task_type="reasoning")

    # --- Technical RCA ---
    tech_prompt = f"""You are a senior performance engineer writing a technical root cause analysis.

SCENARIO: {scenario_str}
FINDINGS: {findings_str}

Write a technical RCA that includes:
1. What happened (timeline of events)
2. Why it happened (root cause with evidence from the data)
3. How it was detected (which metrics revealed the issue)
4. Which components were affected and in what order

Use specific numbers from the findings. Be precise. Return ONLY the analysis text, using clear paragraphs."""

    tech_rca = await call_gemini(tech_prompt, temperature=0.3, task_type="reasoning")

    # --- Remediation Steps ---
    remed_prompt = f"""You are a performance engineering expert providing actionable remediation guidance.

SCENARIO: {scenario_str}
FINDINGS: {findings_str}

For each root cause identified, provide:
1. A specific, actionable fix (with example config values where relevant)
2. Estimated fix effort (hours)
3. Expected improvement after fix
4. How to validate the fix (what to retest)

Format as a numbered list with clear headers. Be specific — name actual config files, parameters, and values.
Return ONLY the remediation steps."""

    remediation = await call_gemini(remed_prompt, temperature=0.3, task_type="reasoning")

    # --- Key Observations ---
    obs_prompt = f"""Based on this performance test data, list 5 key observations as bullet points.
Each observation should be a single, specific, data-backed insight.
FINDINGS: {findings_str}
Return ONLY the 5 bullet points, starting each with a relevant emoji."""

    observations = await call_gemini(obs_prompt, temperature=0.4, task_type="fast")

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
