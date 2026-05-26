import json
from typing import Dict, Any, List
from ml.anomaly_detector import AnomalyDetector
from ml.kpi_calculator import KPICalculator
from ml.correlation_engine import CorrelationEngine
from agents.gemini_client import call_gemini

detector = AnomalyDetector()
kpi_calc = KPICalculator()
correlator = CorrelationEngine()

async def run_analysis_agent(
    metrics: List[Dict],
    infra_metrics: List[Dict],
    scenario: Dict[str, Any],
    baseline: List[Dict] = None,
) -> Dict[str, Any]:
    """
    Analysis Agent: Runs the full ML pipeline and produces structured findings.
    """
    # 1. Compute KPIs
    kpis = kpi_calc.compute(metrics)

    # 2. Detect anomalies
    anomalies = detector.detect(metrics)
    trend = detector.detect_trend(metrics)

    # 3. Cross-layer correlation
    correlations = correlator.correlate(metrics, infra_metrics) if infra_metrics else []

    # 4. Regression check vs baseline
    regressions = []
    if baseline:
        regressions = _check_regression(kpis, baseline, scenario)

    # 5. Root cause ranking
    root_causes = _rank_root_causes(anomalies, correlations, trend, kpis, scenario)

    # 6. Generate pass/fail verdict
    sla = scenario.get("sla_targets", {})
    verdict = _compute_verdict(kpis, sla, anomalies, regressions)

    return {
        "kpis": kpis,
        "anomalies": anomalies,
        "trend": trend,
        "correlations": correlations,
        "regressions": regressions,
        "root_causes": root_causes,
        "verdict": verdict,
        "sla_targets": sla,
    }

def _check_regression(kpis: Dict, baseline: List[Dict], scenario: Dict) -> List[Dict]:
    regressions = []
    baseline_map = {b["endpoint"]: b for b in baseline}

    for ep, ep_kpis in kpis.get("by_endpoint", {}).items():
        b = baseline_map.get(ep)
        if not b:
            continue
        for metric in ["p99_ms", "p95_ms", "p50_ms", "error_rate"]:
            current_val = ep_kpis.get(metric, 0)
            baseline_val = b.get(metric, 0)
            if baseline_val > 0:
                delta_pct = ((current_val - baseline_val) / baseline_val) * 100
                if delta_pct > 10:
                    regressions.append({
                        "endpoint": ep,
                        "metric": metric,
                        "current": round(current_val, 1),
                        "baseline": round(baseline_val, 1),
                        "delta_pct": round(delta_pct, 1),
                        "severity": "CRITICAL" if delta_pct > 50 else "WARNING",
                    })
    return regressions

def _rank_root_causes(
    anomalies: List[Dict], correlations: List[Dict],
    trend: Dict, kpis: Dict, scenario: Dict
) -> List[Dict]:
    causes = []

    # From correlations
    for corr in correlations[:3]:
        if abs(corr["correlation"]) > 0.7:
            causes.append({
                "rank": len(causes) + 1,
                "cause": corr["interpretation"],
                "metric": corr["infra_metric"],
                "confidence": corr["confidence"],
                "evidence": f"Pearson correlation: {corr['correlation']} with {corr.get('lag_seconds', 0)}s lag",
                "type": "infrastructure",
            })

    # From trend
    if trend.get("trend") == "degrading":
        causes.append({
            "rank": len(causes) + 1,
            "cause": "Gradual performance degradation — possible memory leak or resource exhaustion",
            "metric": "response_time_trend",
            "confidence": int(trend.get("r_squared", 0.5) * 100),
            "evidence": trend.get("verdict", ""),
            "type": "trend",
        })

    # From anomaly patterns
    critical_anomalies = [a for a in anomalies if a.get("severity") == "CRITICAL"]
    if critical_anomalies:
        most_severe = max(critical_anomalies, key=lambda x: x.get("spike_ratio", 1))
        causes.append({
            "rank": len(causes) + 1,
            "cause": f"Acute latency spike detected at {most_severe.get('timestamp_label', 'unknown time')}",
            "metric": "latency_spike",
            "confidence": most_severe.get("confidence", 80),
            "evidence": f"Response time peaked at {most_severe.get('window_mean_ms', 0)}ms (baseline: {most_severe.get('baseline_mean_ms', 0)}ms) — {most_severe.get('spike_ratio', 1)}x increase",
            "type": "anomaly",
        })

    # Error-based cause
    if kpis.get("error_rate_pct", 0) > 5:
        causes.append({
            "rank": len(causes) + 1,
            "cause": "High error rate indicating service failure or misconfiguration",
            "metric": "error_rate",
            "confidence": min(99, int(kpis.get("error_rate_pct", 0) * 5)),
            "evidence": f"Error rate: {kpis.get('error_rate_pct')}% (threshold: 1%)",
            "type": "error",
        })

    # Re-rank by confidence
    causes.sort(key=lambda x: x["confidence"], reverse=True)
    for i, c in enumerate(causes):
        c["rank"] = i + 1

    return causes

def _compute_verdict(kpis: Dict, sla: Dict, anomalies: List, regressions: List) -> Dict:
    failures = []
    warnings = []

    p99 = kpis.get("p99_ms", 0)
    p99_sla = sla.get("p99_ms", 500)
    if p99 > p99_sla:
        failures.append(f"p99 {p99}ms exceeds SLA of {p99_sla}ms")

    err_pct = kpis.get("error_rate_pct", 0)
    err_sla = sla.get("error_rate_pct", 1.0)
    if err_pct > err_sla:
        failures.append(f"Error rate {err_pct}% exceeds SLA of {err_sla}%")

    critical_anomalies = [a for a in anomalies if a.get("severity") == "CRITICAL"]
    if critical_anomalies:
        warnings.append(f"{len(critical_anomalies)} critical anomaly/anomalies detected")

    critical_regressions = [r for r in regressions if r.get("severity") == "CRITICAL"]
    if critical_regressions:
        failures.append(f"{len(critical_regressions)} critical regression(s) vs baseline")

    status = "PASS" if not failures else "FAIL"
    return {
        "status": status,
        "failures": failures,
        "warnings": warnings,
        "health_score": kpis.get("health_score", 0),
        "apdex": kpis.get("apdex", 0),
        "summary": f"Test {status}: {'; '.join(failures) if failures else 'All SLAs met'}",
    }
