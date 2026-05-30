"""
Enhanced QA Agent with Intent Routing
Classifies user intent and routes to specialized handlers.

Intents:
  EXPLAIN_TIMEPOINT  — "what happened at 3 minutes?"
  EXPLAIN_ENDPOINT   — "why was /checkout slow?"
  COMPARE            — "compare with last test"
  RETEST             — "redo with 2000 users" / "retry as stress test"
  REFORMAT           — "give me an executive summary" / "bullet points"
  RECOMMEND          — "how do I fix this?"
  EXPORT             — "export as PDF" / "give me a JUnit report"
  GENERAL            — catch-all answer

Patent Claim 3: Intent-classified conversational analytics post-test system.
"""
import json
import re
from typing import Dict, Any, List, Optional, Tuple
from agents.gemini_client import call_gemini

SUGGESTED_QUESTIONS = [
    "What was the root cause of the performance issue?",
    "Which endpoint performed worst and why?",
    "Should I retest with different parameters?",
    "What should I fix first to get the biggest improvement?",
    "Give me an executive summary I can send to my manager",
    "How does this compare to what a healthy test should look like?",
    "What infrastructure changes would prevent this issue?",
    "Is the system ready for production traffic?",
    "What happened at the peak load moment?",
    "Redo the test with double the users",
]

# ─────────────────────────────────────────────────────────────────
# Intent Classifier
# ─────────────────────────────────────────────────────────────────

INTENT_PATTERNS = {
    "RETEST": [
        r"redo", r"retest", r"run again", r"test again",
        r"try with", r"increase.*user", r"more user", r"\d+\s*user",
        r"double", r"triple", r"higher load", r"same test", r"retry",
        r"stress test", r"spike test", r"soak test", r"load test", r"breakpoint",
    ],
    "REFORMAT": [
        r"executive summary", r"bullet point", r"shorter", r"simpler",
        r"change format", r"redo report", r"summarize", r"tldr", r"for my manager",
        r"one page", r"quick summary", r"key points",
    ],
    "EXPLAIN_TIMEPOINT": [
        r"at \d+", r"minute \d+", r"second \d+", r"around \d+",
        r"at the beginning", r"at the end", r"during the spike",
        r"what happened at", r"when did", r"peak moment", r"that point",
    ],
    "EXPLAIN_ENDPOINT": [
        r"/api", r"/endpoint", r"endpoint", r"route", r"url",
        r"request", r"why was .* slow", r"checkout", r"login", r"payment",
    ],
    "EXPORT": [
        r"export", r"download", r"pdf", r"junit", r"csv", r"share",
        r"send report", r"html report",
    ],
    "RECOMMEND": [
        r"fix", r"how to", r"improve", r"optimize", r"scale", r"resolve",
        r"prevent", r"solution", r"recommend", r"what should i", r"action",
    ],
}


def classify_intent(message: str) -> str:
    """
    Rule-based + pattern intent classifier.
    Returns one of: RETEST, REFORMAT, EXPLAIN_TIMEPOINT, EXPLAIN_ENDPOINT,
                    EXPORT, RECOMMEND, GENERAL
    """
    msg_lower = message.lower()

    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                return intent

    return "GENERAL"


