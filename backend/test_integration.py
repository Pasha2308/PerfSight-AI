"""
PerfSight AI v2.0 — Integration Test Suite
Tests all endpoints including new correlation, import, and CI/CD features.
"""
import asyncio
import httpx
import json
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE = "http://localhost:8000"
PASS = 0
FAIL = 0

def check_result(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} - {detail}")

async def main():
    global PASS, FAIL
    async with httpx.AsyncClient(base_url=BASE, timeout=300.0) as client:

        # ─── 1. Health Check ─────────────────────────────────────
        print("\n[Test 1] Health Check")
        r = await client.get("/api/health")
        check_result("Status 200", r.status_code == 200)
        data = r.json()
        check_result("Version 2.0.0", data.get("version") == "2.0.0")
        check_result("Engine is Vertex AI", data.get("engine") == "Vertex AI")

        # ─── 2. NL Scenario Parse ────────────────────────────────
        print("\n[Test 2] NL Scenario Parse (SETI Algorithm)")
        r = await client.post("/api/scenarios/parse", json={
            "description": "Simulate 500 users booking train tickets during Tatkal opening at 10am, expect massive spike in first 2 minutes",
            "target_url": "https://www.irctc.co.in",
            "project_name": "IRCTC Load Test"
        })
        check_result("Status 200", r.status_code == 200, f"Got {r.status_code}")
        if r.status_code == 200:
            scenario = r.json()
            check_result("Has scenario_type", "scenario_type" in scenario)
            check_result("Has inferred_endpoints", "inferred_endpoints" in scenario and len(scenario["inferred_endpoints"]) > 0)
            check_result("Has load_parameters", "load_parameters" in scenario)
            check_result("Has risk_areas", "risk_areas" in scenario)
            check_result("Has extracted_entities", "extracted_entities" in scenario)
            check_result("NL description preserved", scenario.get("nl_description") != "")
            print(f"     Scenario: {scenario.get('scenario_type')} | VUs: {scenario.get('load_parameters', {}).get('peak_vus')} | Template: {scenario.get('template_key')}")

        # ─── 3. Start a Quick Test (NL Pipeline) ─────────────────
        print("\n[Test 3] Start NL Test Pipeline")
        r = await client.post("/api/tests/start-nl", json={
            "description": "Load test a REST API with 50 concurrent users for 30 seconds",
            "target_url": "https://api.example.com",
            "project_name": "API Quick Test",
            "tool": "k6"
        })
        check_result("Status 200", r.status_code == 200, f"Got {r.status_code}")
        run_id = None
        if r.status_code == 200:
            data = r.json()
            run_id = data.get("run_id")
            check_result("Got run_id", run_id is not None)
            check_result("Has scenario", "scenario" in data)
            print(f"     Run ID: {run_id}")

        # Wait for pipeline to complete
        if run_id:
            print("     Waiting for pipeline to complete (up to 180s)...")
            for _ in range(90):
                await asyncio.sleep(2)
                r = await client.get(f"/api/tests/{run_id}")
                if r.status_code == 200:
                    status = r.json().get("status")
                    if status in ("completed", "failed"):
                        break
            
            r = await client.get(f"/api/tests/{run_id}")
            if r.status_code == 200:
                run_data = r.json()
                check_result("Pipeline completed", run_data.get("status") == "completed", f"Status: {run_data.get('status')}")
            
            # ─── 4. Get Report ───────────────────────────────────
            print("\n[Test 4] Report Retrieval")
            r = await client.get(f"/api/tests/{run_id}/report")
            check_result("Status 200", r.status_code == 200)
            if r.status_code == 200:
                report = r.json()
                check_result("Has report data", report.get("report") is not None)
                check_result("Has findings", report.get("findings") is not None)
                check_result("Has script", report.get("script") is not None)

            # ─── 5. QA Chat ─────────────────────────────────────
            print("\n[Test 5] QA Agent Chat")
            r = await client.post("/api/chat", json={
                "test_run_id": run_id,
                "message": "What was the root cause of any performance issues?"
            })
            check_result("Status 200", r.status_code == 200, f"Got {r.status_code}")
            if r.status_code == 200:
                chat = r.json()
                check_result("Has answer", len(chat.get("answer", "")) > 10)
                check_result("Has intent", "intent" in chat)
                check_result("Has suggestions", len(chat.get("suggested_questions", [])) > 0)
                print(f"     Intent: {chat.get('intent')} | Answer length: {len(chat.get('answer', ''))}")

            # ─── 6. CI/CD Quality Gate ────────────────────────────
            print("\n[Test 6] CI/CD Quality Gate")
            r = await client.post("/api/ci/gate", json={
                "run_id": run_id,
                "sla_p99_ms": 500,
                "sla_error_rate_pct": 1.0,
                "sla_min_throughput_rps": 50
            })
            check_result("Status 200", r.status_code == 200)
            if r.status_code == 200:
                gate = r.json()
                check_result("Has gate verdict", gate.get("gate") in ("PASS", "FAIL"))
                check_result("Has exit_code", "exit_code" in gate)
                check_result("Has KPIs", "kpis" in gate)
                print(f"     Gate: {gate.get('gate')} | Exit code: {gate.get('exit_code')}")

        # ─── 7. JMX Correlation Test ─────────────────────────────
        print("\n[Test 7] JMX Correlation Agent")
        # Create a minimal JMX for testing
        test_jmx = """<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Test Plan" enabled="true"/>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.num_threads">10</stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="Login Request" enabled="true">
          <stringProp name="HTTPSampler.domain">example.com</stringProp>
          <stringProp name="HTTPSampler.path">/api/login</stringProp>
          <stringProp name="HTTPSampler.method">POST</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="username" elementType="HTTPArgument">
                <stringProp name="Argument.name">username</stringProp>
                <stringProp name="Argument.value">testuser</stringProp>
              </elementProp>
              <elementProp name="csrf_token" elementType="HTTPArgument">
                <stringProp name="Argument.name">csrf_token</stringProp>
                <stringProp name="Argument.value">abc123def456ghi789</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>
        </HTTPSamplerProxy>
        <hashTree/>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="Dashboard Request" enabled="true">
          <stringProp name="HTTPSampler.domain">example.com</stringProp>
          <stringProp name="HTTPSampler.path">/api/dashboard</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <stringProp name="HTTPSampler.protocol">https</stringProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="session_id" elementType="HTTPArgument">
                <stringProp name="Argument.name">session_id</stringProp>
                <stringProp name="Argument.value">JSESSIONID=a1b2c3d4e5f6</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>
        </HTTPSamplerProxy>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>"""

        r = await client.post("/api/correlate/jmx-text", data={"jmx_content": test_jmx})
        check_result("Status 200", r.status_code == 200, f"Got {r.status_code}: {r.text[:200] if r.status_code != 200 else ''}")
        if r.status_code == 200:
            corr = r.json()
            check_result("Has correlations_found", "correlations_found" in corr)
            check_result("Has correlated_jmx", "correlated_jmx" in corr and len(corr.get("correlated_jmx", "")) > 0)
            check_result("Has summary", "summary" in corr)
            check_result("Has time_saved", "time_saved_hours" in corr)
            check_result("Has validation", "validation" in corr)
            print(f"     Correlations: {corr.get('total_correlations', 0)} | Samplers: {corr.get('original_samplers', 0)} | Time saved: {corr.get('time_saved_hours', 0)}h")

        # ─── 8. JTL Import Test ──────────────────────────────────
        print("\n[Test 8] JTL Import & Analysis")
        # Create a minimal JTL CSV
        test_jtl = """timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
1716734400000,150,Login API,200,OK,Thread Group 1-1,text,true,,1024,256,10,10,https://api.example.com/login,140,0,50
1716734400100,200,Dashboard API,200,OK,Thread Group 1-1,text,true,,2048,128,10,10,https://api.example.com/dashboard,190,0,0
1716734400200,180,Login API,200,OK,Thread Group 1-2,text,true,,1024,256,10,10,https://api.example.com/login,170,0,45
1716734400300,350,Dashboard API,200,OK,Thread Group 1-2,text,true,,2048,128,10,10,https://api.example.com/dashboard,340,0,0
1716734400400,500,Login API,500,Server Error,Thread Group 1-3,text,false,,512,256,10,10,https://api.example.com/login,490,0,40
1716734400500,120,Dashboard API,200,OK,Thread Group 1-3,text,true,,2048,128,10,10,https://api.example.com/dashboard,110,0,0
1716734400600,160,Login API,200,OK,Thread Group 1-4,text,true,,1024,256,10,10,https://api.example.com/login,150,0,50
1716734400700,190,Dashboard API,200,OK,Thread Group 1-4,text,true,,2048,128,10,10,https://api.example.com/dashboard,180,0,0
1716734400800,2100,Login API,200,OK,Thread Group 1-5,text,true,,1024,256,10,10,https://api.example.com/login,2090,0,50
1716734400900,145,Dashboard API,200,OK,Thread Group 1-5,text,true,,2048,128,10,10,https://api.example.com/dashboard,135,0,0"""

        import io
        files = {"file": ("test_results.jtl", test_jtl, "text/csv")}
        r = await client.post("/api/import/jtl", files=files, data={"project_name": "Import Test"})
        check_result("Status 200", r.status_code == 200, f"Got {r.status_code}: {r.text[:200] if r.status_code != 200 else ''}")
        if r.status_code == 200:
            imp = r.json()
            check_result("Has total_metrics", imp.get("total_metrics", 0) > 0, f"Got {imp.get('total_metrics')}")
            check_result("Has KPIs", "kpis" in imp)
            check_result("Has AI summary", "ai_summary" in imp and len(imp.get("ai_summary", "")) > 0)
            check_result("Has full report", "report" in imp)
            check_result("Has findings", "findings" in imp)
            kpis = imp.get("kpis", {})
            print(f"     Metrics: {imp.get('total_metrics')} | p99: {kpis.get('p99_ms', 'N/A')}ms | Errors: {kpis.get('error_rate_pct', 'N/A')}%")

        # ─── 9. List Tests ───────────────────────────────────────
        print("\n[Test 9] List All Tests")
        r = await client.get("/api/tests")
        check_result("Status 200", r.status_code == 200)
        if r.status_code == 200:
            tests = r.json()
            check_result("Returns list", isinstance(tests, list))
            check_result("Has test runs", len(tests) > 0)
            print(f"     Total test runs: {len(tests)}")

        # ─── Summary ─────────────────────────────────────────────
        print(f"\n{'='*50}")
        print(f"  RESULTS: {PASS} passed, {FAIL} failed, {PASS+FAIL} total")
        print(f"{'='*50}")
        
        if FAIL > 0:
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
