"""
Import Agent — Analyze Existing Test Results

Allows QA teams to upload their existing test data and get instant AI analysis:
- JTL files (JMeter results)
- k6 JSON output
- HAR files (browser recordings → auto-converted to JMX)
- CSV result files

Bridges the gap: "We already have test data — just help us understand it."
"""
import json
import csv
import io
from typing import Dict, Any, List, Optional
from agents.gemini_client import call_gemini


async def analyze_jtl_file(jtl_content: str, project_name: str = "Imported Test") -> Dict[str, Any]:
    """
    Parse a JMeter JTL (CSV format) file and run full analysis pipeline.
    Returns metrics in the same format as the execution agent.
    """
    metrics = []
    reader = csv.DictReader(io.StringIO(jtl_content))

    for row in reader:
        try:
            timestamp = int(row.get("timeStamp", 0))
            elapsed = float(row.get("elapsed", 0))
            label = row.get("label", "/")
            response_code = row.get("responseCode", "200")
            success = row.get("success", "true") == "true"
            response_bytes = row.get("bytes", "0")
            grp_threads = row.get("grpThreads", "1")

            # Normalize response code
            try:
                status_code = int(response_code)
            except ValueError:
                status_code = 500 if not success else 200

            metrics.append({
                "timestamp": timestamp,
                "endpoint": label,
                "method": row.get("method", "GET") if "method" in row else "GET",
                "response_time": elapsed,
                "status_code": status_code,
                "vus": int(grp_threads) if grp_threads.isdigit() else 1,
                "bytes": int(response_bytes) if str(response_bytes).isdigit() else 0,
                "success": success,
            })
        except (ValueError, KeyError):
            continue

    if not metrics:
        return {"error": "No valid metrics found in JTL file", "metrics": []}

    # Generate summary using the existing KPI calculator
    from ml.kpi_calculator import KPICalculator
    from ml.anomaly_detector import AnomalyDetector

    kpi_calc = KPICalculator()
    detector = AnomalyDetector()

    kpis = kpi_calc.compute(metrics)
    anomalies = detector.detect(metrics)
    trend = detector.detect_trend(metrics)

    # Quick AI summary
    summary_prompt = f"""Analyze these JMeter test results and provide a brief assessment:

KPIs: {json.dumps(kpis, indent=2)}
Anomalies found: {len(anomalies)}
Trend: {json.dumps(trend)}
Total requests: {len(metrics)}
Unique endpoints: {len(set(m['endpoint'] for m in metrics))}

Provide:
1. Overall verdict (PASS/FAIL)
2. Key finding in one sentence
3. Top concern
4. Recommended next step

Keep it under 100 words."""

    ai_summary = await call_gemini(summary_prompt, temperature=0.3, task_type="fast")

    return {
        "project_name": project_name,
        "source": "jtl_import",
        "total_metrics": len(metrics),
        "unique_endpoints": len(set(m["endpoint"] for m in metrics)),
        "kpis": kpis,
        "anomalies": anomalies[:20],  # Cap at 20
        "trend": trend,
        "ai_summary": ai_summary,
        "metrics": metrics,  # Full metrics for pipeline
    }


async def analyze_k6_json(k6_content: str, project_name: str = "Imported k6 Test") -> Dict[str, Any]:
    """
    Parse k6 JSON output (line-delimited JSON) and extract HTTP metrics.
    """
    metrics = []
    lines = k6_content.strip().split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if obj.get("type") == "Point" and obj.get("metric") == "http_req_duration":
                data = obj.get("data", {})
                tags = data.get("tags", {})
                metrics.append({
                    "timestamp": int(float(data.get("time", 0)) * 1000),
                    "endpoint": tags.get("url", tags.get("name", "/")),
                    "method": tags.get("method", "GET"),
                    "response_time": float(data.get("value", 0)),
                    "status_code": int(tags.get("status", 200)),
                    "vus": 1,
                    "bytes": 0,
                })
        except (json.JSONDecodeError, ValueError, KeyError):
            continue

    if not metrics:
        return {"error": "No valid HTTP duration metrics found in k6 output", "metrics": []}

    from ml.kpi_calculator import KPICalculator
    from ml.anomaly_detector import AnomalyDetector

    kpi_calc = KPICalculator()
    detector = AnomalyDetector()

    kpis = kpi_calc.compute(metrics)
    anomalies = detector.detect(metrics)
    trend = detector.detect_trend(metrics)

    return {
        "project_name": project_name,
        "source": "k6_import",
        "total_metrics": len(metrics),
        "unique_endpoints": len(set(m["endpoint"] for m in metrics)),
        "kpis": kpis,
        "anomalies": anomalies[:20],
        "trend": trend,
        "metrics": metrics,
    }


