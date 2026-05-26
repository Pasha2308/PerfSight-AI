import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Any

class CorrelationEngine:
    """
    Correlates app-level performance metrics with infrastructure metrics.
    Uses Pearson correlation with time-lag analysis to find causal relationships.
    """

    def correlate(self, app_metrics: List[Dict], infra_metrics: List[Dict]) -> List[Dict]:
        if not app_metrics or not infra_metrics:
            return []

        app_df = pd.DataFrame(app_metrics)
        infra_df = pd.DataFrame(infra_metrics)

        app_df["timestamp"] = pd.to_numeric(app_df["timestamp"], errors="coerce")
        app_df["response_time"] = pd.to_numeric(app_df["response_time"], errors="coerce")
        infra_df["timestamp"] = pd.to_numeric(infra_df["timestamp"], errors="coerce")

        # Resample to 10-second buckets
        app_resampled = (
            app_df.set_index("timestamp")
            .resample("10s", on=None)
            .agg({"response_time": "mean"})
            .reset_index()
        )

        findings = []
        metric_cols = [c for c in infra_df.columns if c not in ["timestamp", "metric_name"]]

        for col in metric_cols:
            infra_series = infra_df.set_index("timestamp")[col].resample("10s").mean() if "timestamp" in infra_df.columns else None
            if infra_series is None:
                continue

            # Try lags: 0, 5s, 10s, 15s, 30s
            best_corr = 0
            best_lag = 0
            for lag_steps in [0, 1, 2, 3, 6]:
                try:
                    aligned = pd.concat([
                        app_resampled["response_time"].reset_index(drop=True),
                        infra_series.reset_index(drop=True).shift(lag_steps)
                    ], axis=1).dropna()

                    if len(aligned) < 5:
                        continue

                    corr, pval = stats.pearsonr(aligned.iloc[:, 0], aligned.iloc[:, 1])
                    if abs(corr) > abs(best_corr) and pval < 0.05:
                        best_corr = corr
                        best_lag = lag_steps * 10
                except Exception:
                    continue

            if abs(best_corr) > 0.65:
                direction = "increases" if best_corr > 0 else "decreases"
                findings.append({
                    "infra_metric": col,
                    "correlation": round(best_corr, 3),
                    "lag_seconds": best_lag,
                    "confidence": min(99, int(abs(best_corr) * 100)),
                    "direction": direction,
                    "interpretation": self._interpret(col, best_corr, best_lag),
                })

        return sorted(findings, key=lambda x: abs(x["correlation"]), reverse=True)

    def _interpret(self, metric: str, corr: float, lag: int) -> str:
        lag_str = f" (with a {lag}-second delay)" if lag > 0 else ""
        if "cpu" in metric.lower():
            if corr > 0:
                return f"High CPU utilization strongly correlates with response time spikes{lag_str}. CPU saturation is likely the root cause."
            else:
                return f"Low CPU correlates with high latency{lag_str} — possible thread blocking or I/O wait."
        elif "memory" in metric.lower() or "heap" in metric.lower():
            if corr > 0:
                return f"Rising memory usage correlates with degrading response times{lag_str}. Potential memory leak or GC pressure."
        elif "db" in metric.lower() or "connection" in metric.lower():
            return f"Database connection pool metrics correlate with latency{lag_str}. Connection starvation is likely."
        elif "network" in metric.lower():
            return f"Network utilization correlates with response time{lag_str}. Possible network saturation or bandwidth limits."
        return f"{metric} shows {round(abs(corr)*100)}% correlation with response time{lag_str}."
