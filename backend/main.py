import asyncio, json, uuid, time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from db.database import init_db, save_test_run, update_test_run, get_test_run, get_all_test_runs, save_chat_message, get_chat_history, get_baseline
from agents.scenario_agent import run_scenario_agent
from agents.nl_scenario_parser import parse_natural_language_scenario
from agents.script_gen_agent import run_script_gen_agent
from agents.execution_agent import simulate_test
from agents.analysis_agent import run_analysis_agent
from agents.report_agent import run_report_agent
from agents.qa_agent import run_qa_agent, SUGGESTED_QUESTIONS

# Active WebSocket connections
ws_connections: dict[str, WebSocket] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="PerfSight AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---

class StartTestRequest(BaseModel):
    project_name: str
    target_url: str
    scenario_type: str  # load, spike, stress, soak, breakpoint
    tool: str = "k6"    # k6, jmeter, gatling, locust
    nl_description: Optional[str] = None  # Natural language scenario description

class NLScenarioRequest(BaseModel):
    description: str
    target_url: str
    project_name: str

class NLStartTestRequest(BaseModel):
    description: str
    target_url: str
    project_name: str
    tool: str = "k6"

class ChatRequest(BaseModel):
    test_run_id: str
    message: str

class RetestRequest(BaseModel):
    original_run_id: str
    scenario_type: Optional[str] = None
    peak_vus: Optional[int] = None

# --- WebSocket ---

@app.websocket("/ws/{test_run_id}")
async def websocket_endpoint(websocket: WebSocket, test_run_id: str):
    await websocket.accept()
    ws_connections[test_run_id] = websocket
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        ws_connections.pop(test_run_id, None)

async def ws_send(test_run_id: str, data: dict):
    ws = ws_connections.get(test_run_id)
    if ws:
        try:
            await ws.send_json(data)
        except Exception:
            ws_connections.pop(test_run_id, None)

# --- Core Pipeline ---

async def run_full_pipeline(run_id: str, req: StartTestRequest):
    """Full autonomous pipeline: Scenario → Script → Execute → Analyze → Report"""
    try:
        # Phase 1: Scenario Agent
        await ws_send(run_id, {"phase": "scenario", "status": "running", "message": "🔍 Mapping your application and designing test scenario..."})
        scenario = await run_scenario_agent(req.target_url, req.scenario_type, req.project_name)
        await update_test_run(run_id, {"status": "scripting"})
        await ws_send(run_id, {"phase": "scenario", "status": "done", "data": scenario})

        # Phase 2: Script Generation Agent
        await ws_send(run_id, {"phase": "scripting", "status": "running", "message": f"✍️ Generating {req.tool.upper()} test script..."})
        script_result = await run_script_gen_agent(scenario, req.tool)
        await update_test_run(run_id, {"generated_script": script_result["script"], "status": "executing"})
        await ws_send(run_id, {"phase": "scripting", "status": "done", "data": script_result})

        # Phase 3: Execution Agent
        await ws_send(run_id, {"phase": "executing", "status": "running", "message": "🚀 Running performance test..."})
        all_metrics = []
        infra_metrics = []

        async def on_metric(batch):
            all_metrics.extend(batch.get("metrics", []))
            if batch.get("infra"):
                infra_metrics.append(batch["infra"])
            await ws_send(run_id, {"phase": "executing", "status": "running", "data": batch})

        raw_metrics = await simulate_test(
            scenario,
            on_metric,
            script=script_result.get("script", ""),
            tool=req.tool,
        )
        await update_test_run(run_id, {"status": "analyzing"})
        await ws_send(run_id, {"phase": "executing", "status": "done", "message": f"✅ Test complete. {len(raw_metrics)} data points collected."})

        # Phase 4: Analysis Agent
        await ws_send(run_id, {"phase": "analyzing", "status": "running", "message": "🧠 AI analyzing results — detecting anomalies and correlating metrics..."})
        baseline_data = await get_baseline(req.project_name)
        findings = await run_analysis_agent(raw_metrics, infra_metrics, scenario, baseline_data or None)
        await update_test_run(run_id, {"findings_json": json.dumps(findings), "status": "reporting"})
        await ws_send(run_id, {"phase": "analyzing", "status": "done", "data": findings})

        # Phase 5: Report Agent
        await ws_send(run_id, {"phase": "reporting", "status": "running", "message": "📝 Generating AI report with root cause analysis and remediation steps..."})
        report = await run_report_agent(findings, scenario)
        await update_test_run(run_id, {
            "report_json": json.dumps(report),
            "metrics_json": json.dumps(raw_metrics[-500:]),  # Store last 500 metrics
            "status": "completed",
            "completed_at": "CURRENT_TIMESTAMP",
        })
        await ws_send(run_id, {
            "phase": "reporting",
            "status": "done",
            "data": report,
            "message": "✅ Analysis complete! Ask me anything about the results.",
            "suggested_questions": SUGGESTED_QUESTIONS[:5],
        })

        # Phase 6: QA Agent Ready
        await ws_send(run_id, {
            "phase": "qa_ready",
            "status": "ready",
            "message": "💬 Report ready. The QA agent is available for questions, refinements, and retest suggestions.",
            "suggested_questions": SUGGESTED_QUESTIONS[:6],
        })

    except Exception as e:
        await update_test_run(run_id, {"status": "failed"})
        await ws_send(run_id, {"phase": "error", "status": "error", "message": f"Pipeline error: {str(e)}"})
        raise

