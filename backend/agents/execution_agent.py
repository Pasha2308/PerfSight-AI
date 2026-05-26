import asyncio, random, time, math
from typing import Dict, Any, List, AsyncGenerator, Optional
from executors.real_executors import get_executor

async def simulate_test(
    scenario: Dict[str, Any],
    on_metric: callable,
    script: str = "",
    tool: str = "",
) -> List[Dict]:
    """
    Execution Agent: Routes to real k6/JMeter/Locust executors when available.
    Falls back to high-fidelity simulation if tools are not installed.
    """
    # ── Try real executor first ──────────────────────────────────
    if tool and script:
        executor = get_executor(tool)
        # Only use simulation fallback if real executor is SimulationExecutor
        from executors.real_executors import SimulationExecutor
        if not isinstance(executor, SimulationExecutor):
            return await executor.run(scenario, script, on_metric)

    # ── High-fidelity simulation ─────────────────────────────────
    load_params = scenario.get("load_parameters", {})
    endpoints = scenario.get("inferred_endpoints", [{"path": "/api/test", "method": "GET", "weight": 100}])
    scenario_type = scenario.get("scenario_type", "load")
    peak_vus = load_params.get("peak_vus", 100)
    ramp_up = load_params.get("ramp_up_duration_sec", 60)
    steady = load_params.get("steady_state_duration_sec", 120)
    ramp_down = load_params.get("ramp_down_duration_sec", 30)
    total_duration = ramp_up + steady + ramp_down

    # Scenario-specific parameters
    params = _get_scenario_params(scenario_type, peak_vus)

    all_metrics = []
    start_time = int(time.time() * 1000)
    current_time = start_time

    endpoint_weights = [e.get("weight", 10) for e in endpoints]
    total_weight = sum(endpoint_weights)
    endpoint_probs = [w / total_weight for w in endpoint_weights]

    steps = int(total_duration / 2)  # 2-second granularity
    for step in range(steps):
        progress = step / steps
        elapsed_sec = step * 2
        current_vus = _get_current_vus(scenario_type, progress, peak_vus, params)
        base_latency = _get_base_latency(scenario_type, progress, params)

        # Generate requests for this time window
        requests_in_window = max(1, int(current_vus * 0.8))
        for _ in range(requests_in_window):
            # Pick endpoint by weight
            ep_idx = random.choices(range(len(endpoints)), weights=endpoint_probs)[0]
            endpoint = endpoints[ep_idx]

            # Add realistic variance
            jitter = random.gauss(0, base_latency * 0.2)
            response_time = max(10, base_latency + jitter)

            # Occasional outliers (heavy requests)
            if random.random() < 0.02:
                response_time *= random.uniform(3, 8)

            # Error rate based on load
            error_threshold = _get_error_rate(scenario_type, progress, params)
            status_code = 500 if random.random() < error_threshold else (
                503 if random.random() < error_threshold * 0.3 else 200
            )

            metric = {
                "timestamp": current_time + random.randint(0, 1800),
                "endpoint": endpoint["path"],
                "method": endpoint.get("method", "GET"),
                "response_time": round(response_time, 1),
                "status_code": status_code,
                "vus": current_vus,
                "bytes": random.randint(500, 15000),
            }
            all_metrics.append(metric)

        # Simulate infra metrics
        infra = _generate_infra_metrics(scenario_type, progress, current_vus, peak_vus, current_time)

        await on_metric({
            "type": "metrics_batch",
            "elapsed_sec": elapsed_sec,
            "vus": current_vus,
            "metrics": all_metrics[-requests_in_window:],
            "infra": infra,
            "progress_pct": round(progress * 100),
        })

        current_time += 2000
        await asyncio.sleep(0.05)  # Fast simulation (50ms per step)

    return all_metrics

def _get_scenario_params(scenario_type: str, peak_vus: int) -> Dict:
    if scenario_type == "spike":
        return {"spike_at": 0.35, "spike_duration": 0.25, "spike_multiplier": 10, "base_latency": 180}
    elif scenario_type == "stress":
        return {"failure_point": 0.75, "base_latency": 150}
    elif scenario_type == "soak":
        return {"drift_rate": 0.4, "base_latency": 200}
    elif scenario_type == "breakpoint":
        return {"failure_point": 0.85, "base_latency": 140}
    else:  # load
        return {"base_latency": 160}

