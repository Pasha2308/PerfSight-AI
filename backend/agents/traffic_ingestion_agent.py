"""
PerfSight AI — Traffic Ingestion Agent (Use Case 2)
Parses production traffic from multiple sources:
  - Apache/Nginx access logs
  - JSON structured logs (CloudWatch, custom)
  - OpenTelemetry (OTLP) JSON trace exports
  - HAR files (browser traffic)

Then applies session clustering to identify realistic user journeys.
"""
import re
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

from agents.llm_router import call_llm, call_llm_json


# ─── Log Record Schema ────────────────────────────────────────────
class TrafficRecord:
    def __init__(
        self,
        timestamp: float,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        session_id: Optional[str] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        bytes_transferred: int = 0,
    ):
        self.timestamp = timestamp
        self.endpoint = endpoint
        self.method = method
        self.status_code = status_code
        self.duration_ms = duration_ms
        self.session_id = session_id
        self.ip = ip
        self.user_agent = user_agent
        self.bytes_transferred = bytes_transferred

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "endpoint": self.endpoint,
            "method": self.method,
            "status_code": self.status_code,
            "duration_ms": self.duration_ms,
            "session_id": self.session_id,
            "ip": self.ip,
        }


# ─── Parsers ─────────────────────────────────────────────────────

APACHE_PATTERN = re.compile(
    r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\w+) (?P<path>\S+) [^"]*" '
    r'(?P<status>\d+) (?P<bytes>\S+)'
    r'(?:\s+"[^"]*"\s+"[^"]*")?'
    r'(?:\s+(?P<duration>\d+))?'
)

NGINX_PATTERN = re.compile(
    r'(?P<ip>\S+) - \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\w+) (?P<path>\S+) [^"]*" '
    r'(?P<status>\d+) (?P<bytes>\d+) '
    r'"[^"]*" "[^"]*"'
    r'(?:\s+(?P<duration>[\d.]+))?'
)


def parse_apache_log(content: str) -> List[TrafficRecord]:
    records = []
    for line in content.splitlines():
        m = APACHE_PATTERN.match(line.strip())
        if not m:
            continue
        try:
            ts = datetime.strptime(m.group("time"), "%d/%b/%Y:%H:%M:%S %z").timestamp()
        except Exception:
            ts = 0.0
        duration_ms = float(m.group("duration") or 0) / 1000 if m.group("duration") else 100.0
        records.append(TrafficRecord(
            timestamp=ts,
            endpoint=m.group("path").split("?")[0],
            method=m.group("method"),
            status_code=int(m.group("status")),
            duration_ms=duration_ms,
            ip=m.group("ip"),
            bytes_transferred=int(m.group("bytes")) if m.group("bytes").isdigit() else 0,
        ))
    return records


def parse_json_logs(content: str) -> List[TrafficRecord]:
    records = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Flexible field detection
        endpoint = obj.get("path") or obj.get("url") or obj.get("request_path") or obj.get("http.target") or "/"
        method = obj.get("method") or obj.get("http.method") or obj.get("requestMethod") or "GET"
        status = int(obj.get("status") or obj.get("statusCode") or obj.get("http.status_code") or 200)
        duration = float(obj.get("duration") or obj.get("responseTime") or obj.get("durationMs") or obj.get("http.response_time_ms") or 100)
        ts = float(obj.get("timestamp") or obj.get("time") or obj.get("@timestamp") or 0)
        if ts > 1e12:  # milliseconds → seconds
            ts /= 1000
        ip = obj.get("ip") or obj.get("remoteAddr") or obj.get("client_ip") or ""
        session = obj.get("sessionId") or obj.get("session_id") or obj.get("userId") or ""

        records.append(TrafficRecord(
            timestamp=ts, endpoint=endpoint, method=method,
            status_code=status, duration_ms=duration,
            ip=ip, session_id=session,
        ))
    return records


