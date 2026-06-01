import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://localhost:5173"

def run_live_demo():
    print("🚀 Starting the automated Live Demo driver...")
    print("Please make sure you have started your screen recording!")
    
    with sync_playwright() as p:
        # Launch Chromium visibly, maximizing the window
        browser = p.chromium.launch(headless=False, args=['--start-maximized'])
        context = browser.new_context(no_viewport=True)
        page = context.new_page()
        
        # --- 1. LOGIN ---
        print("🎬 Scene 1: Login")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_timeout(2000)
        
        # Type like a human
        page.type("input[type='email']", "judge@feuji.com", delay=50)
        page.wait_for_timeout(500)
        page.type("input[type='password']", "password123", delay=50)
        page.wait_for_timeout(1000)
        page.click("button[type='submit']")
        
        # Wait for dashboard to load
        page.wait_for_selector(".layout-dashboard", timeout=10000)
        page.wait_for_timeout(4000) # Let them look at the dashboard
        
        # --- 2. AI SCENARIO DESIGNER ---
        print("🎬 Scene 2: AI Scenario Designer")
        page.goto(f"{BASE_URL}/")
        page.click("text='AI Scenario Designer'")
        page.wait_for_timeout(2000)
        
        page.type("input[placeholder='Project Name']", "Black Friday Flash Sale", delay=70)
        page.wait_for_timeout(500)
        page.type("input[placeholder='Target URL']", "https://api.retail.com/checkout", delay=60)
        page.wait_for_timeout(1000)
        
        # Type the complex prompt slowly
        prompt = "We are expecting a massive traffic spike at 8 AM. Ramp up to 5000 users over 2 minutes, hold for 10 minutes, and then simulate a sudden database failure by dropping to 0."
        page.type("textarea", prompt, delay=40)
        page.wait_for_timeout(1500)
        
        page.click("button:has-text('Generate Execution Plan')")
        print("Waiting for AI to generate JSON...")
        page.wait_for_selector(".monaco-editor", timeout=20000)
        page.wait_for_timeout(5000) # Let them read the JSON output
        
        # --- 3. SCRIPT GENERATION ---
        print("🎬 Scene 3: Script Generation")
        page.goto(f"{BASE_URL}/")
        page.click("text='Generate Script'")
        page.wait_for_timeout(2000)
        
        page.select_option("select", "k6")
        page.wait_for_timeout(1000)
        page.click("button:has-text('Generate Script')")
        print("Waiting for AI to write code...")
        page.wait_for_selector(".monaco-editor", timeout=20000)
        page.wait_for_timeout(6000) # Let them read the code
        
        # --- 4. RCA & REPORTING ---
        print("🎬 Scene 4: Viewing the AI RCA Report")
        page.goto(f"{BASE_URL}/")
        page.click("text='Test Executions'")
        page.wait_for_timeout(2000)
        
        # Click the first row in the table
        page.click("tr.table-row")
        page.wait_for_selector(".card", timeout=10000)
        page.wait_for_timeout(4000) # Look at the top metrics
        
        # Scroll down slowly to show RCA
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(4000)
        page.mouse.wheel(0, 600)
        page.wait_for_timeout(5000)
        
        # End of Demo
        print("✅ Demo finished. Closing browser in 5 seconds...")
        page.wait_for_timeout(5000)
        
        context.close()
        browser.close()

if __name__ == "__main__":
    run_live_demo()
