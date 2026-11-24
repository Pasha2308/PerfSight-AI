import sys, asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
import json, uuid, time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from agents.correlation_agent import analyze_jmx_for_correlation, convert_har_to_jmx, optimize_jmx
from agents.import_agent import analyze_jtl_file, analyze_k6_json, analyze_csv_results
from db.database import create_user, get_user_by_email
from auth import get_password_hash, verify_password, create_access_token
from browser_qa import ARTIFACTS_DIR, load_report, run_browser_qa
from browser_agent import ARTIFACTS_DIR as AI_QA_ARTIFACTS_DIR, get_run as get_ai_qa_run, resume_run as resume_ai_qa_run, start_run as start_ai_qa_run
from starlette.concurrency import run_in_threadpool

# Active WebSocket connections
ws_connections: dict[str, WebSocket] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="PerfSight AI", version="1.0.0", lifespan=lifespan)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/browser-qa/artifacts", StaticFiles(directory=str(ARTIFACTS_DIR)), name="browser-qa-artifacts")
AI_QA_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/ai-qa/artifacts", StaticFiles(directory=str(AI_QA_ARTIFACTS_DIR)), name="ai-qa-artifacts")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
    custom_script: Optional[str] = None  # User edited or refined script

class UserAuthRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

# --- Auth Routes ---

@app.post("/api/auth/register")
async def register(request: UserAuthRequest):
    existing = await get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed_pw = get_password_hash(request.password)
    await create_user(user_id, request.email, hashed_pw, request.name or "")
    
    token = create_access_token({"sub": user_id, "email": request.email})
    return {"access_token": token, "token_type": "bearer", "user_id": user_id, "name": request.name}

@app.post("/api/auth/login")
async def login(request: UserAuthRequest):
    user = await get_user_by_email(request.email)
    if not user or not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return {"access_token": token, "token_type": "bearer", "user_id": user["id"], "name": user["name"]}

# --- Natural Language Flow ---

class NLScenarioRequest(BaseModel):
    description: str
    target_url: str
    project_name: str

class NLStartTestRequest(BaseModel):
    description: str
    target_url: str
    project_name: str
    tool: str = "k6"
    custom_script: Optional[str] = None

class ChatRequest(BaseModel):
    test_run_id: str
    message: str

class ScriptGenRequest(BaseModel):
    scenario: dict
    tool: str = "k6"

class ScriptRefineRequest(BaseModel):
    script: str
    instruction: str
    tool: str = "k6"
    scenario: Optional[dict] = None

class RetestRequest(BaseModel):
    original_run_id: str
    scenario_type: Optional[str] = None
    peak_vus: Optional[int] = None

class BrowserQARequest(BaseModel):
    url: str
    check_links: bool = True

class AIQARunRequest(BaseModel):
    scenario: str

class AIQAResumeRequest(BaseModel):
    values: dict[str, str]

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
        if req.custom_script:
            script_result = {
                "tool": req.tool,
                "script": req.custom_script,
                "language": req.tool,
                "scenario_name": scenario.get("scenario_name", "Test"),
                "estimated_duration_sec": 30,
                "peak_vus": scenario.get("load_parameters", {}).get("peak_vus", 10),
                "sla_targets": scenario.get("sla_targets", {}),
            }
        else:
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

@app.post("/api/scripts/generate")
async def generate_script(req: ScriptGenRequest):
    """Generate a test script for a given scenario config."""
    result = await run_script_gen_agent(req.scenario, req.tool)
    return result

