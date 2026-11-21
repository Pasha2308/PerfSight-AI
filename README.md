<div align="center">
  
# 🚀 PerfSight AI 
**Autonomous Performance Intelligence Platform**

*Enterprise-grade AI-powered performance testing — From plain English to actionable insights in minutes, not days.*

[![Google Vertex AI](https://img.shields.io/badge/Google_Vertex_AI-Gemini_2.5-4285F4?style=for-the-badge&logo=googlecloud)](https://cloud.google.com/vertex-ai)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)

**Built on Google Vertex AI (Gemini 2.5) | Supports 10+ LLM providers | Zero-config startup**

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Key Capabilities](#-key-capabilities)
- [Architecture](#-architecture)
- [Quick Start (1-Click)](#-quick-start-1-click)
- [Testing Guide for Judges](#-testing-guide-for-judges)
- [LLM Provider Support](#-llm-provider-support)
- [Tech Stack](#-tech-stack)

---

## 🛑 Problem Statement

Performance testing today requires:
- ⏳ **4–8 hours** to write a single JMeter/k6 test script
- 🧠 **Deep expertise** in correlation, parameterization, and assertion logic
- 📊 **Manual analysis** of thousands of metrics to find root causes
- 🛠️ **Siloed workflows** — scripts, execution, analysis, and reporting happen in separate tools

**PerfSight AI eliminates all of this.**

---

## 💡 Solution Overview

PerfSight AI is a **fully autonomous multi-agent platform** that covers two critical use cases:

### Use Case 1: AI-Powered Performance Test Lifecycle
Describe a scenario in plain English → AI generates scripts → executes tests → analyzes results → produces enterprise reports with root cause analysis and remediation.

### Use Case 2: Automated Load Test Script Generation from Production Traffic
Upload production logs (Apache, Nginx, JSON, OTEL, HAR) → AI identifies user journeys via behavioral clustering → generates realistic load test scripts that mirror real traffic patterns.

---

## ✨ Key Capabilities

| Capability | What It Does | Impact |
|:---|:---|:---|
| **NL → Test Script** | Describe scenario in English → get production-quality k6/JMeter script | **4–8 hrs → 2 min** |
| **SETI Algorithm** | 3-pass NL extraction pipeline with 30+ domain-specific scenario templates | **Novel IP** |
| **JMeter Correlation** | Auto-detect and correlate dynamic values (CSRF, sessions) in JMX files | **4–6 hrs → 1 min** |
| **HAR → JMX Conversion** | Record browser traffic → auto-convert to correlated JMeter script | **Manual → Automated** |
| **ML Anomaly Detection** | Z-score + IQR ensemble with DBSCAN clustering for anomaly detection | **Real-time** |
| **Cross-Layer Correlation**| Pearson correlation between app metrics and infra metrics (CPU, Memory) | **Manual → Automated** |
| **AI Root Cause Analysis** | Ranked root causes with confidence scores and evidence chains | **Hours → Seconds** |
| **QA Chat Agent** | Intent-classified conversational agent for querying test results | **Instant Insights** |
| **CI/CD Quality Gate** | REST API for GitHub Actions/Jenkins integration with SLA enforcement | **Enterprise-ready** |

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                      PerfSight AI v2.0 — Architecture                    │
├────────────────────────────┬─────────────────────────────────────────────┤
│    Frontend (React + TS)   │          Backend (FastAPI + Python)         │
│                            │                                             │
│  ┌─ NL Test Wizard ────┐   │   ┌─ Agent Pipeline ─────────────────────┐  │
│  │  NL Scenario Input  │   │   │  1. Scenario Agent (Vertex AI Pro)   │  │
│  └─────────────────────┘   │   │  2. NL Parser / SETI Algorithm       │  │
│  ┌─ Live Monitor ──────┐   │   │  3. Script Gen Agent (Flash)         │  │
│  │  WebSocket Metrics  │   │   │  4. Execution Agent (k6/JMeter)      │  │
│  └─────────────────────┘   │   │  5. Analysis Agent (scipy/pandas)    │  │
│  ┌─ Report Dashboard ──┐   │   │  6. Report Agent (Pro)               │  │
│  │  RCA, Remediation   │   │   │  7. QA Agent (Intent-classified)     │  │
│  └─────────────────────┘   │   └──────────────────────────────────────┘  │
│  ┌─ Tools Panel ───────┐   │                                             │
│  │  JMX Correlator     │   │   ┌─ Specialized Agents ────────────────┐  │
│  └─────────────────────┘   │   │  • Correlation Agent (JMX/HAR)      │  │
│  ┌─ Traffic Analyzer ──┐   │   │  • Import Agent (JTL/k6/CSV)        │  │
│  │  Journey Clustering │   │   │  • Traffic Ingestion Agent          │  │
│  └─────────────────────┘   │   │  • Multi-LLM Router (10+ providers) │  │
│  ┌─ Settings ──────────┐   │   └──────────────────────────────────────┘  │
│  │  Multi-LLM Config   │   │                                             │
│  └─────────────────────┘   │   ┌─ Data Layer ─────────────────────────┐  │
│                            │   │  SQLite (aiosqlite) + JWT Auth       │  │
├────────────────────────────┴───┴─────────────────────────────────────────┤
│  AI: Vertex AI (Gemini 2.5 Flash + Pro) | ML: scipy, pandas, sklearn     │
│  Exec: k6 / JMeter / Gatling / Locust   | CI/CD: REST Quality Gate       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (1-Click)

### Option A: Windows — Double-click `start.bat`
This runs the fully automated 1-click installer:
1. Installs Python & Node.js dependencies
2. Starts the FastAPI backend on port `8000`
3. Seeds enterprise demo data (admin user + 5 historical test runs)
4. Starts the React frontend on port `5173`

### Option B: Manual Setup
*Prerequisites: Python 3.11+, Node.js 18+*

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python -m playwright install chromium            # One-time local browser setup for Browser QA
python seed_data.py                          
uvicorn main:app --host 127.0.0.1 --port 8000

# 2. Frontend (New Terminal)
cd frontend
npm install
npm run dev
```

### Core Browser QA
Open **Tools → Browser QA**, enter an HTTP or HTTPS URL, and run the check. The local Playwright runner records navigation status, title/content checks, JavaScript console and page errors, and (optionally) up to 50 HTTP links. It saves a screenshot and JSON report under `backend/artifacts/browser-qa/<run-id>/`; the response links to both. This is a bounded page check, not a site-wide crawler. No AI key or paid service is used. Install Chromium once with `python -m playwright install chromium` after installing backend requirements.

### GrabOn Coupon QA
Open **Tools → Coupon QA**, choose Fashion or Electronics, and discover the current GrabOn offers. Select offers and enter a product query for each one. The local runner follows GrabOn's offer redirect, finds a matching product, adds one item to a separate test cart, applies the code, and checks the retailer checkout summary. It stops before sign-in, personal details, shipping, or payment. A coupon is confirmed only when checkout displays the code with a positive discount; a GrabOn “verified” label alone is not proof. Screenshots and a JSON report are saved under `backend/artifacts/coupon-qa/<run-id>/`.

The checkout adapter currently supports Shopify stores for boAt, Levi's, The Bear House, and Hammer. Other stores can still be discovered and browsed, but their checkout result is reported as unsupported rather than guessed. Products, offer terms, and retailer pages change over time, so run the check again to verify a current listing. These browser checks use free local Playwright and retailer pages; they do not require an AI key or a paid service.

### QA API and Reports

The frontend uses these local FastAPI routes:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/browser-qa/run` | Check a URL; JSON body: `{"url":"https://example.com","check_links":true}` |
| `GET` | `/api/browser-qa/reports/{run_id}` | Read a saved browser QA report |
| `GET` | `/api/coupon-qa/offers/{fashion\|electronics}` | Discover live GrabOn offers and capture the listing |
| `POST` | `/api/coupon-qa/run` | Test selected offers through checkout; JSON body includes `category`, `selected` (`goid` and optional per-offer `product_query`), and default `product_query` |
| `GET` | `/api/coupon-qa/reports/{run_id}` | Read a saved coupon QA report |

Evidence paths in each report point to the matching `/api/.../artifacts/...` image route. Coupon verdicts distinguish confirmed discounts from stale offers, unsupported stores, retailer blocks, product/cart failures, and codes not confirmed at checkout.

### Option C: Docker
```bash
docker-compose up --build
```

### Option D: Command Line Interface (CLI)
A fully functional CLI is available to trigger and monitor tests without using the web UI.
```bash
cd backend
python cli.py start --project MyProject --url https://example.com --tool k6
python cli.py status <run_id>
python cli.py report <run_id>
python cli.py chat <run_id> "What was the bottleneck?"
```

### 🔌 Model Context Protocol (MCP) Server
PerfSight AI includes a native MCP Server, allowing other AI agents (like Claude Desktop) to trigger tests and analyze results directly!
```bash
cd backend
# Starts the FastMCP server exposing PerfSight tools
python mcp_server.py
```

### 🔑 Default Login Credentials
Open **http://localhost:5173** and log in to explore the demo:

| Email | Password | Role |
|---|---|---|
| `judge@feuji.com` | `password123` | Admin |

---

## 🧪 Testing Guide for Judges

<details>
<summary><strong>Test 1: Natural Language → Full Pipeline (Use Case 1)</strong></summary>

1. **Login** with `judge@feuji.com` / `password123`
2. Click **"New Test"** on the dashboard, and select the **"Natural Language"** tab
3. Enter this scenario:
   > *Simulate 50 users hitting a REST API during a flash sale, with a spike at sale start, testing response times and error rates*
4. Set **Target URL** to `https://reqres.in/api/users` and **Tool** to `k6`
5. Click **Run Test** and watch the **6-phase pipeline** execute in real-time!
</details>

<details>
<summary><strong>Test 2: JMeter Correlation (Tools Panel)</strong></summary>

1. Click **"Tools"** in the sidebar, then select **"JMX Correlator"**
2. Upload any `.jmx` file (or paste JMX XML content)
3. AI identifies all dynamic values and generates correlation extractors
</details>

<details>
<summary><strong>Test 3: Production Traffic → Script Generation (Use Case 2)</strong></summary>

1. Click **"Traffic Analyzer"** in the sidebar
2. Upload a log file (Apache, JSON, HAR format)
3. AI clusters user journeys and shows traffic patterns
4. Click **"Generate Script"** to produce a load test script from the journeys
</details>

<details>
<summary><strong>Test 4: QA Chat Agent</strong></summary>

After any test completes, use the **chat panel** on the right side of the report to ask questions like:
- *"What caused the latency spike?"*
- *"Can you suggest a retest with different parameters?"*
- *"Summarize the test results for my manager"*
</details>

---

## 🤖 LLM Provider Support

PerfSight AI supports **10+ LLM providers** out of the box. You can hot-swap models directly from the UI Settings panel!

| Provider | Base URL | Example Models |
|---|---|---|
| **Google Gemini** *(Default)* | Vertex AI | `gemini-2.5-flash`, `gemini-2.5-pro` |
| **OpenAI** | `api.openai.com` | `gpt-4o`, `gpt-4o-mini` |
| **Anthropic** | `api.anthropic.com` | `claude-3.5-sonnet`, `claude-3.5-haiku` |
| **Groq** | `api.groq.com` | `llama-3.1-70b`, `mixtral-8x7b` |
| **OpenRouter** | `openrouter.ai` | Any model on OpenRouter |
| **DeepSeek** | `api.deepseek.com` | `deepseek-chat`, `deepseek-coder` |
| **Together AI** | `api.together.xyz` | `meta-llama/Llama-3-70b` |

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Monaco Editor, ECharts, Lucide Icons
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic
- **AI/ML:** Google Vertex AI (Gemini 2.5), scipy, pandas, sklearn
- **Database:** SQLite (aiosqlite)
- **Real-time:** WebSocket (native FastAPI)
- **Auth:** JWT (python-jose) + bcrypt (passlib)

---

<div align="center">
  Built for the <b>Feuji Hackathon</b> — Performance Testing Innovation Challenge.
  <br />
  <b>Team Pasha</b> | Powered by Google Vertex AI
</div>
