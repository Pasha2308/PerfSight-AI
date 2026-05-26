import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Any

class AnomalyDetector:
    """
    Detects anomalies using Z-score + IQR ensemble.
    No training data required — uses dynamic baseline from warmup window.
    """

    def detect(self, metrics: List[Dict], warmup_pct: float = 0.2) -> List[Dict]:
        if not metrics or len(metrics) < 10:
            return []

        df = pd.DataFrame(metrics)
        df["response_time"] = pd.to_numeric(df["response_time"], errors="coerce")
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
        df = df.sort_values("timestamp").dropna(subset=["response_time", "timestamp"])

        # Auto-compute baseline from warmup window (first 20%)
        warmup_end = df["timestamp"].min() + (df["timestamp"].max() - df["timestamp"].min()) * warmup_pct
        warmup = df[df["timestamp"] <= warmup_end]["response_time"]
        baseline_mean = warmup.mean() if len(warmup) > 0 else df["response_time"].mean()
        baseline_std = warmup.std() if len(warmup) > 1 else df["response_time"].std()

        # Rolling window for time-based analysis (30-second windows)
        window_ms = 30_000
        anomalies = []
        time_start = df["timestamp"].min()
        time_end = df["timestamp"].max()
        t = time_start + window_ms

        seen_timestamps = set()

        while t <= time_end + window_ms:
            window = df[(df["timestamp"] >= t - window_ms) & (df["timestamp"] < t)]
            if len(window) < 3:
                t += window_ms
                continue

            window_rt = window["response_time"]
            window_mean = window_rt.mean()
            window_errors = len(window[window.get("status_code", pd.Series([200]*len(window))) >= 400]) if "status_code" in window.columns else 0
            error_rate = window_errors / len(window)

            # Z-score anomaly
            if baseline_std > 0:
                z_score = (window_mean - baseline_mean) / baseline_std
            else:
                z_score = 0

            # IQR spike check vs baseline
            spike_ratio = window_mean / baseline_mean if baseline_mean > 0 else 1

            ts_key = int(t)
            if ts_key not in seen_timestamps:
                if abs(z_score) > 2.5 and spike_ratio > 1.5:
                    seen_timestamps.add(ts_key)
                    severity = "CRITICAL" if abs(z_score) > 4 or spike_ratio > 3 else "WARNING"
                    anomalies.append({
                        "timestamp": int(t - window_ms / 2),
                        "timestamp_label": self._format_time_offset(int(t - window_ms / 2), int(time_start)),
                        "type": "latency_spike",
                        "severity": severity,
                        "window_mean_ms": round(window_mean, 1),
                        "baseline_mean_ms": round(baseline_mean, 1),
                        "z_score": round(z_score, 2),
                        "spike_ratio": round(spike_ratio, 2),
                        "confidence": min(99, int(min(abs(z_score) / 6 * 100, spike_ratio / 4 * 100))),
                        "endpoint": window["endpoint"].mode()[0] if "endpoint" in window.columns else "all",
                    })

                if error_rate > 0.05:
                    seen_timestamps.add(ts_key + 1)
                    anomalies.append({
                        "timestamp": int(t - window_ms / 2),
                        "timestamp_label": self._format_time_offset(int(t - window_ms / 2), int(time_start)),
                        "type": "error_spike",
                        "severity": "CRITICAL" if error_rate > 0.1 else "WARNING",
                        "error_rate_pct": round(error_rate * 100, 2),
                        "confidence": min(99, int(error_rate * 500)),
                        "endpoint": window["endpoint"].mode()[0] if "endpoint" in window.columns else "all",
                    })

            t += window_ms

        return sorted(anomalies, key=lambda x: x["timestamp"])

    def detect_trend(self, metrics: List[Dict]) -> Dict:
        """Detects slow degradation trends (e.g., memory leaks)."""
        if len(metrics) < 20:
            return {"trend": "stable", "slope": 0}

        df = pd.DataFrame(metrics)
        df["response_time"] = pd.to_numeric(df["response_time"], errors="coerce")
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
        df = df.dropna().sort_values("timestamp")

        x = (df["timestamp"] - df["timestamp"].min()).values
        y = df["response_time"].values

        slope, intercept, r_value, p_value, _ = stats.linregress(x, y)

        if p_value < 0.05 and slope > 0.01:
            return {
                "trend": "degrading",
                "slope_ms_per_sec": round(slope * 1000, 3),
                "r_squared": round(r_value ** 2, 3),
                "verdict": f"Response times increasing by {round(slope * 60000, 1)}ms per minute",
            }
        elif p_value < 0.05 and slope < -0.01:
            return {"trend": "improving", "slope_ms_per_sec": round(slope * 1000, 3)}
        else:
            return {"trend": "stable", "slope_ms_per_sec": round(slope * 1000, 3)}

    def _format_time_offset(self, timestamp_ms: int, start_ms: int) -> str:
        offset_sec = (timestamp_ms - start_ms) / 1000
        minutes = int(offset_sec // 60)
        seconds = int(offset_sec % 60)
        return f"{minutes:02d}:{seconds:02d}"
