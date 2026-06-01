<![CDATA[# 🚀 PerfSight AI — Autonomous Performance Intelligence Platform

> **Enterprise-grade AI-powered performance testing** — From plain English to actionable insights in minutes, not days.
>
> Built on **Google Vertex AI (Gemini 2.5)** | Supports **10+ LLM providers** | **Zero-config startup**

---

## 📋 Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Key Capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Quick Start (1-Click)](#quick-start-1-click)
- [Testing Guide for Judges](#testing-guide-for-judges)
- [API Reference](#api-reference)
- [LLM Provider Support](#llm-provider-support)
- [CI/CD Integration](#cicd-integration)
- [Tech Stack](#tech-stack)

---

## Problem Statement

Performance testing today requires:
- **4–8 hours** to write a single JMeter/k6 test script
- **Deep expertise** in correlation, parameterization, and assertion logic
- **Manual analysis** of thousands of metrics to find root causes
- **Siloed workflows** — scripts, execution, analysis, and reporting happen in separate tools

**PerfSight AI eliminates all of this.**

---

## Solution Overview

PerfSight AI is a **fully autonomous multi-agent platform** that covers **two critical use cases**:

### Use Case 1: AI-Powered Performance Test Lifecycle
Describe a scenario in plain English → AI generates scripts → executes tests → analyzes results → produces enterprise reports with root cause analysis and remediation.

### Use Case 2: Automated Load Test Script Generation from Production Traffic
Upload production logs (Apache, Nginx, JSON, OTEL, HAR) → AI identifies user journeys via behavioral clustering → generates realistic load test scripts that mirror real traffic patterns.

---

## Key Capabilities

| Capability | What It Does | Time Saved |
|---|---|---|
| **NL → Test Script** | Describe scenario in English → get production-quality k6/JMeter/Gatling/Locust script | 4–8 hrs → 2 min |
| **SETI Algorithm** | 3-pass NL extraction pipeline with 30+ domain-specific scenario templates (e-commerce, banking, gaming, healthcare, ticketing) | Novel IP |
| **JMeter Correlation** | Auto-detect and correlate dynamic values (CSRF, sessions, auth tokens) in JMX files | 4–6 hrs → 1 min |
| **HAR → JMX Conversion** | Record browser traffic → auto-convert to correlated JMeter script | Manual → Automated |
| **ML Anomaly Detection** | Z-score + IQR ensemble with DBSCAN clustering for anomaly detection | Real-time |
| **Cross-Layer Correlation** | Pearson correlation between app metrics (latency, errors) and infra metrics (CPU, memory, DB connections) | Manual → Automated |
| **AI Root Cause Analysis** | Ranked root causes with confidence scores and evidence chains | Hours → Seconds |
| **QA Chat Agent** | Intent-classified conversational agent for asking questions about test results | New capability |
| **Production Traffic Analysis** | Ingest logs → cluster user journeys → generate realistic load scripts | Days → Minutes |
| **CI/CD Quality Gate** | REST API for GitHub Actions/Jenkins integration with pass/fail SLA enforcement | Enterprise-ready |
| **Multi-LLM Support** | Switch between 10+ LLM providers (Google, OpenAI, Anthropic, Groq, etc.) from the UI | Flexibility |
| **Script Download** | Download generated test scripts (.js, .jmx, .py, .scala) directly from the UI | Convenience |
| **Test Data Import** | Import JTL, k6 JSON, or CSV results for instant AI analysis | Bring your own data |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      PerfSight AI v2.0 — Architecture                    │
├────────────────────────────┬─────────────────────────────────────────────┤
│    Frontend (React + TS)   │          Backend (FastAPI + Python)          │
│                            │                                             │
│  ┌─ NL Test Wizard ────┐   │   ┌─ Agent Pipeline ─────────────────────┐  │
│  │  Natural Language    │   │   │  1. Scenario Agent (Vertex AI Pro)   │  │
│  │  Scenario Input      │   │   │  2. NL Parser / SETI Algorithm      │  │
│  └─────────────────────┘   │   │  3. Script Gen Agent (Flash)         │  │
│  ┌─ Live Monitor ──────┐   │   │  4. Execution Agent (k6/JMeter)      │  │
│  │  Real-time metrics   │   │   │  5. Analysis Agent (scipy/pandas)    │  │
│  │  via WebSocket       │   │   │  6. Report Agent (Pro)               │  │
│  └─────────────────────┘   │   │  7. QA Agent (Intent-classified)     │  │
│  ┌─ Report Dashboard ──┐   │   └──────────────────────────────────────┘  │
│  │  Verdict, KPIs,      │   │                                             │
│  │  RCA, Remediation    │   │   ┌─ Specialized Agents ────────────────┐  │
│  │  Script Download     │   │   │  • Correlation Agent (JMX/HAR)      │  │
│  └─────────────────────┘   │   │  • Import Agent (JTL/k6/CSV)        │  │
│  ┌─ Tools Panel ───────┐   │   │  • Traffic Ingestion Agent           │  │
│  │  JMX Correlator      │   │   │  • Multi-LLM Router (10+ providers) │  │
│  │  HAR Converter       │   │   └──────────────────────────────────────┘  │
│  │  Result Importer     │   │                                             │
│  └─────────────────────┘   │   ┌─ Data Layer ─────────────────────────┐  │
│  ┌─ Traffic Analyzer ──┐   │   │  SQLite (aiosqlite) + JWT Auth       │  │
│  │  Log Upload          │   │   │  WebSocket real-time streaming       │  │
│  │  Journey Clustering  │   │   └──────────────────────────────────────┘  │
│  │  Script Generation   │   │                                             │
│  └─────────────────────┘   │   AI: Vertex AI (Gemini 2.5 Flash + Pro)    │
│  ┌─ Settings ──────────┐   │   ML: scipy (Z-score/IQR), pandas, sklearn  │
│  │  Multi-LLM Config   │   │   Exec: k6 / JMeter / Gatling / Locust     │
│  └─────────────────────┘   │                                             │
├────────────────────────────┴─────────────────────────────────────────────┤
│  Auth: JWT (bcrypt) │ CI/CD: REST Quality Gate │ Docker: docker-compose  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (1-Click)

### Option A: Windows — Double-click `start.bat`

```
start.bat
```

This will:
1. Install Python dependencies
2. Start the FastAPI backend on port 8000
3. Seed demo data (admin user + 5 historical test runs)
4. Install npm dependencies
5. Start the React frontend on port 5173

### Option B: Manual Setup

**Prerequisites:** Python 3.11+, Node.js 18+, Google Cloud SDK (authenticated)

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python seed_data.py                          # Seeds demo user + test history
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Option C: Docker

```bash
docker-compose up --build
```

### Default Login Credentials

| Email | Password | Role |
|---|---|---|
| `judge@feuji.com` | `password123` | Admin |

> Open **http://localhost:5173** → Login → Start testing!

---

## Testing Guide for Judges

### Test 1: Natural Language → Full Pipeline (Use Case 1)

1. **Login** with `judge@feuji.com` / `password123`
2. Click **"New Test"** on the dashboard
3. Select the **"Natural Language"** tab
4. Enter this scenario:
   ```
   Simulate 50 users hitting a REST API during a flash sale,
   with a spike at sale start, testing response times and error rates
   ```
5. Set **Target URL** to `https://reqres.in/api/users`
6. Set **Tool** to `k6`
7. Click **Run Test**
8. Watch the **6-phase pipeline** execute in real-time:
   - ✅ Scenario analysis (SETI algorithm matches "flash_sale_ecommerce")
   - ✅ k6 script generation
   - ✅ Test execution with live metrics
   - ✅ ML analysis (anomaly detection + correlation)
   - ✅ AI report (verdict, KPIs, root causes, remediation)
   - ✅ QA agent ready for follow-up questions

**Expected result:** Full report with PASS/FAIL verdict, health score ring, KPI cards, anomaly timeline, root cause ranking, and downloadable k6 script.

### Test 2: JMeter Correlation (Tools Panel)

1. Click **"Tools"** in the sidebar
2. Select **"JMX Correlator"**
3. Upload any `.jmx` file (or paste JMX XML content)
4. AI identifies all dynamic values and generates correlation extractors
5. Download the correlated JMX

### Test 3: Production Traffic → Script Generation (Use Case 2)

1. Click **"Traffic Analyzer"** in the sidebar
2. Upload a log file (Apache, JSON, HAR format)
3. AI clusters user journeys and shows traffic patterns
4. Click **"Generate Script"** to produce a load test script from the journeys
5. Download the generated script

### Test 4: Import Existing Results

1. Click **"Tools"** → **"Import Results"**
2. Upload a JTL, k6 JSON, or CSV results file
3. AI instantly analyzes and produces a full report

### Test 5: QA Chat Agent

1. After any test completes, use the **chat panel** on the right
2. Try questions like:
   - "What caused the latency spike?"
   - "Can you suggest a retest with different parameters?"
   - "Summarize the test results for my manager"

### Test 6: CI/CD Quality Gate (API)

```bash
# Trigger a test from CI
curl -X POST http://localhost:8000/api/ci/trigger \
  -H "Content-Type: application/json" \
  -d '{"project_name":"CI Test","target_url":"https://reqres.in/api/users","scenario_type":"load"}'

# Check quality gate (replace <run_id> with actual ID from response)
curl -X POST http://localhost:8000/api/ci/gate \
  -H "Content-Type: application/json" \
  -d '{"run_id":"<run_id>","sla_p99_ms":500,"sla_error_rate_pct":1.0}'
```

### Test 7: Multi-LLM Provider Switch

1. Click the **⚙️ Settings** gear icon
2. Select a different LLM provider (OpenAI, Anthropic, Groq, etc.)
3. Enter your API key
4. Click **Test Connection**
5. Run any test — it now uses the selected provider

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login and get JWT token |
| `/api/tests/start` | POST | Start performance test |
| `/api/tests/start-nl` | POST | Start from natural language |
| `/api/scenarios/parse` | POST | Parse NL scenario to config |
| `/api/scripts/generate` | POST | Generate test script from scenario |
| `/api/tests` | GET | List all test runs |
| `/api/tests/{id}` | GET | Get test run details |
| `/api/tests/{id}/report` | GET | Get test report |
| `/api/chat` | POST | Chat with QA agent |
| `/api/correlate/jmx` | POST | Auto-correlate JMX file |
| `/api/correlate/har` | POST | Convert HAR → correlated JMX |
| `/api/optimize/jmx` | POST | AI optimization of JMX |
| `/api/import/jtl` | POST | Import & analyze JTL |
| `/api/import/k6` | POST | Import & analyze k6 JSON |
| `/api/import/csv` | POST | Import & analyze CSV |
| `/api/traffic/analyze` | POST | Analyze production traffic logs |
| `/api/traffic/generate-script` | POST | Generate script from traffic journeys |
| `/api/ci/trigger` | POST | CI/CD pipeline trigger |
| `/api/ci/gate` | POST | Quality gate pass/fail |
| `/api/llm/test` | POST | Test LLM connection |
| `/api/health` | GET | Health check |
| `/ws/{run_id}` | WS | Real-time metrics stream |

---

## LLM Provider Support

PerfSight AI supports **10+ LLM providers** — switch from the Settings panel:

| Provider | Base URL | Example Models |
|---|---|---|
| **Google Gemini** (default) | Vertex AI | `gemini-2.5-flash`, `gemini-2.5-pro` |
| **OpenAI** | `api.openai.com` | `gpt-4o`, `gpt-4o-mini` |
| **Anthropic** | `api.anthropic.com` | `claude-sonnet-4-20250514`, `claude-3.5-haiku` |
| **Groq** | `api.groq.com` | `llama-3.1-70b`, `mixtral-8x7b` |
| **OpenRouter** | `openrouter.ai` | Any model on OpenRouter |
| **DeepSeek** | `api.deepseek.com` | `deepseek-chat`, `deepseek-coder` |
| **Mistral** | `api.mistral.ai` | `mistral-large`, `mistral-small` |
| **Together AI** | `api.together.xyz` | `meta-llama/Llama-3-70b` |
| **xAI (Grok)** | `api.x.ai` | `grok-2` |
| **NVIDIA NIM** | `integrate.api.nvidia.com` | `meta/llama3-70b-instruct` |
| **Cohere** | `api.cohere.com` | `command-r-plus` |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Gate
on: [push]
jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Performance Test
        run: |
          RESPONSE=$(curl -s -X POST http://your-perfsight-host:8000/api/ci/trigger \
            -H "Content-Type: application/json" \
            -d '{"project_name":"MyApp","target_url":"https://api.myapp.com","scenario_type":"load"}')
          RUN_ID=$(echo $RESPONSE | jq -r '.run_id')
          echo "RUN_ID=$RUN_ID" >> $GITHUB_ENV

      - name: Wait for completion
        run: sleep 120

      - name: Check Quality Gate
        run: |
          GATE=$(curl -s -X POST http://your-perfsight-host:8000/api/ci/gate \
            -H "Content-Type: application/json" \
            -d "{\"run_id\":\"$RUN_ID\",\"sla_p99_ms\":500,\"sla_error_rate_pct\":1.0}")
          EXIT_CODE=$(echo $GATE | jq -r '.exit_code')
          exit $EXIT_CODE
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite, Monaco Editor, ECharts, Lucide Icons |
| **Backend** | Python 3.11, FastAPI, Uvicorn, Pydantic |
| **AI/ML** | Google Vertex AI (Gemini 2.5 Flash + Pro), scipy, pandas, sklearn |
| **Database** | SQLite (aiosqlite) |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **Real-time** | WebSocket (native FastAPI) |
| **Load Tools** | k6, JMeter, Gatling, Locust (CLI integration) |
| **Containerization** | Docker + docker-compose |

---

## Agent Descriptions

| Agent | Model | Purpose |
|---|---|---|
| **Scenario Agent** | Gemini Pro | Maps target URL, infers endpoints, designs test scenarios |
| **NL Parser (SETI)** | Gemini Flash + Pro | 3-pass extraction: keyword match → entity extraction → calibration |
| **Script Gen Agent** | Gemini Flash | Generates production-quality k6/JMeter/Gatling/Locust scripts |
| **Execution Agent** | — | Routes to real k6/JMeter CLI or high-fidelity simulation |
| **Analysis Agent** | scipy + pandas | Z-score/IQR anomaly detection, Pearson correlation, trend analysis |
| **Report Agent** | Gemini Pro | Executive summary, technical RCA, remediation steps |
| **QA Agent** | Gemini Flash | Intent-classified conversational agent (10 intent categories) |
| **Correlation Agent** | Gemini Pro | Auto-correlates JMX files, converts HAR → JMX |
| **Import Agent** | Gemini Flash | Parses JTL, k6 JSON, CSV into normalized metrics |
| **Traffic Ingestion** | Gemini Pro | Clusters production logs into user journeys |
| **LLM Router** | — | Routes to any of 10+ LLM providers based on user config |

---

## E2E Validation

Run the automated E2E pipeline validation:

```bash
cd backend
python seed_data.py         # Ensure demo data exists
python test_e2e_flow.py     # Runs: Login → Parse → Generate → Execute → Report
```

This proves the full pipeline works end-to-end against `https://reqres.in`.

---

## Project Structure

```
Feuji/
├── backend/
│   ├── agents/                 # 11 AI/ML agents
│   │   ├── gemini_client.py    # Vertex AI client (async)
│   │   ├── llm_router.py       # Multi-LLM provider router
│   │   ├── nl_scenario_parser.py # SETI algorithm (3-pass NL)
│   │   ├── scenario_agent.py   # Endpoint inference
│   │   ├── script_gen_agent.py # k6/JMeter/Gatling/Locust
│   │   ├── execution_agent.py  # Test runner + simulation
│   │   ├── analysis_agent.py   # ML anomaly detection
│   │   ├── report_agent.py     # AI report generation
│   │   ├── qa_agent.py         # Conversational QA
│   │   ├── correlation_agent.py# JMX/HAR correlation
│   │   ├── import_agent.py     # JTL/k6/CSV import
│   │   └── traffic_ingestion_agent.py # Production log analysis
│   ├── db/                     # SQLite database layer
│   ├── executors/              # Real k6/JMeter/Locust executors
│   ├── main.py                 # FastAPI app (23 API endpoints)
│   ├── auth.py                 # JWT authentication
│   ├── seed_data.py            # Demo data seeder
│   ├── test_e2e_flow.py        # E2E validation script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/         # 10 React components
│   │   ├── api.ts              # API client with LLM header injection
│   │   ├── store.ts            # Zustand state management
│   │   └── App.tsx             # Main app with routing
│   └── package.json
├── docker-compose.yml
├── start.bat                   # Windows 1-click startup
├── start.sh                    # Linux/Mac 1-click startup
└── README.md
```

---

## License

Built for the **Feuji Hackathon** — Performance Testing Innovation Challenge.

**Team Pasha** | Powered by Google Vertex AI
]]>
