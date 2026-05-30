"""
JMeter Correlation Agent — AI-Powered Dynamic Value Extraction

The #1 pain point for QA teams using JMeter: manually identifying and correlating
dynamic values (session IDs, CSRF tokens, auth tokens, etc.) in recorded scripts.

This agent:
1. Analyzes a JMX test plan (or HAR recording)
2. Uses AI to identify dynamic values in responses that need correlation
3. Automatically generates Regular Expression / JSON Path extractors
4. Injects correlation extractors into the JMX at the correct positions
5. Replaces hardcoded dynamic values with variable references

Typical time savings: 4-8 hours of manual work → 2-3 minutes.
"""
import json
import re
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional, Tuple
from agents.gemini_client import call_gemini, call_gemini_json


# ─────────────────────────────────────────────────────────────────
# Known dynamic value patterns (pre-AI heuristics for speed)
# ─────────────────────────────────────────────────────────────────
DYNAMIC_PATTERNS = {
    "session_id": {
        "patterns": [
            r"(?:JSESSIONID|jsessionid|session_id|sessionId|SessionID|sid|PHPSESSID|ASP\.NET_SessionId|connect\.sid)\s*[=:]\s*([A-Za-z0-9\-_.]+)",
        ],
        "description": "HTTP Session ID",
        "priority": 1,
    },
    "csrf_token": {
        "patterns": [
            r"(?:csrf[_-]?token|_csrf|csrfmiddlewaretoken|authenticity_token|__RequestVerificationToken|_token)\s*[=:\"']\s*([A-Za-z0-9\-_./+=]+)",
        ],
        "description": "CSRF / Anti-forgery Token",
        "priority": 1,
    },
    "auth_token": {
        "patterns": [
            r"(?:Bearer|bearer)\s+([A-Za-z0-9\-_./+=]+)",
            r"(?:access_token|accessToken|id_token|refresh_token|api_key|apiKey|Authorization)\s*[=:\"']\s*([A-Za-z0-9\-_./+=]+)",
        ],
        "description": "Authentication / Bearer Token",
        "priority": 1,
    },
    "uuid": {
        "patterns": [
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        ],
        "description": "UUID / GUID",
        "priority": 2,
    },
    "nonce": {
        "patterns": [
            r"(?:nonce|_nonce)\s*[=:\"']\s*([A-Za-z0-9\-_./+=]+)",
        ],
        "description": "Nonce / One-time Value",
        "priority": 2,
    },
    "timestamp_token": {
        "patterns": [
            r"(?:timestamp|ts|_ts)\s*[=:\"']\s*(\d{10,13})",
        ],
        "description": "Server-generated Timestamp",
        "priority": 3,
    },
    "viewstate": {
        "patterns": [
            r"__VIEWSTATE[=:\"']\s*([A-Za-z0-9\-_./+=]+)",
            r"__EVENTVALIDATION[=:\"']\s*([A-Za-z0-9\-_./+=]+)",
        ],
        "description": "ASP.NET ViewState",
        "priority": 1,
    },
}


async def analyze_jmx_for_correlation(jmx_content: str) -> Dict[str, Any]:
    """
    Analyze a JMX file and identify all dynamic values that need correlation.

    Returns:
        {
            "correlations_found": [...],
            "correlated_jmx": "...",  # The fixed JMX
            "summary": "...",
            "time_saved_hours": float,
        }
    """
    # Step 1: Parse the JMX and extract all samplers
    samplers = _extract_samplers_from_jmx(jmx_content)

    # Step 2: Quick heuristic scan for known patterns
    heuristic_findings = _heuristic_scan(jmx_content)

    # Step 3: AI-powered deep analysis
    ai_findings = await _ai_correlation_analysis(jmx_content, samplers, heuristic_findings)

    # Step 4: Generate extractors and correlate
    correlated_jmx, correlation_report = _apply_correlations(jmx_content, ai_findings)

    # Step 5: Validate the correlated JMX
    validation = _validate_jmx(correlated_jmx)

    return {
        "correlations_found": correlation_report,
        "total_correlations": len(correlation_report),
        "correlated_jmx": correlated_jmx,
        "original_samplers": len(samplers),
        "heuristic_matches": len(heuristic_findings),
        "ai_discoveries": len(ai_findings),
        "validation": validation,
        "summary": _generate_summary(correlation_report, samplers),
        "time_saved_hours": max(2, len(correlation_report) * 0.5),  # ~30 min per correlation manually
    }


