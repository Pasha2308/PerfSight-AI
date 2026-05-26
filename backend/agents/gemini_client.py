import google.generativeai as genai
import os, json
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

def get_model(temperature: float = 0.7):
    return genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        generation_config={"temperature": temperature, "max_output_tokens": 8192},
    )

async def call_gemini(prompt: str, temperature: float = 0.7) -> str:
    model = get_model(temperature)
    response = model.generate_content(prompt)
    return response.text.strip()