# --- API Routes ---

@app.post("/api/tests/start")
async def start_test(req: StartTestRequest):
    run_id = str(uuid.uuid4())
    await save_test_run(run_id, {
        "project_name": req.project_name,
        "target_url": req.target_url,
        "scenario_type": req.scenario_type,
        "tool": req.tool,
        "status": "starting",
    })
    # Run pipeline in background
    asyncio.create_task(run_full_pipeline(run_id, req))
    return {"run_id": run_id, "status": "started"}

@app.get("/api/tests")
async def list_tests():
    return await get_all_test_runs()

@app.get("/api/tests/{run_id}")
async def get_test(run_id: str):
    run = await get_test_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run

@app.post("/api/scenarios/parse")
async def parse_scenario(req: NLScenarioRequest):
    """Parse a natural language scenario description into a test config."""
    scenario = await parse_natural_language_scenario(
        req.description, req.target_url, req.project_name
    )
    return scenario

@app.post("/api/tests/start-nl")
async def start_test_nl(req: NLStartTestRequest):
    """Start a test from a natural language description."""
    run_id = str(uuid.uuid4())
    # Parse NL scenario into config
    scenario = await parse_natural_language_scenario(
        req.description, req.target_url, req.project_name
    )
    await save_test_run(run_id, {
        "project_name": req.project_name,
        "target_url": req.target_url,
        "scenario_type": scenario["scenario_type"],
        "tool": req.tool,
        "status": "starting",
        "nl_description": req.description,
    })
    # Build a StartTestRequest-like object for the pipeline
    pipeline_req = StartTestRequest(
        project_name=req.project_name,
        target_url=req.target_url,
        scenario_type=scenario["scenario_type"],
        tool=req.tool,
        nl_description=req.description,
    )
    # Override scenario step to use NL-parsed scenario
    asyncio.create_task(_run_nl_pipeline(run_id, pipeline_req, scenario))
    return {"run_id": run_id, "status": "started", "scenario": scenario}