def _extract_samplers_from_jmx(jmx_content: str) -> List[Dict]:
    """Parse JMX XML and extract HTTP sampler details."""
    samplers = []
    try:
        root = ET.fromstring(jmx_content)
        for sampler in root.iter("HTTPSamplerProxy"):
            name = sampler.get("testname", "Unknown")
            enabled = sampler.get("enabled", "true")

            # Extract URL components
            domain = ""
            path = ""
            method = "GET"
            protocol = "https"

            for prop in sampler.iter("stringProp"):
                attr_name = prop.get("name", "")
                if attr_name == "HTTPSampler.domain":
                    domain = prop.text or ""
                elif attr_name == "HTTPSampler.path":
                    path = prop.text or ""
                elif attr_name == "HTTPSampler.method":
                    method = prop.text or "GET"
                elif attr_name == "HTTPSampler.protocol":
                    protocol = prop.text or "https"

            # Extract parameters
            params = []
            for elem_prop in sampler.iter("elementProp"):
                if elem_prop.get("elementType") == "HTTPArgument":
                    param_name = ""
                    param_value = ""
                    for sp in elem_prop.iter("stringProp"):
                        if sp.get("name") == "Argument.name":
                            param_name = sp.text or ""
                        elif sp.get("name") == "Argument.value":
                            param_value = sp.text or ""
                    if param_name:
                        params.append({"name": param_name, "value": param_value})

            # Extract headers from HeaderManager siblings
            headers = []
            # Headers would be in a HeaderManager associated with this sampler

            samplers.append({
                "name": name,
                "enabled": enabled == "true",
                "domain": domain,
                "path": path,
                "method": method,
                "protocol": protocol,
                "params": params,
                "full_url": f"{protocol}://{domain}{path}" if domain else path,
            })
    except ET.ParseError as e:
        samplers.append({"parse_error": str(e)})

    return samplers


def _heuristic_scan(jmx_content: str) -> List[Dict]:
    """Fast regex-based scan for known dynamic value patterns."""
    findings = []
    for pattern_name, pattern_info in DYNAMIC_PATTERNS.items():
        for regex in pattern_info["patterns"]:
            matches = re.finditer(regex, jmx_content, re.IGNORECASE)
            for match in matches:
                value = match.group(1) if match.lastindex else match.group(0)
                # Skip if it looks like a JMeter variable reference already
                if "${" in value:
                    continue
                findings.append({
                    "type": pattern_name,
                    "description": pattern_info["description"],
                    "value_found": value[:80],  # Truncate long values
                    "position": match.start(),
                    "priority": pattern_info["priority"],
                    "detection_method": "heuristic",
                })

    # Deduplicate by value
    seen_values = set()
    unique = []
    for f in findings:
        if f["value_found"] not in seen_values:
            seen_values.add(f["value_found"])
            unique.append(f)

    return sorted(unique, key=lambda x: x["priority"])


async def _ai_correlation_analysis(
    jmx_content: str,
    samplers: List[Dict],
    heuristic_findings: List[Dict],
) -> List[Dict]:
    """
    Use AI to perform deep correlation analysis.
    The AI understands HTTP flow semantics and can identify correlations
    that heuristics miss (e.g., custom IDs, pagination tokens, order IDs).
    """
    # Truncate JMX for context window
    jmx_truncated = jmx_content[:15000] if len(jmx_content) > 15000 else jmx_content

    sampler_summary = json.dumps(samplers[:20], indent=2)  # First 20 samplers
    heuristic_summary = json.dumps(heuristic_findings[:10], indent=2)

    prompt = f"""You are an expert JMeter performance engineer specializing in script correlation.

Analyze this JMeter test plan (JMX) and identify ALL dynamic values that need to be correlated.

WHAT IS CORRELATION:
When a web app returns a dynamic value (session ID, token, order ID, etc.) in one response,
and that same value must be sent in subsequent requests, we need to:
1. EXTRACT the value from the response using a Regular Expression Extractor or JSON Path Extractor
2. REPLACE the hardcoded value in subsequent requests with a JMeter variable reference ${{variable_name}}

SAMPLERS IN THIS TEST PLAN:
{sampler_summary}

HEURISTIC FINDINGS (already detected):
{heuristic_summary}

JMX CONTENT (partial):
{jmx_truncated}

For each dynamic value that needs correlation, return:
{{
  "correlations": [
    {{
      "variable_name": "sessionId",
      "description": "Server session identifier",
      "source_sampler": "Login Request",
      "source_location": "response_headers|response_body|json_response",
      "extraction_type": "regex|jsonpath|xpath|boundary",
      "extraction_expression": "the regex or jsonpath expression",
      "target_samplers": ["Dashboard Request", "API Call"],
      "target_location": "parameter|header|path|body",
      "target_param_name": "the parameter name to replace",
      "priority": "critical|high|medium",
      "hardcoded_value_example": "abc123...",
      "default_value": "NOT_FOUND"
    }}
  ]
}}

Rules:
- Include ALL correlations needed, not just the obvious ones
- Use descriptive variable names (camelCase)
- For regex extractors, use capturing groups
- Check for tokens in: Set-Cookie headers, JSON response bodies, HTML hidden fields, URL parameters
- Look for values that appear in one response and reappear in subsequent requests
- Include anti-patterns: values that LOOK dynamic but are actually static (mark as priority: "skip")

Return ONLY valid JSON."""

    result = await call_gemini_json(prompt, temperature=0.1, task_type="reasoning")

    if isinstance(result, dict) and "correlations" in result:
        correlations = result["correlations"]
        # Filter out skips and add detection method
        return [
            {**c, "detection_method": "ai"}
            for c in correlations
            if c.get("priority") != "skip"
        ]

    return []


