import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Any

class KPICalculator:
    """Computes standard performance KPIs from raw metric data."""

    def compute(self, metrics: List[Dict]) -> Dict[str, Any]:
        if not metrics:
            return {}

        df = pd.DataFrame(metrics)
        df["response_time"] = pd.to_numeric(df["response_time"], errors="coerce")
        df["status_code"] = pd.to_numeric(df["status_code"], errors="coerce")
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")

        total = len(df)
        errors = df[df["status_code"] >= 400]
        error_count = len(errors)

        rt = df["response_time"].dropna()
        duration_sec = (df["timestamp"].max() - df["timestamp"].min()) / 1000.0 if total > 1 else 1

        # Apdex: T = p95
        T = float(rt.quantile(0.95)) if len(rt) > 0 else 500
        satisfied = len(rt[rt <= T])
        tolerating = len(rt[(rt > T) & (rt <= 4 * T)])
        apdex = round((satisfied + tolerating / 2) / total, 3) if total > 0 else 0

        # Health score 0-100
        error_pct = (error_count / total * 100) if total > 0 else 0
        apdex_score_norm = apdex * 60
        error_penalty = min(error_pct * 3, 40)
        health_score = max(0, int(apdex_score_norm + (100 - 60) - error_penalty))

        by_endpoint = {}
        if "endpoint" in df.columns:
            for ep, grp in df.groupby("endpoint"):
                ep_rt = grp["response_time"].dropna()
                ep_errors = len(grp[grp["status_code"] >= 400])
                by_endpoint[ep] = {
                    "p50": round(float(ep_rt.quantile(0.50)), 1) if len(ep_rt) else 0,
                    "p95": round(float(ep_rt.quantile(0.95)), 1) if len(ep_rt) else 0,
                    "p99": round(float(ep_rt.quantile(0.99)), 1) if len(ep_rt) else 0,
                    "mean": round(float(ep_rt.mean()), 1) if len(ep_rt) else 0,
                    "error_rate": round(ep_errors / len(grp) * 100, 2),
                    "count": len(grp),
                }

        return {
            "total_requests": total,
            "error_count": error_count,
            "error_rate_pct": round(error_pct, 2),
            "p50_ms": round(float(rt.quantile(0.50)), 1) if len(rt) else 0,
            "p95_ms": round(float(rt.quantile(0.95)), 1) if len(rt) else 0,
            "p99_ms": round(float(rt.quantile(0.99)), 1) if len(rt) else 0,
            "mean_ms": round(float(rt.mean()), 1) if len(rt) else 0,
            "max_ms": round(float(rt.max()), 1) if len(rt) else 0,
            "min_ms": round(float(rt.min()), 1) if len(rt) else 0,
            "throughput_rps": round(total / duration_sec, 2) if duration_sec > 0 else 0,
            "apdex": apdex,
            "health_score": health_score,
            "by_endpoint": by_endpoint,
        }