def parse_otel_traces(content: str) -> List[TrafficRecord]:
    """Parse OpenTelemetry OTLP JSON trace export."""
    records = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return records

    resource_spans = data if isinstance(data, list) else data.get("resourceSpans", [])
    for rs in resource_spans:
        scope_spans = rs.get("scopeSpans", []) or rs.get("instrumentationLibrarySpans", [])
        for ss in scope_spans:
            for span in ss.get("spans", []):
                attrs = {a["key"]: a.get("value", {}).get("stringValue") or a.get("value", {}).get("intValue")
                         for a in span.get("attributes", [])}
                endpoint = attrs.get("http.target") or attrs.get("http.url") or attrs.get("url.path") or "/"
                method = attrs.get("http.method") or attrs.get("http.request.method") or "GET"
                status = int(attrs.get("http.status_code") or attrs.get("http.response.status_code") or 200)
                start_ns = int(span.get("startTimeUnixNano", 0))
                end_ns = int(span.get("endTimeUnixNano", 0))
                duration_ms = (end_ns - start_ns) / 1_000_000 if end_ns > start_ns else 100.0
                ts = start_ns / 1_000_000_000

                if endpoint and endpoint != "/":
                    records.append(TrafficRecord(
                        timestamp=ts, endpoint=endpoint, method=method,
                        status_code=status, duration_ms=duration_ms,
                        session_id=span.get("traceId", ""),
                    ))
    return records


def parse_har_traffic(content: str) -> List[TrafficRecord]:
    """Parse browser HAR file for traffic records."""
    records = []
    try:
        har = json.loads(content)
    except json.JSONDecodeError:
        return records

    entries = har.get("log", {}).get("entries", [])
    for entry in entries:
        req = entry.get("request", {})
        resp = entry.get("response", {})
        url = req.get("url", "")
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            endpoint = parsed.path or "/"
        except Exception:
            endpoint = url
        method = req.get("method", "GET")
        status = resp.get("status", 200)
        time_ms = float(entry.get("time", 100))

        records.append(TrafficRecord(
            timestamp=0.0, endpoint=endpoint, method=method,
            status_code=status, duration_ms=time_ms,
        ))
    return records


def detect_log_format(content: str) -> str:
    """Auto-detect the log format from content sample."""
    sample = content[:2000]
    if "resourceSpans" in sample or "scopeSpans" in sample or "startTimeUnixNano" in sample:
        return "otel"
    if '"log"' in sample and '"entries"' in sample:
        return "har"
    try:
        json.loads(sample.splitlines()[0])
        return "json"
    except Exception:
        pass
    if APACHE_PATTERN.match(sample.splitlines()[0] if sample else ""):
        return "apache"
    return "nginx"


# ─── Journey Clustering ──────────────────────────────────────────