def _apply_correlations(jmx_content: str, ai_findings: List[Dict]) -> Tuple[str, List[Dict]]:
    """
    Apply correlation extractors to the JMX content.
    Generates JMeter extractor elements and injects them into the test plan.
    """
    report = []
    modified_jmx = jmx_content

    for finding in ai_findings:
        var_name = finding.get("variable_name", "corr_var")
        extraction_type = finding.get("extraction_type", "regex")
        expression = finding.get("extraction_expression", "")
        source = finding.get("source_sampler", "")
        description = finding.get("description", "")
        default_value = finding.get("default_value", "NOT_FOUND")

        if not expression:
            continue

        # Generate the extractor XML element
        if extraction_type == "jsonpath":
            extractor_xml = _generate_json_extractor(var_name, expression, default_value)
        elif extraction_type == "xpath":
            extractor_xml = _generate_xpath_extractor(var_name, expression, default_value)
        elif extraction_type == "boundary":
            extractor_xml = _generate_boundary_extractor(var_name, expression, default_value)
        else:
            extractor_xml = _generate_regex_extractor(var_name, expression, default_value)

        # Try to inject after the source sampler
        injection_point = _find_injection_point(modified_jmx, source)
        if injection_point > 0:
            modified_jmx = (
                modified_jmx[:injection_point]
                + "\n" + extractor_xml + "\n"
                + modified_jmx[injection_point:]
            )

        # Replace hardcoded values in target samplers
        hardcoded = finding.get("hardcoded_value_example", "")
        if hardcoded and len(hardcoded) > 5:
            # Only replace if the value is specific enough to be safe
            replacement = "${" + var_name + "}"
            count = modified_jmx.count(hardcoded)
            if 0 < count <= 20:  # Sanity check — don't replace too many
                modified_jmx = modified_jmx.replace(hardcoded, replacement)

        report.append({
            "variable_name": var_name,
            "description": description,
            "extraction_type": extraction_type,
            "expression": expression,
            "source_sampler": source,
            "target_samplers": finding.get("target_samplers", []),
            "priority": finding.get("priority", "medium"),
            "detection_method": finding.get("detection_method", "ai"),
            "status": "applied",
        })

    return modified_jmx, report


def _generate_regex_extractor(var_name: str, expression: str, default: str = "NOT_FOUND") -> str:
    """Generate a JMeter Regular Expression Extractor XML element."""
    return f"""          <RegexExtractor guiclass="RegexExtractorGui" testclass="RegexExtractor" testname="Extract: {var_name}" enabled="true">
            <stringProp name="RegexExtractor.useHeaders">false</stringProp>
            <stringProp name="RegexExtractor.refname">{var_name}</stringProp>
            <stringProp name="RegexExtractor.regex">{_xml_escape(expression)}</stringProp>
            <stringProp name="RegexExtractor.template">$1$</stringProp>
            <stringProp name="RegexExtractor.default">{default}</stringProp>
            <stringProp name="RegexExtractor.match_number">1</stringProp>
          </RegexExtractor>
          <hashTree/>"""


def _generate_json_extractor(var_name: str, expression: str, default: str = "NOT_FOUND") -> str:
    """Generate a JMeter JSON Path Extractor XML element."""
    return f"""          <JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extract JSON: {var_name}" enabled="true">
            <stringProp name="JSONPostProcessor.referenceNames">{var_name}</stringProp>
            <stringProp name="JSONPostProcessor.jsonPathExprs">{_xml_escape(expression)}</stringProp>
            <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
            <stringProp name="JSONPostProcessor.defaultValues">{default}</stringProp>
          </JSONPostProcessor>
          <hashTree/>"""


