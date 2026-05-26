# PerfSight AI — Autonomous Performance Intelligence Platform

## Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Add your Gemini API Key
# Edit .env and set: GEMINI_API_KEY=your_actual_key

uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## How It Works

```
1. Enter URL + pick scenario (Load/Spike/Stress/Soak/Breakpoint)
2. Scenario Agent maps your app and designs the test
3. Script Gen Agent writes the test script (k6/JMeter/Gatling/Locust)
4. Test executes with live metrics streaming to dashboard
5. Analysis Agent runs: Anomaly Detection + Correlation + Regression
6. Report Agent generates: Executive Summary + Technical RCA + Remediation
7. QA Agent (Human-in-the-Loop): Ask questions, request refinements, trigger retest
```

## Architecture

- **Backend:** Python FastAPI (async) + WebSockets
- **AI:** Google Gemini 1.5 Pro
- **ML:** scipy (Z-score + IQR), pandas (correlation)
- **Frontend:** React + Vite + TypeScript + Apache ECharts
- **DB:** SQLite (aiosqlite)

## Get Gemini API Key

1. Go to https://aistudio.google.com/
2. Click "Get API Key"
3. Add to `backend/.env`: `GEMINI_API_KEY=your_key`