@app.post("/api/scripts/refine")
async def refine_script_endpoint(req: ScriptRefineRequest):
    """Refine a test script using natural language instructions."""
    from agents.gemini_client import call_gemini
    
    prompt = f"""You are a performance engineering expert. Refine the following {req.tool} test script based on the user's instructions.

ORIGINAL SCRIPT:
```
{req.script}
```

REFINEMENT INSTRUCTION:
"{req.instruction}"

CONTEXT/SCENARIO (optional):
{json.dumps(req.scenario) if req.scenario else "None"}

Please modify the script accordingly. Maintain the overall structure of the script, but apply the requested refinements exactly.
Return ONLY the modified {req.tool} test script, with no explanations, and no markdown fences."""

    refined_code = await call_gemini(prompt, temperature=0.2, task_type="fast")
    refined_code = refined_code.replace("```javascript", "").replace("```js", "").replace("```python", "").replace("```xml", "").replace("```", "").strip()
    
    return {
        "tool": req.tool,
        "script": refined_code,
        "language": req.tool,
    }

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
        custom_script=req.custom_script,
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
        if req.custom_script:
            script_result = {
                "tool": req.tool,
                "script": req.custom_script,
                "language": req.tool,
                "scenario_name": pre_parsed_scenario.get("scenario_name", "Test"),
                "estimated_duration_sec": 30,
                "peak_vus": pre_parsed_scenario.get("load_parameters", {}).get("peak_vus", 10),
                "sla_targets": pre_parsed_scenario.get("sla_targets", {}),
            }
        else:
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
    return {"status": "ok", "service": "PerfSight AI", "version": "2.0.0", "engine": "Vertex AI"}

@app.post("/api/browser-qa/run")
async def browser_qa_run(request: BrowserQARequest):
    """Run a local headless browser health check and save its evidence."""
    return await run_in_threadpool(run_browser_qa, request.url, request.check_links)

@app.get("/api/browser-qa/reports/{run_id}")
async def browser_qa_report(run_id: str):
    return load_report(run_id)

@app.post("/api/ai-qa/runs")
async def ai_qa_start(
    request: AIQARunRequest,
    x_llm_provider: str = Header(default=""),
    x_llm_key: str = Header(default=""),
    x_llm_model: str = Header(default=""),
    x_groq_key_2: str = Header(default=""),
    x_groq_key_3: str = Header(default=""),
):
    """Start a general scenario-driven browser run using the tester's configured model."""
    return start_ai_qa_run(request.scenario, x_llm_provider, x_llm_key, x_llm_model, x_groq_key_2, x_groq_key_3)

@app.get("/api/ai-qa/runs/{run_id}")
async def ai_qa_status(run_id: str):
    return get_ai_qa_run(run_id)

@app.post("/api/ai-qa/runs/{run_id}/resume")
async def ai_qa_resume(run_id: str, request: AIQAResumeRequest):
    """Resume a paused run with only the fields explicitly requested by the agent."""
    return resume_ai_qa_run(run_id, request.values)

# ─── JMeter Correlation Agent ─────────────────────────────────────

@app.post("/api/correlate/jmx")
async def correlate_jmx(file: UploadFile = File(...)):
    """Upload a JMX file and auto-correlate all dynamic values."""
    content = await file.read()
    jmx_content = content.decode("utf-8", errors="ignore")
    result = await analyze_jmx_for_correlation(jmx_content)
    return result

@app.post("/api/correlate/jmx-text")
async def correlate_jmx_text(jmx_content: str = Form(...)):
    """Submit JMX content as text and auto-correlate."""
    result = await analyze_jmx_for_correlation(jmx_content)
    return result

@app.post("/api/correlate/har")
async def correlate_har(file: UploadFile = File(...), project_name: str = Form("Recorded Test")):
    """Upload a HAR file → auto-convert to JMX → auto-correlate."""
    content = await file.read()
    har_content = content.decode("utf-8", errors="ignore")
    result = await convert_har_to_jmx(har_content, project_name)
    return result

@app.post("/api/optimize/jmx")
async def optimize_jmx_endpoint(file: UploadFile = File(...)):
    """Upload a JMX and get AI-powered optimization recommendations."""
    content = await file.read()
    jmx_content = content.decode("utf-8", errors="ignore")
    result = await optimize_jmx(jmx_content)
    return result

# ─── Test Data Import ─────────────────────────────────────────────