def _generate_xpath_extractor(var_name: str, expression: str, default: str = "NOT_FOUND") -> str:
    """Generate a JMeter XPath Extractor XML element."""
    return f"""          <XPathExtractor guiclass="XPathExtractorGui" testclass="XPathExtractor" testname="Extract XPath: {var_name}" enabled="true">
            <stringProp name="XPathExtractor.refname">{var_name}</stringProp>
            <stringProp name="XPathExtractor.xpathQuery">{_xml_escape(expression)}</stringProp>
            <stringProp name="XPathExtractor.default">{default}</stringProp>
            <stringProp name="XPathExtractor.tolerant">true</stringProp>
          </XPathExtractor>
          <hashTree/>"""


def _generate_boundary_extractor(var_name: str, expression: str, default: str = "NOT_FOUND") -> str:
    """Generate a JMeter Boundary Extractor XML element."""
    # Expression expected as "left_boundary|||right_boundary"
    parts = expression.split("|||")
    left = parts[0] if len(parts) > 0 else ""
    right = parts[1] if len(parts) > 1 else ""
    return f"""          <BoundaryExtractor guiclass="BoundaryExtractorGui" testclass="BoundaryExtractor" testname="Extract Boundary: {var_name}" enabled="true">
            <stringProp name="BoundaryExtractor.useHeaders">false</stringProp>
            <stringProp name="BoundaryExtractor.refname">{var_name}</stringProp>
            <stringProp name="BoundaryExtractor.lboundary">{_xml_escape(left)}</stringProp>
            <stringProp name="BoundaryExtractor.rboundary">{_xml_escape(right)}</stringProp>
            <stringProp name="BoundaryExtractor.default">{default}</stringProp>
            <stringProp name="BoundaryExtractor.match_number">1</stringProp>
          </BoundaryExtractor>
          <hashTree/>"""


def _find_injection_point(jmx_content: str, sampler_name: str) -> int:
    """Find the correct position to inject an extractor after a sampler's hashTree."""
    if not sampler_name:
        return -1

    # Find the sampler by test name
    escaped_name = re.escape(sampler_name)
    pattern = rf'testname="{escaped_name}"'
    match = re.search(pattern, jmx_content)
    if not match:
        # Try partial match
        pattern = rf'testname="[^"]*{escaped_name}[^"]*"'
        match = re.search(pattern, jmx_content, re.IGNORECASE)

    if not match:
        return -1

    # Find the closing </HTTPSamplerProxy> after this match
    pos = match.end()
    close_tag = "</HTTPSamplerProxy>"
    close_pos = jmx_content.find(close_tag, pos)
    if close_pos < 0:
        return -1

    # Find the <hashTree> that follows
    hash_tree_pos = jmx_content.find("<hashTree", close_pos)
    if hash_tree_pos < 0 or hash_tree_pos - close_pos > 200:
        # hashTree should be close after the sampler
        return close_pos + len(close_tag)

    # Find the matching </hashTree> or the next element inside it
    inner_pos = jmx_content.find(">", hash_tree_pos)
    if inner_pos < 0:
        return -1

    # Check if it's self-closing <hashTree/>
    if jmx_content[inner_pos - 1] == "/":
        # Self-closing — we need to expand it
        return inner_pos + 1
    else:
        # Open tag — inject right after the opening tag
        return inner_pos + 1


def _validate_jmx(jmx_content: str) -> Dict:
    """Basic validation that the correlated JMX is still valid XML."""
    try:
        ET.fromstring(jmx_content)
        return {"valid": True, "message": "JMX is valid XML"}
    except ET.ParseError as e:
        return {"valid": False, "message": f"XML parse error: {str(e)}"}


def _generate_summary(correlations: List[Dict], samplers: List[Dict]) -> str:
    """Generate a human-readable summary of the correlation work."""
    if not correlations:
        return "No dynamic correlations were needed in this test plan."

    critical = [c for c in correlations if c.get("priority") == "critical"]
    high = [c for c in correlations if c.get("priority") == "high"]
    medium = [c for c in correlations if c.get("priority") == "medium"]

    summary = f"**Correlation Analysis Complete**\n\n"
    summary += f"📊 **{len(correlations)}** dynamic values identified and correlated across **{len(samplers)}** HTTP samplers.\n\n"

    if critical:
        summary += f"🔴 **{len(critical)} Critical** (sessions/auth): {', '.join(c['variable_name'] for c in critical)}\n"
    if high:
        summary += f"🟡 **{len(high)} High** (tokens/CSRF): {', '.join(c['variable_name'] for c in high)}\n"
    if medium:
        summary += f"🟢 **{len(medium)} Medium** (IDs/timestamps): {', '.join(c['variable_name'] for c in medium)}\n"

    summary += f"\n⏱️ Estimated time saved: **{max(2, len(correlations) * 0.5):.0f} hours** of manual correlation work."
    return summary


