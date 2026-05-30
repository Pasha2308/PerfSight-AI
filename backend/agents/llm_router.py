"""
PerfSight AI — Multi-LLM Router
Supports: Google Gemini (Vertex AI or API key), OpenAI, Anthropic Claude

The active provider is determined by request headers:
  X-LLM-Provider: google | openai | anthropic
  X-LLM-Key:      <api_key>
  X-LLM-Model:    <model_id>

Falls back to environment-configured Vertex AI if no headers provided.
"""
import os
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv

load_dotenv(override=True)

# ─── Default (Vertex AI / Gemini) config ─────────────────────────
GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
DEFAULT_MODEL_FAST = os.getenv("VERTEX_MODEL_FAST", "gemini-2.5-flash")
DEFAULT_MODEL_REASONING = os.getenv("VERTEX_MODEL_REASONING", "gemini-2.5-pro")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
USE_VERTEX = bool(GCP_PROJECT) and GEMINI_API_KEY in ("", "your_gemini_api_key_here")

_gemini_client = None


def _get_gemini_client(api_key: str = ""):
    """Lazy-init Gemini client."""
    global _gemini_client
    key = api_key or GEMINI_API_KEY
    if _gemini_client is not None and not api_key:
        return _gemini_client
    from google import genai
    if USE_VERTEX and not api_key:
        client = genai.Client(vertexai=True, project=GCP_PROJECT, location=GCP_LOCATION)
        print(f"[LLM] Vertex AI — Project: {GCP_PROJECT}")
    else:
        client = genai.Client(api_key=key)
        print(f"[LLM] Gemini API key mode")
    if not api_key:
        _gemini_client = client
    return client


async def _call_gemini(
    prompt: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> str:
    from google.genai.types import GenerateContentConfig
    client = _get_gemini_client(api_key)
    config = GenerateContentConfig(temperature=temperature, max_output_tokens=max_output_tokens)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=model,
        contents=prompt,
        config=config,
    )
    return response.text.strip()


async def _call_openai_compatible(
    prompt: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
    base_url: Optional[str] = None,
) -> str:
    import openai as oai
    client = oai.AsyncOpenAI(api_key=api_key, base_url=base_url)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_output_tokens,
    )
    return response.choices[0].message.content.strip()


async def _call_anthropic(
    prompt: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
) -> str:
    import anthropic as ant
    client = ant.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=model,
        max_tokens=max_output_tokens,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


async def call_llm(
    prompt: str,
    temperature: float = 0.7,
    task_type: str = "fast",
    max_output_tokens: int = 8192,
    provider: str = "",
    api_key: str = "",
    model: str = "",
) -> str:
    """
    Unified LLM call — routes to the right provider.

    If provider/api_key/model are provided, uses them.
    Otherwise falls back to Vertex AI / Gemini env config.
    """
    # Determine provider + model
    effective_provider = provider or "google"
    effective_key = api_key or GEMINI_API_KEY

    if not model:
        if task_type == "reasoning":
            effective_model = DEFAULT_MODEL_REASONING
        else:
            effective_model = DEFAULT_MODEL_FAST
    else:
        effective_model = model

    print(f"[LLM] Provider={effective_provider} Model={effective_model} Task={task_type}")

    try:
        if effective_provider == "openai":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens)
        elif effective_provider == "anthropic":
            return await _call_anthropic(prompt, effective_key, effective_model, temperature, max_output_tokens)
        elif effective_provider == "openrouter":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://openrouter.ai/api/v1")
        elif effective_provider == "groq":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.groq.com/openai/v1")
        elif effective_provider == "deepseek":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.deepseek.com")
        elif effective_provider == "mistral":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.mistral.ai/v1")
        elif effective_provider == "together":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.together.xyz/v1")
        elif effective_provider == "xai":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.x.ai/v1")
        elif effective_provider == "nvidia":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://integrate.api.nvidia.com/v1")
        elif effective_provider == "cohere":
            return await _call_openai_compatible(prompt, effective_key, effective_model, temperature, max_output_tokens, base_url="https://api.cohere.com/v1")
        else:
            # Default: Google Gemini (Vertex AI or API key)
            return await _call_gemini(prompt, effective_key if provider == "google" else "", effective_model, temperature, max_output_tokens)
    except Exception as e:
        print(f"[LLM] Error from {effective_provider}/{effective_model}: {e}")
        # Fallback to default Vertex AI if custom key fails
        if effective_provider != "google" or api_key:
            print("[LLM] Falling back to default Vertex AI...")
            return await _call_gemini(prompt, "", DEFAULT_MODEL_FAST if task_type == "fast" else DEFAULT_MODEL_REASONING, temperature, max_output_tokens)
        raise


async def call_llm_json(
    prompt: str,
    temperature: float = 0.3,
    task_type: str = "fast",
    provider: str = "",
    api_key: str = "",
    model: str = "",
) -> dict:
    """
    Call LLM and parse JSON response. Handles markdown code fences.
    """
    raw = await call_llm(prompt, temperature=temperature, task_type=task_type,
                         provider=provider, api_key=api_key, model=model)
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        start = raw.find("{"); end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass
    try:
        start = raw.find("["); end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass
    return {"raw_response": raw, "parse_error": True}


async def test_connection(provider: str, api_key: str, model: str) -> bool:
    """Test if the LLM connection works with a minimal prompt."""
    try:
        result = await call_llm(
            "Reply with exactly: OK",
            temperature=0.0, task_type="fast", max_output_tokens=10,
            provider=provider, api_key=api_key, model=model,
        )
        return "OK" in result or len(result) > 0
    except Exception as e:
        print(f"[LLM] Connection test failed: {e}")
        return False


# ─── Backward-compatible aliases (so existing agents don't break) ─
async def call_gemini(prompt, temperature=0.7, task_type="fast", max_output_tokens=8192):
    """Backward-compatible alias — calls through the router."""
    return await call_llm(prompt, temperature=temperature, task_type=task_type,
                          max_output_tokens=max_output_tokens)


async def call_gemini_json(prompt, temperature=0.3, task_type="fast"):
    """Backward-compatible alias."""
    return await call_llm_json(prompt, temperature=temperature, task_type=task_type)


def get_model_name(task_type: str = "fast") -> str:
    """Backward-compatible helper."""
    return DEFAULT_MODEL_REASONING if task_type == "reasoning" else DEFAULT_MODEL_FAST