@app.post("/api/import/jtl")
async def import_jtl(file: UploadFile = File(...), project_name: str = Form("Imported JMeter Test")):
    """Upload a JTL file and get instant AI analysis."""
    content = await file.read()
    jtl_content = content.decode("utf-8", errors="ignore")
    result = await analyze_jtl_file(jtl_content, project_name)

    # Also run full analysis pipeline if we got metrics
    if result.get("metrics") and not result.get("error"):
        from agents.analysis_agent import run_analysis_agent
        from agents.report_agent import run_report_agent

        metrics = result["metrics"]
        scenario = {
            "scenario_type": "load",
            "scenario_name": f"Imported: {project_name}",
            "target_url": "imported",
            "app_type": "Imported",
            "load_parameters": {"peak_vus": max(m.get("vus", 1) for m in metrics)},
            "sla_targets": {"p99_ms": 500, "error_rate_pct": 1.0, "min_throughput_rps": 50},
        }

        findings = await run_analysis_agent(metrics, [], scenario, None)
        report = await run_report_agent(findings, scenario)

        result["findings"] = findings
        result["report"] = report

    return result

@app.post("/api/import/k6")
async def import_k6(file: UploadFile = File(...), project_name: str = Form("Imported k6 Test")):
    """Upload a k6 JSON output file and get instant analysis."""
    content = await file.read()
    k6_content = content.decode("utf-8", errors="ignore")
    result = await analyze_k6_json(k6_content, project_name)
    return result

@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), project_name: str = Form("Imported CSV")):
    """Upload a generic CSV results file — auto-detects format."""
    content = await file.read()
    csv_content = content.decode("utf-8", errors="ignore")
    result = await analyze_csv_results(csv_content, project_name)
    return result

# ─── CI/CD Integration ─────────────────────────────────────────────

class CITriggerRequest(BaseModel):
    project_name: str
    target_url: str
    scenario_type: str = "load"
    tool: str = "k6"
    sla_p99_ms: float = 500
    sla_error_rate_pct: float = 1.0
    nl_description: Optional[str] = None

class QualityGateRequest(BaseModel):
    run_id: str
    sla_p99_ms: float = 500
    sla_error_rate_pct: float = 1.0
    sla_min_throughput_rps: float = 50

@app.post("/api/ci/trigger")
async def ci_trigger(req: CITriggerRequest):
    """Trigger a performance test from CI/CD pipeline (GitHub Actions, Jenkins, etc.)."""
    if req.nl_description:
        from agents.nl_scenario_parser import parse_natural_language_scenario
        scenario = await parse_natural_language_scenario(
            req.nl_description, req.target_url, req.project_name
        )
        start_req = StartTestRequest(
            project_name=req.project_name,
            target_url=req.target_url,
            scenario_type=scenario["scenario_type"],
            tool=req.tool,
            nl_description=req.nl_description,
        )
    else:
        start_req = StartTestRequest(
            project_name=req.project_name,
            target_url=req.target_url,
            scenario_type=req.scenario_type,
            tool=req.tool,
        )

    result = await start_test(start_req)
    return {
        **result,
        "poll_url": f"/api/tests/{result['run_id']}",
        "report_url": f"/api/tests/{result['run_id']}/report",
        "gate_url": f"/api/ci/gate",
        "message": "Test started. Poll the poll_url for status, then call gate_url for pass/fail verdict.",
    }