def _xml_escape(text: str) -> str:
    """Escape special XML characters."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


# ─────────────────────────────────────────────────────────────────
# HAR → JMX Conversion
# ─────────────────────────────────────────────────────────────────

async def convert_har_to_jmx(har_content: str, project_name: str = "Recorded Test") -> Dict[str, Any]:
    """
    Convert a HAR (HTTP Archive) file to a JMeter JMX test plan.
    Then auto-correlate the generated JMX.
    """
    try:
        har = json.loads(har_content)
    except json.JSONDecodeError:
        return {"error": "Invalid HAR JSON format"}

    entries = har.get("log", {}).get("entries", [])
    if not entries:
        return {"error": "No HTTP entries found in HAR file"}

    # Filter to actual API/page requests (skip static assets by default)
    filtered = [
        e for e in entries
        if not any(
            e.get("request", {}).get("url", "").endswith(ext)
            for ext in [".css", ".js", ".png", ".jpg", ".gif", ".ico", ".svg", ".woff", ".woff2", ".ttf"]
        )
    ]

    # Use AI to generate a clean JMX from the HAR entries
    entries_summary = []
    for e in filtered[:30]:  # Limit to 30 requests for context window
        req = e.get("request", {})
        resp = e.get("response", {})
        entries_summary.append({
            "method": req.get("method", "GET"),
            "url": req.get("url", ""),
            "headers": [{"name": h["name"], "value": h["value"][:50]} for h in req.get("headers", [])[:5]],
            "postData": (req.get("postData", {}).get("text", ""))[:200],
            "status": resp.get("status", 0),
            "response_content_type": resp.get("content", {}).get("mimeType", ""),
        })

    prompt = f"""You are a JMeter expert. Convert these recorded HTTP requests into a valid JMeter JMX test plan.

PROJECT NAME: {project_name}
RECORDED REQUESTS ({len(entries_summary)} total):
{json.dumps(entries_summary, indent=2)}

Generate a complete JMX XML test plan with:
1. A Thread Group with 1 user (for recording baseline)
2. HTTP Request Defaults with the base domain
3. Each request as an HTTPSamplerProxy with correct method, path, headers, and body
4. A Results Tree listener
5. Cookie Manager
6. Header Manager with common headers

Return ONLY valid JMX XML, no explanation or markdown fences."""

    jmx = await call_gemini(prompt, temperature=0.1, task_type="fast")

    # Clean up potential markdown fences
    jmx = jmx.replace("```xml", "").replace("```", "").strip()

    # Auto-correlate the generated JMX
    correlation_result = await analyze_jmx_for_correlation(jmx)

    return {
        "original_har_requests": len(entries),
        "filtered_requests": len(filtered),
        "generated_jmx": correlation_result.get("correlated_jmx", jmx),
        "correlations": correlation_result.get("correlations_found", []),
        "summary": correlation_result.get("summary", ""),
    }


# ─────────────────────────────────────────────────────────────────
# JMX Optimization Agent
# ─────────────────────────────────────────────────────────────────

async def optimize_jmx(jmx_content: str) -> Dict[str, Any]:
    """
    Analyze an existing JMX for best practices and optimization opportunities.
    """
    jmx_truncated = jmx_content[:12000]

    prompt = f"""You are a senior JMeter performance engineer. Review this JMX test plan and identify:

1. **Configuration Issues**: Missing timers, incorrect thread group settings, missing cookie managers
2. **Performance Anti-patterns**: Listeners that slow down distributed tests, unnecessary regex extractors
3. **Best Practice Violations**: Missing assertions, hardcoded values, no parameterization
4. **Optimization Opportunities**: Better think times, connection pooling, HTTP defaults

JMX CONTENT:
{jmx_truncated}

Return JSON with this structure:
{{
  "issues": [
    {{
      "severity": "critical|warning|info",
      "category": "configuration|performance|best_practice|optimization",
      "description": "What's wrong",
      "recommendation": "How to fix it",
      "estimated_impact": "What improvement to expect"
    }}
  ],
  "overall_quality_score": 0-100,
  "summary": "One paragraph assessment"
}}"""

    result = await call_gemini_json(prompt, temperature=0.2, task_type="reasoning")
    return result if isinstance(result, dict) else {"issues": [], "overall_quality_score": 50, "summary": "Unable to analyze."}