async def analyze_csv_results(csv_content: str, project_name: str = "Imported CSV") -> Dict[str, Any]:
    """
    Parse a generic CSV results file. Auto-detects column names.
    Supports various formats from different load testing tools.
    """
    reader = csv.DictReader(io.StringIO(csv_content))
    headers = reader.fieldnames or []

    # Auto-detect column mapping
    col_map = _auto_detect_columns(headers)

    if not col_map.get("response_time"):
        return {"error": f"Could not auto-detect response time column. Available columns: {headers}", "metrics": []}

    metrics = []
    for row in reader:
        try:
            metrics.append({
                "timestamp": int(float(row.get(col_map.get("timestamp", ""), 0) or 0)),
                "endpoint": row.get(col_map.get("endpoint", ""), "/"),
                "method": row.get(col_map.get("method", ""), "GET"),
                "response_time": float(row.get(col_map["response_time"], 0) or 0),
                "status_code": int(row.get(col_map.get("status_code", ""), 200) or 200),
                "vus": int(row.get(col_map.get("vus", ""), 1) or 1),
                "bytes": int(row.get(col_map.get("bytes", ""), 0) or 0),
            })
        except (ValueError, KeyError):
            continue

    if not metrics:
        return {"error": "No valid metrics parsed from CSV", "metrics": []}

    from ml.kpi_calculator import KPICalculator
    kpi_calc = KPICalculator()
    kpis = kpi_calc.compute(metrics)

    return {
        "project_name": project_name,
        "source": "csv_import",
        "total_metrics": len(metrics),
        "column_mapping": col_map,
        "kpis": kpis,
        "metrics": metrics,
    }


def _auto_detect_columns(headers: List[str]) -> Dict[str, str]:
    """Auto-detect column names from various load testing tool CSV formats."""
    mapping = {}
    headers_lower = {h.lower(): h for h in headers}

    # Response time detection
    for candidate in ["elapsed", "response_time", "responsetime", "duration", "latency", "time", "avg", "50%"]:
        if candidate in headers_lower:
            mapping["response_time"] = headers_lower[candidate]
            break

    # Timestamp
    for candidate in ["timestamp", "timestampms", "time", "start", "starttime"]:
        if candidate in headers_lower:
            mapping["timestamp"] = headers_lower[candidate]
            break

    # Endpoint / Label
    for candidate in ["label", "name", "endpoint", "url", "request", "path", "sampler"]:
        if candidate in headers_lower:
            mapping["endpoint"] = headers_lower[candidate]
            break

    # Status code
    for candidate in ["responsecode", "status_code", "statuscode", "status", "http_code"]:
        if candidate in headers_lower:
            mapping["status_code"] = headers_lower[candidate]
            break

    # Method
    for candidate in ["method", "http_method", "httpmethod"]:
        if candidate in headers_lower:
            mapping["method"] = headers_lower[candidate]
            break

    # VUs / Threads
    for candidate in ["grpthreads", "allthreads", "vus", "users", "threads", "user count"]:
        if candidate in headers_lower:
            mapping["vus"] = headers_lower[candidate]
            break

    # Bytes
    for candidate in ["bytes", "sentbytes", "receivedbytes", "response_bytes"]:
        if candidate in headers_lower:
            mapping["bytes"] = headers_lower[candidate]
            break

    return mapping
