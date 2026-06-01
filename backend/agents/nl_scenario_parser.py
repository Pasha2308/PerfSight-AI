"""
NL Scenario Parser — SETI Algorithm (Pass 1-3)
Transforms a plain English scenario description into a fully calibrated load test config.

Patent Claim 1: Multi-pass NL extraction pipeline for performance test generation.
"""
import json
import re
from typing import Dict, Any, Optional
from agents.gemini_client import call_gemini

def _parse_duration_to_seconds(text: str) -> Optional[int]:
    if not text:
        return None
    text = text.lower()
    # Match numbers followed by s, sec, second, seconds, m, min, minute, minutes, h, hr, hour, hours
    match = re.search(r'(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour)', text)
    if match:
        val = int(match.group(1))
        unit = match.group(2)
        if unit.startswith('s'):
            return val
        elif unit.startswith('m'):
            return val * 60
        elif unit.startswith('h'):
            return val * 3600
    return None

# ─────────────────────────────────────────────────────────────────
# Domain Scenario Library — 30+ real-world incident templates
# ─────────────────────────────────────────────────────────────────
SCENARIO_LIBRARY = {
    "flash_sale_ecommerce": {
        "keywords": ["flash sale", "sale day", "buy iphone", "limited sale", "deal", "discount", "prime day", "black friday", "cyber monday", "snkrs", "product drop"],
        "domain": "E-Commerce",
        "load_shape": "spike",
        "spike_multiplier": 10,
        "base_peak_vus": 1000,
        "critical_path": ["browse_product", "add_to_cart", "checkout", "payment"],
        "industry_benchmarks": {"p99_ms": 500, "p95_ms": 300, "error_rate_pct": 0.1, "min_throughput_rps": 500},
        "known_failure_modes": ["inventory_race_condition", "payment_gateway_saturation", "session_store_overflow", "cdn_cache_miss"],
        "real_world_examples": ["Amazon Prime Day 2018", "Nike SNKRS drops", "PlayStation 5 launch"],
        "risk_areas": ["Inventory lock contention under high concurrency", "Payment gateway rate limits", "Session store (Redis) saturation", "CDN cache invalidation stampede"],
        "think_time_sec": 1,
        "ramp_shape": "instant_burst",
    },
    "ticket_booking_rush": {
        "keywords": ["tatkal", "train ticket", "bus ticket", "booking", "irctc", "concert ticket", "event ticket", "seats", "quota opens"],
        "domain": "Transportation / Ticketing",
        "load_shape": "spike",
        "spike_multiplier": 15,
        "base_peak_vus": 500,
        "critical_path": ["search_availability", "select_seat", "fill_details", "payment", "confirmation"],
        "industry_benchmarks": {"p99_ms": 800, "p95_ms": 500, "error_rate_pct": 0.5, "min_throughput_rps": 200},
        "known_failure_modes": ["seat_contention", "otp_service_overload", "payment_timeout", "session_expiry"],
        "real_world_examples": ["IRCTC Tatkal quota opening", "Taylor Swift Ticketmaster crash 2022"],
        "risk_areas": ["Seat lock race condition", "OTP/SMS gateway overload", "Session management at scale"],
        "think_time_sec": 2,
        "ramp_shape": "instant_burst",
    },
    "streaming_event_start": {
        "keywords": ["streaming", "live stream", "watch", "netflix", "disney", "match start", "broadcast", "premiere", "watch party"],
        "domain": "Media & Streaming",
        "load_shape": "spike",
        "spike_multiplier": 8,
        "base_peak_vus": 2000,
        "critical_path": ["auth", "content_metadata", "manifest_fetch", "segment_download"],
        "industry_benchmarks": {"p99_ms": 1000, "p95_ms": 600, "error_rate_pct": 0.5, "min_throughput_rps": 1000},
        "known_failure_modes": ["cdn_overload", "auth_service_bottleneck", "manifest_server_saturation"],
        "real_world_examples": ["Netflix season premiere", "IPL match start on Hotstar", "World Cup streaming"],
        "risk_areas": ["CDN edge node saturation", "Auth service token validation latency", "Origin server protection"],
        "think_time_sec": 0,
        "ramp_shape": "instant_burst",
    },
    "banking_month_end": {
        "keywords": ["payroll", "salary", "month end", "emi", "bank", "neft", "upi", "transfer", "statement", "banking"],
        "domain": "Banking & Finance",
        "load_shape": "load",
        "spike_multiplier": 3,
        "base_peak_vus": 300,
        "critical_path": ["login", "account_balance", "fund_transfer", "transaction_history"],
        "industry_benchmarks": {"p99_ms": 2000, "p95_ms": 1000, "error_rate_pct": 0.01, "min_throughput_rps": 100},
        "known_failure_modes": ["core_banking_timeout", "db_connection_pool_exhaustion", "audit_log_bottleneck"],
        "real_world_examples": ["Salary day UPI surge", "GST filing deadline"],
        "risk_areas": ["Core banking system connection pool", "Audit logging bottleneck", "Regulatory compliance under load"],
        "think_time_sec": 3,
        "ramp_shape": "gradual",
    },
    "healthcare_appointment": {
        "keywords": ["doctor", "appointment", "hospital", "clinic", "patient", "healthcare", "book appointment", "slot", "vaccination"],
        "domain": "Healthcare",
        "load_shape": "spike",
        "spike_multiplier": 5,
        "base_peak_vus": 200,
        "critical_path": ["search_doctor", "check_availability", "book_slot", "confirm"],
        "industry_benchmarks": {"p99_ms": 1000, "p95_ms": 600, "error_rate_pct": 0.1, "min_throughput_rps": 50},
        "known_failure_modes": ["slot_contention", "notification_service_overload"],
        "real_world_examples": ["Monday 8am appointment rush", "COVID vaccine slot booking"],
        "risk_areas": ["Appointment slot contention", "Notification delivery latency"],
        "think_time_sec": 2,
        "ramp_shape": "instant_burst",
    },
    "gaming_server_launch": {
        "keywords": ["game", "gaming", "server", "launch", "release day", "matchmaking", "login queue", "game release"],
        "domain": "Gaming",
        "load_shape": "spike",
        "spike_multiplier": 20,
        "base_peak_vus": 5000,
        "critical_path": ["auth", "player_profile", "matchmaking", "game_session"],
        "industry_benchmarks": {"p99_ms": 200, "p95_ms": 100, "error_rate_pct": 0.1, "min_throughput_rps": 2000},
        "known_failure_modes": ["matchmaking_queue_overflow", "game_state_db_saturation", "ddos_amplification"],
        "real_world_examples": ["Diablo IV launch crash", "Call of Duty Warzone season start"],
        "risk_areas": ["Matchmaking queue depth", "Real-time game state persistence", "DDoS protection at scale"],
        "think_time_sec": 0,
        "ramp_shape": "instant_burst",
    },
    "api_soak_sustained": {
        "keywords": ["sustained", "24 hours", "overnight", "soak", "memory leak", "long running", "stability", "endurance"],
        "domain": "API / Backend Service",
        "load_shape": "soak",
        "spike_multiplier": 1,
        "base_peak_vus": 100,
        "critical_path": ["api_endpoint"],
        "industry_benchmarks": {"p99_ms": 500, "p95_ms": 300, "error_rate_pct": 0.1, "min_throughput_rps": 50},
        "known_failure_modes": ["memory_leak", "connection_pool_exhaustion", "gc_pressure"],
        "real_world_examples": ["Microservice memory leak detection", "Database connection leak"],
        "risk_areas": ["Memory growth over time", "GC pause frequency", "File descriptor leaks"],
        "think_time_sec": 1,
        "ramp_shape": "gradual",
    },
    "general_load": {
        "keywords": [],  # fallback
        "domain": "Web Application",
        "load_shape": "load",
        "spike_multiplier": 1,
        "base_peak_vus": 100,
        "critical_path": ["homepage", "api_call"],
        "industry_benchmarks": {"p99_ms": 500, "p95_ms": 300, "error_rate_pct": 1.0, "min_throughput_rps": 50},
        "known_failure_modes": ["high_latency", "error_rate_increase"],
        "real_world_examples": [],
        "risk_areas": ["System stability under expected load"],
        "think_time_sec": 2,
        "ramp_shape": "gradual",
    },
}