def cluster_user_journeys(records: List[TrafficRecord], top_n: int = 5) -> List[Dict]:
    """
    Group records into user sessions, then cluster similar session flows.
    Returns top-N representative user journeys with frequency and think times.
    """
    # Group by session (IP as fallback)
    sessions: Dict[str, List[TrafficRecord]] = defaultdict(list)
    for r in sorted(records, key=lambda x: x.timestamp):
        key = r.session_id or r.ip or "unknown"
        sessions[key].append(r)

    # Build endpoint sequences per session (filter out assets/static)
    def is_api_endpoint(path: str) -> bool:
        skip = [".js", ".css", ".png", ".jpg", ".ico", ".svg", ".woff", ".map"]
        return not any(path.endswith(s) for s in skip)

    sequences = []
    for session_records in sessions.values():
        seq = [r for r in session_records if is_api_endpoint(r.endpoint)]
        if len(seq) >= 2:
            sequences.append(seq)

    if not sequences:
        return []

    # Simple frequency-based clustering: group by first 3 endpoints
    pattern_groups: Dict[str, List[List[TrafficRecord]]] = defaultdict(list)
    for seq in sequences:
        key = "→".join(r.endpoint for r in seq[:3])
        pattern_groups[key].append(seq)

    # Sort by frequency, take top-N
    sorted_patterns = sorted(pattern_groups.items(), key=lambda x: -len(x[1]))[:top_n]

    journeys = []
    total_sessions = len(sequences)

    for pattern_key, pattern_sessions in sorted_patterns:
        # Compute per-step stats across all sessions in this group
        # Align by endpoint
        endpoint_stats: Dict[str, Dict] = defaultdict(lambda: {"durations": [], "count": 0, "methods": []})
        think_times: Dict[str, List[float]] = defaultdict(list)

        for sess in pattern_sessions:
            prev_ts = None
            for r in sess:
                endpoint_stats[r.endpoint]["durations"].append(r.duration_ms)
                endpoint_stats[r.endpoint]["count"] += 1
                endpoint_stats[r.endpoint]["methods"].append(r.method)
                if prev_ts and r.timestamp > prev_ts:
                    think_times[r.endpoint].append((r.timestamp - prev_ts) * 1000)
                prev_ts = r.timestamp

        # Build representative journey steps
        # Use endpoints ordered by typical appearance
        endpoint_order = {}
        for sess in pattern_sessions:
            for i, r in enumerate(sess):
                if r.endpoint not in endpoint_order:
                    endpoint_order[r.endpoint] = i

        steps = []
        for ep, idx in sorted(endpoint_order.items(), key=lambda x: x[1]):
            stats = endpoint_stats[ep]
            durations = sorted(stats["durations"])
            p50 = durations[len(durations) // 2] if durations else 100
            think_ms = sorted(think_times[ep])[len(think_times[ep]) // 2] if think_times[ep] else 2000
            methods = stats["methods"]
            most_common_method = max(set(methods), key=methods.count) if methods else "GET"

            steps.append({
                "endpoint": ep,
                "method": most_common_method,
                "avg_duration_ms": round(p50),
                "think_time_ms": max(500, round(think_ms)),
                "hit_count": stats["count"],
            })

        frequency_pct = round(len(pattern_sessions) / total_sessions * 100, 1)

        # Generate a readable name using heuristics
        main_eps = [s["endpoint"] for s in steps[:3]]
        if any("login" in e or "auth" in e for e in main_eps):
            name = "Authentication Flow"
        elif any("cart" in e or "checkout" in e or "buy" in e or "order" in e for e in main_eps):
            name = "Purchase Journey"
        elif any("search" in e or "browse" in e or "product" in e for e in main_eps):
            name = "Browse & Search"
        elif any("api" in e for e in main_eps):
            name = f"API Workflow ({steps[0]['method']} {steps[0]['endpoint'][:30]})"
        else:
            name = f"User Journey ({steps[0]['endpoint'][:30]})"

        journeys.append({
            "name": name,
            "frequency_pct": frequency_pct,
            "session_count": len(pattern_sessions),
            "avg_steps": round(sum(len(s) for s in pattern_sessions) / len(pattern_sessions)),
            "steps": steps[:12],  # Cap at 12 steps per journey
        })

    return journeys


# ─── AI Script Generator ─────────────────────────────────────────

async def generate_script_from_journeys(
    journeys: List[Dict],
    target_base_url: str,
    tool: str,
    project_name: str,
    provider: str = "",
    api_key: str = "",
    model: str = "",
) -> Dict:
    """Use AI to generate a realistic load test script from clustered user journeys."""

    journeys_json = json.dumps(journeys, indent=2)

    prompt = f"""
You are a performance testing expert. Generate a realistic {tool} load test script based on these production user journeys.

Target Base URL: {target_base_url}
Project: {project_name}

User Journeys (from production traffic analysis):
{journeys_json}

Requirements:
1. Include ALL user journeys as separate scenarios/thread groups
2. Weight each scenario by its frequency_pct (e.g., 45% of virtual users do Journey 1)
3. Use the actual think_time_ms values between steps (these are REAL user delays from production)
4. Use the actual avg_duration_ms as a p95 SLA target per endpoint
5. Include correlation/extraction for dynamic values (session IDs, auth tokens, etc.)
6. Generate realistic test data (names, emails, etc.) — parameterize inputs
7. Include ramp-up: 0 → 100 VUs over 2 minutes, steady state 5 minutes, ramp-down 1 minute

Return a JSON object:
{{
  "script": "<full executable {tool} script as a string>",
  "language": "javascript" or "python" or "scala" or "java",
  "tool": "{tool}",
  "scenario_count": <number of journeys>,
  "peak_vus": 100,
  "estimated_duration_sec": 480,
  "parameterized_variables": ["list of variables to fill in"],
  "notes": "any important setup notes"
}}
"""

    result = await call_llm_json(prompt, temperature=0.3, task_type="fast",
                                  provider=provider, api_key=api_key, model=model)

    if "parse_error" in result:
        # Try to extract script from raw response
        raw = result.get("raw_response", "")
        return {
            "script": raw,
            "language": "javascript" if tool == "k6" else "java",
            "tool": tool,
            "scenario_count": len(journeys),
            "peak_vus": 100,
            "estimated_duration_sec": 480,
            "notes": "Script generated — verify before running",
        }

    return result


# ─── Main Entry Point ─────────────────────────────────────────────

async def analyze_traffic_file(
    content: str,
    filename: str,
    project_name: str,
    provider: str = "",
    api_key: str = "",
    model: str = "",
) -> Dict:
    """
    Full pipeline: parse logs → cluster journeys → return analysis.
    """
    # Detect format
    fmt = detect_log_format(content)
    print(f"[Traffic] Detected format: {fmt} for {filename}")

    # Parse records
    if fmt == "otel":
        records = parse_otel_traces(content)
    elif fmt == "har":
        records = parse_har_traffic(content)
    elif fmt == "json":
        records = parse_json_logs(content)
    else:
        records = parse_apache_log(content)

    print(f"[Traffic] Parsed {len(records)} traffic records")

    if len(records) < 5:
        return {
            "error": f"Too few records parsed ({len(records)}). Check file format.",
            "format_detected": fmt,
            "records_found": len(records),
        }

    # Cluster journeys
    journeys = cluster_user_journeys(records, top_n=5)

    # Compute overall stats
    all_durations = [r.duration_ms for r in records]
    all_errors = [r for r in records if r.status_code >= 400]
    sorted_durations = sorted(all_durations)
    n = len(sorted_durations)

    def pct(p): return sorted_durations[int(n * p / 100)] if n > 0 else 0

    # Get unique endpoints
    endpoints = {}
    for r in records:
        key = f"{r.method} {r.endpoint}"
        if key not in endpoints:
            endpoints[key] = {"method": r.method, "path": r.endpoint, "count": 0, "durations": []}
        endpoints[key]["count"] += 1
        endpoints[key]["durations"].append(r.duration_ms)

    endpoint_summary = []
    for ep_data in sorted(endpoints.values(), key=lambda x: -x["count"])[:20]:
        d = sorted(ep_data["durations"])
        m = len(d)
        endpoint_summary.append({
            "method": ep_data["method"],
            "path": ep_data["path"],
            "request_count": ep_data["count"],
            "p50_ms": round(d[m // 2]) if d else 0,
            "p95_ms": round(d[int(m * 0.95)]) if d else 0,
            "p99_ms": round(d[int(m * 0.99)]) if d else 0,
        })

    # AI summary
    summary_prompt = f"""
Analyze this production traffic data and provide a brief (3-4 sentences) performance assessment.

Total Requests: {len(records)}
Format: {fmt}
Unique Endpoints: {len(endpoints)}
p50 Latency: {round(pct(50))}ms
p95 Latency: {round(pct(95))}ms
p99 Latency: {round(pct(99))}ms
Error Rate: {round(len(all_errors) / max(len(records), 1) * 100, 2)}%
User Journeys Detected: {len(journeys)}

Top Endpoints: {json.dumps(endpoint_summary[:5], indent=2)}
"""
    ai_summary = await call_llm(summary_prompt, temperature=0.4, task_type="fast",
                                 provider=provider, api_key=api_key, model=model)

    return {
        "format_detected": fmt,
        "total_records": len(records),
        "unique_endpoints": len(endpoints),
        "error_rate_pct": round(len(all_errors) / max(len(records), 1) * 100, 2),
        "p50_ms": round(pct(50)),
        "p95_ms": round(pct(95)),
        "p99_ms": round(pct(99)),
        "journeys": journeys,
        "endpoints": endpoint_summary,
        "ai_summary": ai_summary,
        "records": [r.to_dict() for r in records[:500]],  # Cap for payload size
    }