async def _run_nl_pipeline(run_id: str, req: StartTestRequest, pre_parsed_scenario: dict):
    """Pipeline variant that skips scenario agent and uses pre-parsed NL scenario."""
    try:
        await ws_send(run_id, {"phase": "scenario", "status": "running",
                               "message": "🔍 Analyzing your scenario description with SETI algorithm..."})
        await update_test_run(run_id, {"status": "scripting"})
        await ws_send(run_id, {"phase": "scenario", "status": "done", "data": pre_parsed_scenario})

        # Phase 2: Script Generation
        await ws_send(run_id, {"phase": "scripting", "status": "running",
                               "message": f"✍️ Generating {req.tool.upper()} test script for your scenario..."})
        script_result = await run_script_gen_agent(pre_parsed_scenario, req.tool)
        await update_test_run(run_id, {"generated_script": script_result["script"], "status": "executing"})
        await ws_send(run_id, {"phase": "scripting", "status": "done", "data": script_result})

        # Phase 3: Execution
        await ws_send(run_id, {"phase": "executing", "status": "running", "message": "🚀 Running performance test..."})
        all_metrics = []
        infra_metrics = []

        async def on_metric(batch):
            all_metrics.extend(batch.get("metrics", []))
            if batch.get("infra"):
                infra_metrics.append(batch["infra"])
            await ws_send(run_id, {"phase": "executing", "status": "running", "data": batch})

        raw_metrics = await simulate_test(
            pre_parsed_scenario, on_metric,
            script=script_result.get("script", ""), tool=req.tool,
        )
        await update_test_run(run_id, {"status": "analyzing"})
        await ws_send(run_id, {"phase": "executing", "status": "done",
                               "message": f"✅ Test complete. {len(raw_metrics)} data points collected."})

        # Phase 4: Analysis
        await ws_send(run_id, {"phase": "analyzing", "status": "running",
                               "message": "🧠 AI analyzing results..."})
        baseline_data = await get_baseline(req.project_name)
        findings = await run_analysis_agent(raw_metrics, infra_metrics, pre_parsed_scenario, baseline_data or None)
        await update_test_run(run_id, {"findings_json": json.dumps(findings), "status": "reporting"})
        await ws_send(run_id, {"phase": "analyzing", "status": "done", "data": findings})

        # Phase 5: Report
        await ws_send(run_id, {"phase": "reporting", "status": "running",
                               "message": "📝 Generating AI report with root cause analysis..."})
        report = await run_report_agent(findings, pre_parsed_scenario)
        await update_test_run(run_id, {
            "report_json": json.dumps(report),
            "metrics_json": json.dumps(raw_metrics[-500:]),
            "status": "completed",
            "completed_at": "CURRENT_TIMESTAMP",
        })
        await ws_send(run_id, {
            "phase": "reporting", "status": "done", "data": report,
            "message": "✅ Analysis complete! Ask me anything about the results.",
            "suggested_questions": SUGGESTED_QUESTIONS[:5],
        })
        await ws_send(run_id, {
            "phase": "qa_ready", "status": "ready",
            "message": "💬 Report ready. The QA agent is available for questions, refinements, and retest suggestions.",
            "suggested_questions": SUGGESTED_QUESTIONS[:6],
        })
    except Exception as e:
        await update_test_run(run_id, {"status": "failed"})
        await ws_send(run_id, {"phase": "error", "status": "error", "message": f"Pipeline error: {str(e)}"})
        raise

@app.get("/api/tests/{run_id}/report")
async def get_report(run_id: str):
    run = await get_test_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return {
        "report": run.get("report_json"),
        "findings": run.get("findings_json"),
        "script": run.get("generated_script"),
        "status": run.get("status"),
    }

@app.post("/api/chat")
async def chat(req: ChatRequest):
    run = await get_test_run(req.test_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    report = run.get("report_json") or {}
    findings = run.get("findings_json") or {}

    # Reconstruct scenario from run data — include NL description for context
    scenario = {
        "scenario_type": run.get("scenario_type"),
        "scenario_name": run.get("scenario_type", "").capitalize() + " Test",
        "target_url": run.get("target_url"),
        "nl_description": run.get("nl_description", ""),
        "load_parameters": {"peak_vus": 100},
    }

    history = await get_chat_history(req.test_run_id)
    await save_chat_message(req.test_run_id, "user", req.message)

    result = await run_qa_agent(req.message, report, scenario, history)

    await save_chat_message(req.test_run_id, "assistant", result["answer"])
    return result

@app.get("/api/chat/{run_id}/history")
async def get_history(run_id: str):
    return await get_chat_history(run_id)

@app.post("/api/tests/retest")
async def retest(req: RetestRequest):
    original = await get_test_run(req.original_run_id)
    if not original:
        raise HTTPException(status_code=404, detail="Original run not found")

    new_req = StartTestRequest(
        project_name=original.get("project_name", "Retest"),
        target_url=original.get("target_url", ""),
        scenario_type=req.scenario_type or original.get("scenario_type", "load"),
        tool=original.get("tool", "k6"),
    )
    return await start_test(new_req)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "PerfSight AI"}