def _get_current_vus(scenario_type: str, progress: float, peak_vus: int, params: Dict) -> int:
    if scenario_type == "spike":
        spike_start = params["spike_at"]
        spike_end = spike_start + params["spike_duration"]
        if progress < 0.15:
            return max(5, int(peak_vus * 0.1 * (progress / 0.15)))
        elif spike_start <= progress <= spike_end:
            spike_progress = (progress - spike_start) / 0.05 if progress < spike_start + 0.05 else 1.0
            return int(peak_vus * min(params["spike_multiplier"], 1 + (params["spike_multiplier"]-1) * spike_progress))
        elif progress > spike_end and progress < spike_end + 0.1:
            return int(peak_vus * 0.1)
        else:
            return max(5, int(peak_vus * 0.1))
    elif scenario_type == "stress":
        return int(peak_vus * min(1.5, progress * 1.8))
    elif scenario_type == "soak":
        if progress < 0.1:
            return int(peak_vus * 0.5 * (progress / 0.1))
        return int(peak_vus * 0.5)
    else:  # load
        if progress < 0.2:
            return int(peak_vus * (progress / 0.2))
        elif progress > 0.85:
            return int(peak_vus * ((1 - progress) / 0.15))
        return peak_vus

def _get_base_latency(scenario_type: str, progress: float, params: Dict) -> float:
    base = params.get("base_latency", 180)
    if scenario_type == "spike":
        spike_start = params["spike_at"]
        spike_end = spike_start + params["spike_duration"]
        if spike_start <= progress <= spike_end:
            return base * random.uniform(8, 15)
        return base * random.uniform(0.9, 1.1)
    elif scenario_type == "stress":
        fail_pt = params.get("failure_point", 0.75)
        if progress > fail_pt:
            return base * (1 + (progress - fail_pt) * 20)
        return base * (1 + progress * 0.5)
    elif scenario_type == "soak":
        # Slowly drifts up (memory leak simulation)
        drift = 1 + params.get("drift_rate", 0.4) * progress
        return base * drift * random.uniform(0.9, 1.1)
    else:  # load
        return base * random.uniform(0.85, 1.15)

def _get_error_rate(scenario_type: str, progress: float, params: Dict) -> float:
    if scenario_type == "spike":
        spike_start = params["spike_at"]
        spike_end = spike_start + params["spike_duration"]
        if spike_start <= progress <= spike_end:
            return 0.15
        return 0.005
    elif scenario_type == "stress":
        fail_pt = params.get("failure_point", 0.75)
        if progress > fail_pt:
            return min(0.5, (progress - fail_pt) * 2)
        return 0.005
    return 0.005

def _generate_infra_metrics(
    scenario_type: str, progress: float, current_vus: int, peak_vus: int, ts: int
) -> Dict:
    load_factor = current_vus / max(peak_vus, 1)
    base_cpu = 20 + load_factor * 65
    base_mem = 40 + load_factor * 40

    if scenario_type == "spike" and 0.35 <= progress <= 0.6:
        base_cpu = min(99, base_cpu * 2.2)
        base_mem = min(95, base_mem * 1.3)
    elif scenario_type == "soak":
        base_mem = min(98, 40 + progress * 55)  # Memory leak

    return {
        "timestamp": ts,
        "cpu_pct": round(min(99, base_cpu + random.gauss(0, 3)), 1),
        "memory_pct": round(min(99, base_mem + random.gauss(0, 2)), 1),
        "network_mbps": round(load_factor * 80 + random.gauss(0, 5), 1),
        "db_connections": int(load_factor * 45 + random.gauss(0, 3)),
        "db_cpu_pct": round(min(99, base_cpu * 0.8 + random.gauss(0, 4)), 1),
        "gc_pause_ms": round(random.exponential(5) if scenario_type == "soak" and progress > 0.5 else random.exponential(2), 1),
    }