@app.post("/api/ci/gate")
async def ci_quality_gate(req: QualityGateRequest):
    """
    Quality Gate for CI/CD pipelines.
    Returns pass/fail verdict based on SLA thresholds.
    Exit code 0 = PASS, 1 = FAIL.
    """
    run = await get_test_run(req.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    if run.get("status") not in ["completed", "failed"]:
        return {
            "gate": "PENDING",
            "status": run.get("status"),
            "message": "Test is still running. Poll again later.",
        }

    if run.get("status") == "failed":
        return {
            "gate": "FAIL",
            "reason": "Test execution failed",
            "exit_code": 1,
        }

    # Parse findings
    findings = run.get("findings_json") or {}
    if isinstance(findings, str):
        try:
            findings = json.loads(findings)
        except Exception:
            findings = {}

    kpis = findings.get("kpis", {})
    verdict = findings.get("verdict", {})

    failures = []
    warnings = []

    # Check SLA thresholds
    p99 = kpis.get("p99_ms", 0)
    if p99 > req.sla_p99_ms:
        failures.append(f"p99 latency {p99:.0f}ms exceeds SLA of {req.sla_p99_ms:.0f}ms")

    error_rate = kpis.get("error_rate_pct", 0)
    if error_rate > req.sla_error_rate_pct:
        failures.append(f"Error rate {error_rate:.2f}% exceeds SLA of {req.sla_error_rate_pct:.1f}%")

    throughput = kpis.get("throughput_rps", 0)
    if throughput < req.sla_min_throughput_rps:
        warnings.append(f"Throughput {throughput:.1f} RPS below target of {req.sla_min_throughput_rps:.0f} RPS")

    gate_status = "FAIL" if failures else "PASS"

    return {
        "gate": gate_status,
        "exit_code": 1 if gate_status == "FAIL" else 0,
        "failures": failures,
        "warnings": warnings,
        "kpis": {
            "p99_ms": p99,
            "p95_ms": kpis.get("p95_ms", 0),
            "error_rate_pct": error_rate,
            "throughput_rps": throughput,
            "apdex": kpis.get("apdex", 0),
            "health_score": kpis.get("health_score", 0),
        },
        "verdict": verdict,
        "report_url": f"/api/tests/{req.run_id}/report",
    }


# ─── LLM Config Routes ────────────────────────────────────────────

class LLMTestRequest(BaseModel):
    provider: str
    model: str

@app.post("/api/llm/test")
async def test_llm_connection(
    req: LLMTestRequest,
    x_llm_provider: Optional[str] = Header(default=None),
    x_llm_key: Optional[str] = Header(default=None),
    x_llm_model: Optional[str] = Header(default=None),
):
    """Test if the user's LLM API key works."""
    from fastapi import Request
    from agents.llm_router import test_connection as _test_llm
    ok = await _test_llm(
        provider=x_llm_provider or req.provider,
        api_key=x_llm_key or "",
        model=x_llm_model or req.model,
    )
    if ok:
        return {"status": "ok", "message": f"Connected to {req.provider}/{req.model}"}
    raise HTTPException(status_code=400, detail="LLM connection failed. Check API key and model name.")


# ─── Traffic Ingestion Routes (Use Case 2) ────────────────────────

from fastapi import Header

class TrafficScriptRequest(BaseModel):
    traffic_records: List[dict]
    journeys: List[dict]
    tool: str = "k6"
    project_name: str = "My Project"
    target_url: str = "https://example.com"


@app.post("/api/traffic/analyze")
async def analyze_traffic(
    file: UploadFile = File(...),
    project_name: str = Form("My Project"),
    x_llm_provider: Optional[str] = Header(None),
    x_llm_key: Optional[str] = Header(None),
    x_llm_model: Optional[str] = Header(None),
):
    """
    Upload production logs/traces → get user journey analysis.
    Accepts: Apache logs, Nginx logs, JSON logs, OTEL JSON, HAR files.
    """
    from agents.traffic_ingestion_agent import analyze_traffic_file

    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = content_bytes.decode("latin-1")

    result = await analyze_traffic_file(
        content=content,
        filename=file.filename or "upload",
        project_name=project_name,
        provider=x_llm_provider or "",
        api_key=x_llm_key or "",
        model=x_llm_model or "",
    )

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return result


@app.post("/api/traffic/generate-script")
async def generate_traffic_script(
    req: TrafficScriptRequest,
    x_llm_provider: Optional[str] = Header(None),
    x_llm_key: Optional[str] = Header(None),
    x_llm_model: Optional[str] = Header(None),
):
    """
    Take clustered user journeys and generate a realistic load test script.
    """
    from agents.traffic_ingestion_agent import generate_script_from_journeys

    result = await generate_script_from_journeys(
        journeys=req.journeys,
        target_base_url=req.target_url,
        tool=req.tool,
        project_name=req.project_name,
        provider=x_llm_provider or "",
        api_key=x_llm_key or "",
        model=x_llm_model or "",
    )
    return result

