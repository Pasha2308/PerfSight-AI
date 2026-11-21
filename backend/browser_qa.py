"""Local Playwright based browser health checks and evidence reports."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts" / "browser-qa"
MAX_LINKS = 50
TIMEOUT_MS = 20_000


def _validate_url(url: str) -> str:
    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=422, detail="Enter a valid http or https URL without embedded credentials.")
    return url


def run_browser_qa(url: str, check_links: bool = True) -> dict:
    """Check a public HTTP(S) page locally and persist a screenshot and JSON report."""
    url = _validate_url(url)
    started_at = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())
    run_dir = ARTIFACTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    console_errors: list[dict] = []
    page_errors: list[dict] = []
    broken_links: list[dict] = []
    checks: dict = {}
    links_checked = 0
    screenshot = run_dir / "page.png"

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000}, ignore_https_errors=False)
            page.set_default_timeout(TIMEOUT_MS)
            page.on("console", lambda msg: console_errors.append({"type": msg.type, "message": msg.text}) if msg.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append({"message": str(error)}))
            response = page.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
            page.wait_for_timeout(750)
            final_url = page.url
            title = page.title()
            status = response.status if response else None
            links = page.locator("a[href]").evaluate_all("els => els.map(a => ({text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 160), href: a.href}))")
            page.screenshot(path=str(screenshot), full_page=True, animations="disabled", timeout=TIMEOUT_MS)
            checks = {
                "navigation": {"passed": response is not None and status < 400, "status": status, "final_url": final_url},
                "page_title": {"passed": bool(title.strip()), "value": title},
                "page_content": {"passed": bool(page.locator("body").inner_text(timeout=TIMEOUT_MS).strip()), "text_length": len(page.locator("body").inner_text(timeout=TIMEOUT_MS).strip())},
            }
            if check_links:
                # Keep link probing bounded so large pages do not turn into an unbounded crawl.
                unique = list(dict.fromkeys(item["href"] for item in links if item.get("href", "").startswith(("http://", "https://"))))[:MAX_LINKS]
                links_checked = len(unique)
                for href in unique:
                    try:
                        link_response = page.request.get(href, timeout=5_000, max_redirects=5)
                        if link_response.status >= 400:
                            broken_links.append({"url": href, "status": link_response.status})
                    except PlaywrightError as exc:
                        broken_links.append({"url": href, "error": str(exc).splitlines()[0][:300]})
            browser.close()
    except HTTPException:
        raise
    except PlaywrightError as exc:
        raise HTTPException(status_code=422, detail=f"Browser could not complete the check: {str(exc).splitlines()[0][:500]}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Browser QA failed: {str(exc)[:500]}") from exc

    report = {
        "run_id": run_id,
        "target_url": url,
        "started_at": started_at,
        "verdict": "issues_found" if broken_links or page_errors or console_errors or not all(check.get("passed", True) for check in checks.values()) else "passed",
        "checks": checks,
        "links_checked": links_checked,
        "broken_links": broken_links,
        "console_errors": console_errors,
        "page_errors": page_errors,
        "evidence": {"screenshot": f"/api/browser-qa/artifacts/{run_id}/page.png", "report": f"/api/browser-qa/reports/{run_id}"},
    }
    (run_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def load_report(run_id: str) -> dict:
    if not re.fullmatch(r"[0-9a-f-]{36}", run_id):
        raise HTTPException(status_code=404, detail="QA report not found")
    path = ARTIFACTS_DIR / run_id / "report.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="QA report not found")
    return json.loads(path.read_text(encoding="utf-8"))
