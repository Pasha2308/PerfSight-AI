import asyncio
import os
import sys

# Add current directory to path so we can import agents
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents.gemini_client import call_gemini, LLM_PROVIDER

async def test_active_provider():
    print(f"Testing Active LLM Provider: {LLM_PROVIDER}")
    prompt = "Reply with exactly one word: 'Success'"
    try:
        response = await call_gemini(prompt, temperature=0.1, task_type="fast")
        print(f"LLM Response: {response}")
        if "success" in response.lower():
            print("✅ TEST PASSED!")
        else:
            print(f"❌ TEST FAILED: Unexpected response: {response}")
    except Exception as e:
        print(f"❌ TEST FAILED with error: {e}")

if __name__ == "__main__":
    asyncio.run(test_active_provider())
