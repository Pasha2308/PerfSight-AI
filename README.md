# PerfSight AI — Autonomous Performance Intelligence Platform

> **Powered by Google Vertex AI** | Reduce QA testing time from days to minutes

## What It Does

PerfSight AI is an autonomous performance testing platform that eliminates the manual work of:
- **Writing test scripts** — Describe your scenario in plain English, AI generates k6/JMeter/Gatling/Locust scripts
- **Correlating JMeter scripts** — AI auto-identifies and correlates dynamic values (sessions, tokens, CSRF)
- **Analyzing results** — ML pipeline detects anomalies, correlates metrics, and finds root causes
- **Generating reports** — Executive summaries, technical RCA, and remediation steps
- **QA conversations** — Chat with the AI about test results, request retests, export reports

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PerfSight AI v2.0                        │
├──────────────────────────┬──────────────────────────────────────┤
│     Frontend (React)     │         Backend (FastAPI)             │
│  • NL Test Wizard        │  • Scenario Agent (Vertex AI Pro)     │
│  • JMeter Correlator     │  • NL Parser / SETI Algorithm         │
│  • Live Monitor          │  • Script Gen Agent (Vertex AI Flash) │
│  • Report View           │  • Execution Agent (k6/JMeter/Locust) │
│  • QA Chat Panel         │  • Analysis Agent (scipy/pandas ML)   │
│  • Import Tools          │  • Report Agent (Vertex AI Pro)       │
│                          │  • QA Agent (Intent-classified)       │
│                          │  • Correlation Agent (JMX/HAR)        │
│                          │  • Import Agent (JTL/k6/CSV)          │
├──────────────────────────┴──────────────────────────────────────┤
│  AI: Google Vertex AI (Gemini 2.5 Flash + Pro)                  │
│  ML: scipy (Z-score/IQR), pandas (Pearson correlation)          │
│  DB: SQLite (aiosqlite)  |  Execution: k6/JMeter/Locust CLI    │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Option A: Vertex AI (recommended — uses GCP credits)
# Edit .env and set: GCP_PROJECT_ID=your_project_id
# Make sure you're authenticated: gcloud auth application-default login

# Option B: Gemini API Key (for local dev)
# Edit .env and set: GEMINI_API_KEY=your_key

uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Key Features

### 🧠 Natural Language → Test Script
Describe any scenario in plain English:
> "Simulate 10,000 users hitting an e-commerce site during a flash sale, with spike at sale start"

AI generates a complete, production-quality test script with proper correlation, think times, and assertions.

### ⚡ JMeter Correlation Agent
Upload any JMX file and the AI:
1. Scans for dynamic values (session IDs, CSRF tokens, auth tokens)
2. Generates proper extractors (RegEx, JSON Path, XPath)
3. Injects correlations into the JMX
4. Returns a ready-to-run correlated script

**Time saved: 4-8 hours → 2 minutes**

### 📊 Import & Analyze Existing Results
Upload JTL, k6 JSON, or CSV result files for instant AI analysis:
- Anomaly detection (Z-score + IQR ensemble)
- Trend analysis (degradation, memory leak patterns)
- Cross-layer correlation (app ↔ infrastructure metrics)
- Automated root cause ranking

### 🔄 CI/CD Quality Gate
```bash
# Trigger from GitHub Actions / Jenkins
curl -X POST http://localhost:8000/api/ci/trigger \
  -H "Content-Type: application/json" \
  -d '{"project_name":"MyApp","target_url":"https://api.example.com","scenario_type":"load"}'

# Check quality gate
curl -X POST http://localhost:8000/api/ci/gate \
  -H "Content-Type: application/json" \
  -d '{"run_id":"<run_id>","sla_p99_ms":500,"sla_error_rate_pct":1.0}'
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tests/start` | POST | Start a performance test |
| `/api/tests/start-nl` | POST | Start from natural language |
| `/api/correlate/jmx` | POST | Auto-correlate a JMX file |
| `/api/correlate/har` | POST | Convert HAR → correlated JMX |
| `/api/optimize/jmx` | POST | AI review of JMX best practices |
| `/api/import/jtl` | POST | Import & analyze JTL results |
| `/api/import/k6` | POST | Import & analyze k6 JSON |
| `/api/import/csv` | POST | Import & analyze generic CSV |
| `/api/ci/trigger` | POST | CI/CD pipeline trigger |
| `/api/ci/gate` | POST | Quality gate pass/fail |
| `/api/chat` | POST | Chat with QA agent |
| `/ws/{run_id}` | WS | Real-time test metrics stream |

## Vertex AI Setup

1. Create a GCP project (or use existing)
2. Enable the Vertex AI API: `gcloud services enable aiplatform.googleapis.com`
3. Authenticate: `gcloud auth application-default login`
4. Set in `.env`: `GCP_PROJECT_ID=your-project-id`

The platform uses:
- **Gemini 2.5 Flash** for fast tasks (script gen, NL parsing, formatting)
- **Gemini 2.5 Pro** for complex reasoning (RCA, report generation, correlation analysis)
