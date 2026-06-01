import asyncio
import httpx
import time
import os

API_BASE = "http://127.0.0.1:8000"

async def test_e2e_pipeline():
    print("=========================================")
    print("Starting PerfSight AI E2E Pipeline Validation")
    print("=========================================")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 0: Login to get token
        print("\n[0] Logging in...")
        login_res = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "judge@feuji.com",
            "password": "password123"
        })
        
        if login_res.status_code != 200:
            print(f"Failed to login! Please make sure seed_data.py was run. Response: {login_res.status_code} {login_res.text}")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Logged in successfully.")

        # Step 1: Parse Scenario
        print("\n[1] Parsing Natural Language Scenario...")
        scenario_desc = "Simulate 50 virtual users hitting the users endpoint for 10 seconds to check response times."
        target_url = "https://reqres.in/api/users"
        
        parse_res = await client.post(f"{API_BASE}/api/scenarios/parse", json={
            "description": scenario_desc,
            "target_url": target_url,
            "project_name": "ReqRes Load Test"
        }, headers=headers)
        
        if parse_res.status_code != 200:
            print(f"Parse Failed: {parse_res.text}")
            return
            
        parsed_scenario = parse_res.json()
        print(f"Parsed Scenario successfully. Target: {parsed_scenario.get('target_url')}, VUs: {parsed_scenario.get('parameters', {}).get('vus', 50)}")

        # Step 2: Generate Script
        print("\n[2] Generating k6 Script...")
        gen_res = await client.post(f"{API_BASE}/api/scripts/generate", json={
            "scenario": parsed_scenario,
            "tool": "k6"
        }, headers=headers)
        
        if gen_res.status_code != 200:
            print(f"Script Generation Failed: {gen_res.text}")
            return
            
        script_data = gen_res.json()
        print("Script Generated. Saving to e2e_test_script.js")
        with open("e2e_test_script.js", "w", encoding="utf-8") as f:
            f.write(script_data["script"])

        # Step 3: Execute Test
        print("\n[3] Triggering Execution Pipeline...")
        exec_res = await client.post(f"{API_BASE}/api/tests/start", json={
            "project_name": "ReqRes Load Test",
            "target_url": target_url,
            "scenario_type": parsed_scenario.get("scenario_type", "load"),
            "tool": "k6"
        }, headers=headers)
        
        if exec_res.status_code != 200:
            print(f"Execution Trigger Failed: {exec_res.text}")
            return
            
        run_data = exec_res.json()
        run_id = run_data["run_id"]
        print(f"Execution started. Run ID: {run_id}")
        
        # Step 4: Check if execution completes successfully.
        print("\n[4] Waiting for test completion and AI Report generation...")
        print("Waiting 15 seconds for simulation to finish...")
        for _ in range(15):
            print(".", end="", flush=True)
            time.sleep(1)
            
        print("\n\nE2E Pipeline Validation Complete!")
        print(f"Script saved to {os.path.abspath('e2e_test_script.js')}")

if __name__ == "__main__":
    asyncio.run(test_e2e_pipeline())