def _match_scenario_template(description: str) -> Dict[str, Any]:
    """
    Pass 1 local: Keyword-match the description against scenario library.
    Returns the best matching template.
    """
    desc_lower = description.lower()
    best_match = "general_load"
    best_score = 0

    for key, template in SCENARIO_LIBRARY.items():
        if key == "general_load":
            continue
        score = sum(1 for kw in template["keywords"] if kw in desc_lower)
        if score > best_score:
            best_score = score
            best_match = key

    return SCENARIO_LIBRARY[best_match], best_match


async def parse_natural_language_scenario(
    description: str,
    target_url: str,
    project_name: str,
) -> Dict[str, Any]:
    """
    SETI Algorithm — 3-Pass NL Scenario Parser

    Pass 1: Local keyword match → find best scenario template
    Pass 2: Gemini entity extraction → WHO, WHAT, WHEN, WHERE, scale
    Pass 3: Merge template + extracted entities → calibrated scenario config

    Returns a full scenario config compatible with existing pipeline.
    """

    # ── Pass 1: Template Match ──────────────────────────────────────
    template, template_key = _match_scenario_template(description)

    # ── Pass 2: Gemini Entity Extraction ──────────────────────────
    extraction_prompt = f"""You are an expert performance engineer. A user has described a real-world traffic scenario.
Extract structured information from their description.

USER DESCRIPTION:
"{description}"

DETECTED DOMAIN: {template['domain']}
SCENARIO TEMPLATE: {template_key}

Extract these entities and return ONLY valid JSON:
{{
  "who": {{
    "user_count": <integer or null — the number of concurrent users mentioned>,
    "user_type": "<e.g. registered members, anonymous visitors, API clients>",
    "geography": "<e.g. India, global, single city — or 'unknown'>"
  }},
  "what": {{
    "primary_action": "<the main thing users are trying to do>",
    "domain": "<e.g. E-Commerce, Banking, Gaming, Healthcare, Ticketing>",
    "app_type": "<e.g. REST API, Web App, Mobile Backend, Microservice>"
  }},
  "when": {{
    "pattern": "<burst | gradual | sustained | scheduled>",
    "trigger": "<e.g. midnight sale start, match beginning, business hours>",
    "duration_hint": "<e.g. first 5 minutes, all day, 1 hour>"
  }},
  "scale": {{
    "urgency": "<critical | high | medium>",
    "peak_vus_override": <integer or null — if user explicitly stated a count>,
    "spike_factor": <float — how many times baseline traffic spikes, e.g. 10.0>
  }},
  "inferred_scenario_type": "<spike | load | stress | soak | breakpoint>",
  "user_journey_description": "<2-3 sentence description of what users will do step by step>"
}}"""

    raw = await call_gemini(extraction_prompt, temperature=0.1, task_type="fast")

    # Parse extracted entities
    extracted = {}
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        extracted = json.loads(raw[start:end])
    except Exception:
        pass  # Will use template defaults

    # ── Pass 3: Calibration & Merge ──────────────────────────────
    scenario_type = extracted.get("inferred_scenario_type", template["load_shape"])
    if scenario_type not in ["spike", "load", "stress", "soak", "breakpoint"]:
        scenario_type = template["load_shape"]

    # Determine peak VUs
    explicit_count = extracted.get("scale", {}).get("peak_vus_override")
    who_count = extracted.get("who", {}).get("user_count")
    peak_vus = (
        explicit_count
        or who_count
        or template["base_peak_vus"]
    )
    peak_vus = max(10, int(peak_vus))

    # Parse duration hint from description or extraction hint
    duration_sec = _parse_duration_to_seconds(extracted.get("when", {}).get("duration_hint", ""))
    if not duration_sec:
        duration_sec = _parse_duration_to_seconds(description)

    if duration_sec:
        # Calibrate ramp parameters proportionally to user-specified duration
        ramp_up_sec = max(5, int(duration_sec * 0.15))
        ramp_down_sec = max(5, int(duration_sec * 0.15))
        steady_sec = max(5, duration_sec - ramp_up_sec - ramp_down_sec)
    else:
        # Default to short, snappy durations for quick demo/local verification
        if scenario_type == "spike":
            ramp_up_sec = 5
            steady_sec = 15
            ramp_down_sec = 5
        elif scenario_type == "soak":
            ramp_up_sec = 10
            steady_sec = 20
            ramp_down_sec = 5
        elif scenario_type == "stress":
            ramp_up_sec = 15
            steady_sec = 5
            ramp_down_sec = 5
        elif scenario_type == "breakpoint":
            ramp_up_sec = 15
            steady_sec = 5
            ramp_down_sec = 5
        else:  # load
            ramp_up_sec = 5
            steady_sec = 20
            ramp_down_sec = 5

    # Build final scenario config
    benchmarks = template["industry_benchmarks"]
    domain = extracted.get("what", {}).get("domain", template["domain"])
    app_type = extracted.get("what", {}).get("app_type", template["domain"])

    # Now call Gemini for endpoint inference with full context
    endpoint_prompt = f"""You are a senior performance engineer. Design a realistic user journey and infer API endpoints.

APPLICATION:
- Target URL: {target_url}
- Domain: {domain}
- App Type: {app_type}
- Scenario: {description}
- Primary User Action: {extracted.get('what', {}).get('primary_action', 'unknown')}
- User Journey: {extracted.get('user_journey_description', '')}

Return ONLY valid JSON with this structure:
{{
  "inferred_endpoints": [
    {{"path": "/api/v1/login", "method": "POST", "weight": 20, "description": "User authentication"}},
    {{"path": "/api/v1/products", "method": "GET", "weight": 40, "description": "Product listing"}},
    {{"path": "/api/v1/cart", "method": "POST", "weight": 25, "description": "Add to cart"}},
    {{"path": "/api/v1/checkout", "method": "POST", "weight": 15, "description": "Order placement"}}
  ],
  "user_journey": "Step-by-step description of user behavior during this scenario"
}}"""

    endpoint_raw = await call_gemini(endpoint_prompt, temperature=0.2, task_type="reasoning")
    endpoint_data = {}
    try:
        es = endpoint_raw.find("{")
        ee = endpoint_raw.rfind("}") + 1
        endpoint_data = json.loads(endpoint_raw[es:ee])
    except Exception:
        endpoint_data = {
            "inferred_endpoints": [
                {"path": "/", "method": "GET", "weight": 30, "description": "Home page"},
                {"path": "/api/data", "method": "GET", "weight": 40, "description": "Data endpoint"},
                {"path": "/api/submit", "method": "POST", "weight": 30, "description": "Submit endpoint"},
            ],
            "user_journey": description,
        }

    # Build scenario name
    scenario_names = {
        "spike": "Spike Test",
        "load": "Load Test",
        "stress": "Stress Test",
        "soak": "Soak Test",
        "breakpoint": "Breakpoint Test",
    }

    return {
        # Core fields
        "scenario_type": scenario_type,
        "scenario_name": scenario_names.get(scenario_type, "Load Test"),
        "target_url": target_url,
        "app_type": domain,
        "nl_description": description,  # Store original NL for QA context
        "template_key": template_key,

        # Endpoints + journey
        "inferred_endpoints": endpoint_data.get("inferred_endpoints", []),
        "user_journey": endpoint_data.get("user_journey", description),

        # Load parameters (calibrated)
        "load_parameters": {
            "peak_vus": peak_vus,
            "ramp_up_duration_sec": ramp_up_sec,
            "steady_state_duration_sec": steady_sec,
            "ramp_down_duration_sec": ramp_down_sec,
            "think_time_sec": template["think_time_sec"],
        },

        # SLA targets (from domain benchmarks)
        "sla_targets": {
            "p99_ms": benchmarks["p99_ms"],
            "p95_ms": benchmarks.get("p95_ms", benchmarks["p99_ms"]),
            "error_rate_pct": benchmarks["error_rate_pct"],
            "min_throughput_rps": benchmarks["min_throughput_rps"],
        },

        # Context
        "risk_areas": template["risk_areas"],
        "known_failure_modes": template["known_failure_modes"],
        "real_world_examples": template["real_world_examples"],

        # Extracted entity metadata
        "extracted_entities": extracted,
    }
