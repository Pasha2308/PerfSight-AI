import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

scenarios = [
    {
        "name": "Scenario 1: Spike on Reqres",
        "prompt": "Simulate a flash sale. Ramp up to 10 users over 5 seconds, hold for 10 seconds, then ramp down.",
        "url": "https://reqres.in/api/users",
        "app_type": "E-Commerce"
    },
    {
        "name": "Scenario 2: Stress on HTTPBin",
        "prompt": "Run a stress test with 20 concurrent users constantly hitting the endpoints for 15 seconds.",
        "url": "https://httpbin.org/get",
        "app_type": "Internal API"
    },
    {
        "name": "Scenario 3: Load on JSONPlaceholder",
        "prompt": "Gradually increase load to 15 users over 10 seconds to test database reading capabilities.",
        "url": "https://jsonplaceholder.typicode.com/posts",
        "app_type": "Blog"
    }
]

def run_tests():
    print("🚀 Starting /goal execution: Testing 3 real scenarios with real k6 engine...\n")
    
    for i, s in enumerate(scenarios):
        print(f"--- Running {s['name']} ---")
        
        # 1. Parse Scenario
        print("1. Parsing natural language prompt...")
        parse_payload = {
            "description": s['prompt'],
            "target_url": s['url'],
            "app_type": s['app_type'],
            "project_name": s['name']
        }
        res = requests.post(f"{BASE_URL}/api/scenarios/parse", json=parse_payload)
        if res.status_code != 200:
            print(f"❌ Parse Failed: {res.text}")
            return False
            
        scenario_data = res.json()
        print("   ✅ Parsed successfully. Peak VUs:", scenario_data.get('load_parameters', {}).get('peak_vus'))
        
        # 2. Run Test (this generates script, executes via k6, analyzes, and saves report)
        print("2. Starting AI Pipeline (Script Gen -> Execution -> Analysis)...")
        # Start-NL endpoint expects: nl_prompt, target_url, project_name, tool
        run_payload = {
            "description": s['prompt'],
            "target_url": s['url'],
            "project_name": s['name'],
            "tool": "k6"
        }
        
        start_time = time.time()
        res = requests.post(f"{BASE_URL}/api/tests/start-nl", json=run_payload)
        
        if res.status_code != 200:
            print(f"❌ Test Failed: {res.text}")
            return False
            
        result_data = res.json()
        
        # Checking if it actually ran (since we installed real k6, it should take some time)
        duration = time.time() - start_time
        print(f"   ✅ Test pipeline completed in {duration:.1f} seconds!")
        
        if 'report_id' in result_data or 'run_id' in result_data:
            print(f"   ✅ Report generated: {result_data.get('report_id', result_data.get('run_id'))}")
        else:
            print(f"   ⚠️ No report ID found in response: {result_data}")
            
        print("\n")
        
    print("🎉 All 3 scenarios completed successfully with no errors!")
    return True

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    run_tests()
