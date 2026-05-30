"""
PerfSight AI — Vertex AI Client
Uses the google-genai SDK with Vertex AI backend.
Supports model routing: fast (Flash) for quick tasks, reasoning (Pro) for complex analysis.

Uses GCP credits via Vertex AI — no API key exposure.
"""
import os
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv

load_dotenv(override=True)

# ─── Configuration ────────────────────────────────────────────────
GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
MODEL_FAST = os.getenv("VERTEX_MODEL_FAST", "gemini-2.5-flash")
MODEL_REASONING = os.getenv("VERTEX_MODEL_REASONING", "gemini-2.5-pro")

# Fallback: if user still has GEMINI_API_KEY, use that (backwards compatible)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
USE_VERTEX = bool(GCP_PROJECT) and GEMINI_API_KEY in ("", "your_gemini_api_key_here")

_client = None


def _get_client():
    """Lazy-initialize the genai client."""
    global _client
    if _client is not None:
        return _client

    from google import genai

    if USE_VERTEX:
        # Enterprise mode: Vertex AI with GCP credentials
        _client = genai.Client(
            vertexai=True,
            project=GCP_PROJECT,
            location=GCP_LOCATION,
        )
        print(f"[AI] Using Vertex AI — Project: {GCP_PROJECT}, Location: {GCP_LOCATION}")
    else:
        # Fallback: API key mode (for local dev / quick testing)
        _client = genai.Client(api_key=GEMINI_API_KEY)
        print(f"[AI] Using Gemini API key mode (set GCP_PROJECT_ID to use Vertex AI)")

    return _client


def get_model_name(task_type: str = "fast") -> str:
    """
    Route to the right model based on task complexity.

    - 'fast': Script generation, NL parsing, reformatting, chat responses
    - 'reasoning': Root cause analysis, report generation, complex analysis
    """
    if task_type == "reasoning":
        return MODEL_REASONING
    return MODEL_FAST


async def call_gemini(
    prompt: str,
    temperature: float = 0.7,
    task_type: str = "fast",
    max_output_tokens: int = 8192,
) -> str:
    """
    Call Gemini via Vertex AI (or API key fallback).

    Args:
        prompt: The prompt to send
        temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)
        task_type: 'fast' for quick ops, 'reasoning' for complex analysis
        max_output_tokens: Maximum response length
    """
    client = _get_client()
    model = get_model_name(task_type)

    from google.genai.types import GenerateContentConfig

    config = GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=prompt,
            config=config,
        )
        return response.text.strip()
    except Exception as e:
        # If the preferred model fails, try the fallback
        fallback_model = MODEL_FAST if model == MODEL_REASONING else MODEL_REASONING
        print(f"[AI] Model {model} failed ({e}), trying {fallback_model}...")
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
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
    Call Gemini and parse the response as JSON.
    Handles markdown code fences and extracts the JSON object.
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