def _extract_retest_params(message: str, scenario: Dict) -> Dict:
    """Extract retest parameters from the user's message."""
    msg_lower = message.lower()
    load_params = scenario.get("load_parameters", {})
    current_vus = load_params.get("peak_vus", 100)

    # Extract user count
    vus_match = re.search(r"(\d[\d,]*)\s*(?:user|vu|concurrent|virtual)", msg_lower)
    if vus_match:
        try:
            peak_vus = int(vus_match.group(1).replace(",", ""))
        except ValueError:
            peak_vus = current_vus * 2
    elif "double" in msg_lower:
        peak_vus = current_vus * 2
    elif "triple" in msg_lower:
        peak_vus = current_vus * 3
    elif "half" in msg_lower:
        peak_vus = max(10, current_vus // 2)
    else:
        peak_vus = int(current_vus * 1.5)

    # Extract scenario type override
    scenario_type = scenario.get("scenario_type", "load")
    for st in ["spike", "stress", "soak", "load", "breakpoint"]:
        if st in msg_lower:
            scenario_type = st
            break

    return {
        "recommended": True,
        "reason": f"Based on your request: {message}",
        "suggested_params": {
            "scenario_type": scenario_type,
            "peak_vus": peak_vus,
            "message": f"Retest with {peak_vus} virtual users using {scenario_type} pattern",
        },
    }


async def _handle_reformat(message: str, report: Dict, scenario: Dict) -> str:
    """Regenerate the report in a different format based on user request."""
    msg_lower = message.lower()

    if "executive" in msg_lower or "manager" in msg_lower or "cto" in msg_lower:
        fmt = "executive summary (3 sentences max, zero technical jargon, business impact focus)"
    elif "bullet" in msg_lower:
        fmt = "bullet-point list (5-7 key findings with emoji icons)"
    elif "technical" in msg_lower or "engineer" in msg_lower:
        fmt = "detailed technical breakdown with metrics, p95/p99 values, and specific component analysis"
    elif "timeline" in msg_lower:
        fmt = "chronological timeline of events during the test"
    elif "one page" in msg_lower or "tldr" in msg_lower:
        fmt = "single-paragraph TL;DR summary"
    else:
        fmt = "concise summary with the 3 most important findings"

    prompt = f"""You are PerfSight AI. Reformat the following performance test report as a {fmt}.

ORIGINAL REPORT:
Executive Summary: {report.get('executive_summary', '')}
Technical RCA: {report.get('technical_rca', '')}
Key Observations: {report.get('key_observations', '')}
Verdict: {json.dumps(report.get('verdict', {}))}
KPIs: {json.dumps(report.get('kpis', {}))}

Reformat this information as requested. Keep all facts accurate. Return only the reformatted content."""

    return await call_gemini(prompt, temperature=0.4, task_type="fast")


async def _handle_timepoint(message: str, report: Dict, scenario: Dict) -> str:
    """Explain what happened at a specific time or moment in the test."""
    prompt = f"""You are PerfSight AI answering a question about a specific moment during a performance test.

USER QUESTION: {message}

TEST DATA:
Scenario: {scenario.get('scenario_name', '')} on {scenario.get('target_url', '')}
Scenario Type: {scenario.get('scenario_type', '')}
Load Pattern: Peak {scenario.get('load_parameters', {}).get('peak_vus', '?')} VUs

FINDINGS:
{json.dumps(report.get('kpis', {}), indent=2)}
Anomalies: {json.dumps(report.get('anomalies', [])[:5], indent=2)}
Root Causes: {json.dumps(report.get('root_causes', []), indent=2)}
Trend: {json.dumps(report.get('trend', {}), indent=2)}

Explain specifically what happened at the moment/timepoint the user is asking about.
Reference the test phase (ramp-up, steady state, or spike moment) and what the metrics showed.
Be specific with numbers. Keep it under 200 words."""

    return await call_gemini(prompt, temperature=0.4, task_type="fast")


async def run_qa_agent(
    question: str,
    report: Dict[str, Any],
    scenario: Dict[str, Any],
    chat_history: List[Dict],
) -> Dict[str, Any]:
    """
    Enhanced QA Agent with intent routing.
    """
    # Classify intent
    intent = classify_intent(question)

    # Handle action intents first (no LLM needed)
    if intent == "RETEST":
        retest_params = _extract_retest_params(question, scenario)
        answer = (
            f"🔄 **Retest configured!**\n\n"
            f"I'll run a new **{retest_params['suggested_params']['scenario_type']}** test "
            f"with **{retest_params['suggested_params']['peak_vus']} virtual users**.\n\n"
            f"Click **Run Retest** below to start the new test immediately."
        )
        return {
            "answer": answer,
            "intent": intent,
            "retest_suggestion": retest_params,
            "suggested_questions": _get_contextual_suggestions(report, scenario),
            "action": "retest",
        }

    if intent == "REFORMAT":
        answer = await _handle_reformat(question, report, scenario)
        return {
            "answer": answer,
            "intent": intent,
            "retest_suggestion": {"recommended": False},
            "suggested_questions": _get_contextual_suggestions(report, scenario),
        }

    if intent == "EXPLAIN_TIMEPOINT":
        answer = await _handle_timepoint(question, report, scenario)
        return {
            "answer": answer,
            "intent": intent,
            "retest_suggestion": {"recommended": False},
            "suggested_questions": _get_contextual_suggestions(report, scenario),
        }

    if intent == "EXPORT":
        answer = (
            "📤 **Export Options Available:**\n\n"
            "• **HTML Report** — Full interactive report\n"
            "• **JUnit XML** — For CI/CD pipeline integration\n"
            "• **Copy to clipboard** — Paste the report anywhere\n\n"
            "_Use the export buttons in the report header to download._"
        )
        return {
            "answer": answer,
            "intent": intent,
            "retest_suggestion": {"recommended": False},
            "suggested_questions": _get_contextual_suggestions(report, scenario),
            "action": "export",
        }

    # For GENERAL, RECOMMEND, EXPLAIN_ENDPOINT — use Gemini
    context = {
        "scenario": {
            "name": scenario.get("scenario_name"),
            "type": scenario.get("scenario_type"),
            "target": scenario.get("target_url"),
            "peak_vus": scenario.get("load_parameters", {}).get("peak_vus"),
            "nl_description": scenario.get("nl_description", ""),
        },
        "verdict": report.get("verdict", {}),
        "kpis": report.get("kpis", {}),
        "root_causes": report.get("root_causes", []),
        "anomalies_count": len(report.get("anomalies", [])),
        "correlations": report.get("correlations", []),
        "regressions": report.get("regressions", []),
        "trend": report.get("trend", {}),
        "executive_summary": report.get("executive_summary", ""),
        "remediation_steps": report.get("remediation_steps", ""),
    }

    history_str = ""
    for msg in chat_history[-6:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history_str += f"{role}: {msg['content']}\n"

    prompt = f"""You are PerfSight AI, an expert performance engineering assistant.
You have just completed a performance test analysis. Answer the user's question based on the test data.

DETECTED INTENT: {intent}

=== TEST FINDINGS ===
{json.dumps(context, indent=2)}

=== FULL REPORT ===
Executive Summary: {report.get('executive_summary', '')}
Technical RCA: {report.get('technical_rca', '')}
Remediation: {report.get('remediation_steps', '')}

=== CONVERSATION HISTORY ===
{history_str}

=== USER QUESTION ===
{question}

Instructions:
- Answer directly using data from the findings
- Use specific numbers and metrics from the report
- If intent is RECOMMEND: give numbered, actionable steps with estimated fix effort
- If intent is EXPLAIN_ENDPOINT: compare the specific endpoint metrics with others
- Be conversational but precise
- End with ONE actionable next step
- Keep response under 350 words unless detail is requested
- Use markdown formatting (bold, bullets) for clarity"""

    answer = await call_gemini(prompt, temperature=0.5, task_type="reasoning")
    retest_suggestion = _extract_retest_suggestion(answer, scenario)

    return {
        "answer": answer,
        "intent": intent,
        "retest_suggestion": retest_suggestion,
        "suggested_questions": _get_contextual_suggestions(report, scenario),
    }


def _extract_retest_suggestion(answer: str, scenario: Dict) -> Dict:
    answer_lower = answer.lower()
    if any(word in answer_lower for word in ["retest", "run again", "test again", "increase vus", "try with"]):
        load_params = scenario.get("load_parameters", {})
        return {
            "recommended": True,
            "reason": "Based on the analysis, a follow-up test is recommended",
            "suggested_params": {
                "scenario_type": scenario.get("scenario_type", "load"),
                "peak_vus": int(load_params.get("peak_vus", 100) * 1.5),
                "message": "Consider testing with 1.5x the previous virtual user count to validate fixes",
            },
        }
    return {"recommended": False}


def _get_contextual_suggestions(report: Dict, scenario: Dict) -> List[str]:
    suggestions = []
    if report.get("verdict", {}).get("status") == "FAIL":
        suggestions.append("What exact changes will make this test pass?")
        suggestions.append("Redo the test after fixing the top root cause")

    if report.get("regressions"):
        suggestions.append("When did this regression get introduced?")

    if report.get("trend", {}).get("trend") == "degrading":
        suggestions.append("Is this a memory leak? How do I confirm?")

    if report.get("correlations"):
        suggestions.append("How do I fix the infrastructure bottleneck?")

    suggestions.extend([
        "Give me an executive summary for my manager",
        "Redo the test with double the users",
        "What should I monitor in production to catch this early?",
        "Is the system ready for a 2x traffic increase?",
        "Export this report as HTML",
    ])
    return suggestions[:6]
