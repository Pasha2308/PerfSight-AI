"""
PerfSight AI — Unified LLM Router
Supports model routing across Gemini (Vertex AI / Developer API), Groq, and OpenRouter.
Managed via the LLM_PROVIDER env variable for a 1-click switch.
"""
import os
import json
import asyncio
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import httpx

load_dotenv(override=True)

# ─── Configuration ────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "vertex").lower()

# Google / Vertex AI config
GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
VERTEX_MODEL_FAST = os.getenv("VERTEX_MODEL_FAST", "gemini-2.5-flash")
VERTEX_MODEL_REASONING = os.getenv("VERTEX_MODEL_REASONING", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Groq config
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "llama-3.3-70b-versatile")
GROQ_MODEL_REASONING = os.getenv("GROQ_MODEL_REASONING", "llama-3.3-70b-specdec")

# OpenRouter config
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL_FAST = os.getenv("OPENROUTER_MODEL_FAST", "google/gemini-2.5-flash")
OPENROUTER_MODEL_REASONING = os.getenv("OPENROUTER_MODEL_REASONING", "google/gemini-2.5-pro")

# Auto-detect Vertex AI mode
USE_VERTEX = bool(GCP_PROJECT) and GEMINI_API_KEY in ("", "your_gemini_api_key_here")


def _get_vertex_client():
    """Initialize the genai client for Google Vertex AI."""
    from google import genai

    if USE_VERTEX:
        return genai.Client(
            vertexai=True,
            project=GCP_PROJECT,
            location=GCP_LOCATION,
        )
    else:
        return genai.Client(api_key=GEMINI_API_KEY)


def get_model_name(task_type: str = "fast") -> str:
    """
    Route to the right model based on task complexity and provider.
    """
    if LLM_PROVIDER == "groq":
        return GROQ_MODEL_REASONING if task_type == "reasoning" else GROQ_MODEL_FAST
    elif LLM_PROVIDER == "openrouter":
        return OPENROUTER_MODEL_REASONING if task_type == "reasoning" else OPENROUTER_MODEL_FAST
    else:
        # Defaults to Gemini / Vertex AI
        return VERTEX_MODEL_REASONING if task_type == "reasoning" else VERTEX_MODEL_FAST


async def call_gemini(
    prompt: str,
    temperature: float = 0.7,
    task_type: str = "fast",
    max_output_tokens: int = 8192,
) -> str:
    """
    Unified LLM entry point. Routes requests based on LLM_PROVIDER setting.
    Maintains compatibility with all existing agents expecting `call_gemini`.
    """
    model = get_model_name(task_type)

    # 1. Groq Provider
    if LLM_PROVIDER == "groq":
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not set in environment variables.")
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            res_data = response.json()
            return res_data["choices"][0]["message"]["content"].strip()

    # 2. OpenRouter Provider
    elif LLM_PROVIDER == "openrouter":
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY is not set in environment variables.")
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "PerfSight",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            res_data = response.json()
            return res_data["choices"][0]["message"]["content"].strip()

    # 3. Default: Gemini (Vertex AI / Developer API Key fallback)
    else:
        client = _get_vertex_client()
        from google.genai.types import GenerateContentConfig

        config = GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

        retries = 3
        for attempt in range(retries):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                return response.text.strip()
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "exhausted" in err_str:
                    if attempt < retries - 1:
                        wait_time = 2 ** attempt * 5 # 5s, 10s
                        print(f"[AI] Rate limited ({e}). Waiting {wait_time}s before retry...")
                        await asyncio.sleep(wait_time)
                        continue
                
                # Route to fallback model if reasoning or fast fail and not rate limited
                fallback_model = VERTEX_MODEL_FAST if model == VERTEX_MODEL_REASONING else VERTEX_MODEL_REASONING
                print(f"[AI] Model {model} failed ({e}), trying {fallback_model}...")
                try:
                    response = await client.aio.models.generate_content(
                        model=fallback_model,
                        contents=prompt,
                        config=config,
                    )
                    return response.text.strip()
                except Exception as e2:
                    raise RuntimeError(f"Both models failed. Primary: {e}, Fallback: {e2}")


async def call_gemini_json(
    prompt: str,
    temperature: float = 0.3,
    task_type: str = "fast",
) -> dict:
    """
    Call the active LLM router and parse response as JSON.
    """
    raw = await call_gemini(prompt, temperature=temperature, task_type=task_type)

    # Strip markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()

    # Extract JSON object
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass

    # Try array
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass

    return {"raw_response": raw, "parse_error": True}
