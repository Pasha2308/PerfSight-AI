"""Live GrabOn coupon discovery and evidence-first retailer probes."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, quote_plus, urljoin, urlparse

from fastapi import HTTPException
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts" / "coupon-qa"
GRABON_CATEGORY_URLS = {
    "fashion": "https://www.grabon.in/fashion-coupons/",
    "electronics": "https://www.grabon.in/electronics-coupons/",
}
MAX_OFFERS = 8


def _open_category(page, category: str) -> str:
    if category not in GRABON_CATEGORY_URLS:
        raise HTTPException(status_code=422, detail="Category must be fashion or electronics.")
    url = GRABON_CATEGORY_URLS[category]
    response = page.goto(url, wait_until="domcontentloaded", timeout=30_000)
    if not response or response.status >= 400:
        raise HTTPException(status_code=502, detail=f"GrabOn category could not be loaded (HTTP {response.status if response else 'no response'}).")
    page.locator(".gc-box").first.wait_for(state="attached", timeout=15_000)
    return url


def _offers_from_page(page, category: str) -> list[dict]:
    return page.locator(".gc-box").evaluate_all("""cards => cards.map(card => {
      const codeEl = card.querySelector('.cpn-det-v2 [data-code]') || card.querySelector('[data-code]');
      const details = card.querySelector('.cpn-det-v2');
      const merchantLink = card.querySelector('.footer-links a[href]');
      const verified = !!card.querySelector('[data-type=verified]');
      const success = card.querySelector('[data-type=success-rate]')?.innerText?.trim() || '';
      return {
        goid: card.getAttribute('data-cid') || card.id.replace(/^cpn_/, ''),
        merchant: card.getAttribute('data-merchant') || '',
        offer_type: card.getAttribute('data-type') || '',
        title: card.querySelector('.title')?.innerText?.trim() || '',
        code: codeEl?.getAttribute('data-code') || codeEl?.innerText?.trim() || '',
        description: details?.innerText?.trim().replace(/\\s+/g, ' ').slice(0, 1400) || '',
        store_page: merchantLink?.href || '',
        store_label: merchantLink?.innerText?.trim() || '',
        verified_on_listing: verified,
        listing_success_text: success,
        card_text: (card.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 2000)
      };
    }).filter(x => x.goid && x.merchant && x.title)""")


def discover_coupon_offers(category: str) -> dict:
    """Read current GrabOn offer cards and save a screenshot of the listing."""
    if category not in GRABON_CATEGORY_URLS:
        raise HTTPException(status_code=422, detail="Category must be fashion or electronics.")
    run_id = str(uuid.uuid4())
    run_dir = ARTIFACTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    screenshot_path = run_dir / "grabon-listing.png"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            source_url = _open_category(page, category)
            offers = _offers_from_page(page, category)
            page.screenshot(path=str(screenshot_path), full_page=True, animations="disabled", timeout=30_000)
            browser.close()
    except HTTPException:
        raise
    except PlaywrightError as exc:
        raise HTTPException(status_code=502, detail=f"Could not read GrabOn offers: {str(exc).splitlines()[0][:400]}") from exc
    return {
        "discovery_id": run_id,
        "category": category,
        "source_url": source_url,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "offers": offers,
        "evidence": {"screenshot": f"/api/coupon-qa/artifacts/{run_id}/grabon-listing.png"},
    }


def _product_search_url(retailer_url: str, query: str) -> str | None:
    host = retailer_url.lower()
    term = quote_plus(query)
    if "amazon." in host:
        return f"https://www.amazon.in/s?k={term}"
    if "ajio.com" in host:
        return f"https://www.ajio.com/search/?text={term}"
    if "levi.in" in host or "levis.com" in host:
        return f"https://www.levi.in/search?q={term}"
    if "boat-lifestyle.com" in host:
        return f"https://www.boat-lifestyle.com/search?q={term}"
    if "hammeronline.in" in host:
        return f"https://hammeronline.in/search?q={term}"
    if "thebearhouse.com" in host:
        return f"https://thebearhouse.com/search?q={term}"
    return None


def _pick_product_link(page, query: str) -> dict | None:
    candidates = page.locator("a[href*='/products/']").evaluate_all("""els => els.map(a => ({
      href: a.href,
      text: (a.innerText || a.getAttribute('aria-label') || a.querySelector('img')?.alt || '').trim().replace(/\\s+/g, ' ').slice(0, 180),
      visible: !!(a.offsetWidth || a.offsetHeight)
    })).filter(x => x.href && x.visible)""")
    if not candidates:
        return None
    tokens = [x.lower() for x in re.findall(r"[a-z0-9]+", query) if x.lower() not in {"for", "the", "with", "and", "s"}]
    query_gender = "women" if re.search(r"\bwomen(?:'s|s)?\b", query, re.I) else "men" if re.search(r"\bmen(?:'s|s)?\b", query, re.I) else ""
    for item in candidates:
        item["match_score"] = sum(1 for token in tokens if token in item["text"].lower())
        product_text = item["text"].lower()
        item_gender = "women" if re.search(r"\bwomen(?:'s|s)?\b", product_text) else "men" if re.search(r"\bmen(?:'s|s)?\b", product_text) else ""
        if query_gender and item_gender:
            item["match_score"] += 4 if item_gender == query_gender else -100
    candidates.sort(key=lambda x: x["match_score"], reverse=True)
    chosen = candidates[0]
    if query_gender and chosen["match_score"] < 0:
        return None
    chosen["selection_method"] = "query_match" if chosen["match_score"] > 0 else "first_available_product"
    return chosen


def _discount_amount(checkout_text: str, code: str) -> float | None:
    pattern = rf"{re.escape(code)}\s*\(\s*[-−]?\s*₹\s*([\d,]+(?:\.\d{{1,2}})?)\s*\)"
    match = re.search(pattern, checkout_text, re.I)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def run_coupon_qa(category: str, selected: list[dict], product_query: str) -> dict:
    """Test selected live offers up to checkout, without submitting customer or payment data."""
    if category not in GRABON_CATEGORY_URLS:
        raise HTTPException(status_code=422, detail="Category must be fashion or electronics.")
    if not selected or len(selected) > MAX_OFFERS:
        raise HTTPException(status_code=422, detail=f"Select between 1 and {MAX_OFFERS} offers.")
    if len(product_query) > 120:
        raise HTTPException(status_code=422, detail="The default product query must be 120 characters or fewer.")

    started_at = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())
    run_dir = ARTIFACTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            source_url = _open_category(page, category)
            live_offers = {str(item["goid"]): item for item in _offers_from_page(page, category)}
            for selected_offer in selected:
                goid = str(selected_offer.get("goid", ""))
                query = str(selected_offer.get("product_query") or product_query).strip()
                if not query or len(query) > 120:
                    results.append({"goid": goid, "verdict": "invalid_product_query", "message": "Enter a product query up to 120 characters."})
                    continue
                offer = live_offers.get(goid)
                if not offer:
                    results.append({"goid": goid, "verdict": "stale_offer", "message": "This offer is no longer listed on the current GrabOn category page."})
                    continue

                card = page.locator(f"#cpn_{goid}")
                grabon_image = run_dir / f"offer-{goid}-grabon.png"
                try:
                    card.scroll_into_view_if_needed(timeout=5_000)
                    card.screenshot(path=str(grabon_image), timeout=10_000)
                except PlaywrightError:
                    page.screenshot(path=str(grabon_image), full_page=True, timeout=10_000)

                store_url = offer.get("store_page", "")
                outcome = {
                    **offer,
                    "product_query": query,
                    "source_url": source_url,
                    "store_page": store_url,
                    "verdict": "inconclusive",
                    "coupon_claim": "Awaiting retailer checkout response.",
                    "retailer_probe": None,
                    "product_probe": None,
                    "product_detail": None,
                    "cart_probe": None,
                    "checkout_probe": None,
                    "evidence": {"grabon_card": f"/api/coupon-qa/artifacts/{run_id}/{grabon_image.name}"},
                }

                # Each offer gets an isolated browser context and cart. Add one
                # item, submit the coupon, inspect checkout, and stop before PII or payment.
                coupon_page = browser.new_page(viewport={"width": 1440, "height": 1100})
                retailer_status = None
                try:
                    response = coupon_page.goto(f"https://www.grabon.in/load/coupon/?go={quote_plus(goid)}", wait_until="domcontentloaded", timeout=30_000)
                    retailer_status = response.status if response else None
                    final_url = coupon_page.url
                    host = re.sub(r"^www\.", "", final_url.split("/")[2].lower()) if "://" in final_url else ""
                    retailer_screenshot = run_dir / f"offer-{goid}-retailer.png"
                    coupon_page.screenshot(path=str(retailer_screenshot), full_page=True, animations="disabled", timeout=15_000)
                    body_text = coupon_page.locator("body").inner_text(timeout=5_000)[:3000]
                    gate = bool(re.search(r"access denied|robot|captcha|verify you are human|unusual traffic|please (?:sign|log) in to continue|(?:sign|log)in required|to proceed.{0,40}(?:sign|log) in", body_text, re.I))
                    outcome["retailer_probe"] = {"url": final_url, "host": host, "http_status": retailer_status, "title": coupon_page.title(), "blocked_or_login_gate": gate}
                    outcome["evidence"]["retailer_page"] = f"/api/coupon-qa/artifacts/{run_id}/{retailer_screenshot.name}"

                    if retailer_status and retailer_status < 400 and not gate and host:
                        search_url = _product_search_url(final_url, query)
                        prefer_search = "levi.in" in host and bool(re.search(r"\bmen(?:'s|s)?\b|\bwomen(?:'s|s)?\b", query, re.I))
                        product_link = None if prefer_search else _pick_product_link(coupon_page, query)
                        if not product_link and search_url:
                            search_response = coupon_page.goto(search_url, wait_until="domcontentloaded", timeout=25_000)
                            search_screenshot = run_dir / f"offer-{goid}-search.png"
                            coupon_page.screenshot(path=str(search_screenshot), full_page=True, animations="disabled", timeout=15_000)
                            outcome["evidence"]["product_search"] = f"/api/coupon-qa/artifacts/{run_id}/{search_screenshot.name}"
                            product_link = _pick_product_link(coupon_page, query)
                            outcome["product_probe"] = {"url": coupon_page.url, "http_status": search_response.status if search_response else None, "query": query, "page_has_content": bool(coupon_page.locator("body").inner_text(timeout=5_000).strip())}

                        if not product_link:
                            outcome["verdict"] = "retailer_product_not_found"
                        else:
                            product_response = coupon_page.goto(product_link["href"], wait_until="domcontentloaded", timeout=25_000)
                            coupon_page.wait_for_timeout(700)
                            product_status = product_response.status if product_response else None
                            detail_screenshot = run_dir / f"offer-{goid}-product-detail.png"
                            coupon_page.screenshot(path=str(detail_screenshot), full_page=True, animations="disabled", timeout=15_000)
                            outcome["evidence"]["product_detail"] = f"/api/coupon-qa/artifacts/{run_id}/{detail_screenshot.name}"
                            detail_text = coupon_page.locator("body").inner_text(timeout=5_000)[:6000]
                            outcome["product_detail"] = {
                                "url": coupon_page.url,
                                "http_status": product_status,
                                "title": coupon_page.title(),
                                "query": query,
                                "selection_method": product_link["selection_method"],
                                "coupon_code_visible": bool(offer.get("code") and offer["code"].upper() in detail_text.upper()),
                            }

                            product_host = urlparse(coupon_page.url).hostname or ""
                            shop_hosts = ("boat-lifestyle.com", "levi.in", "thebearhouse.com", "hammeronline.in")
                            if not product_status or product_status >= 400:
                                outcome["verdict"] = "retailer_product_page_failed"
                            elif not any(product_host == item or product_host.endswith("." + item) for item in shop_hosts):
                                outcome["verdict"] = "checkout_probe_unsupported_store"
                                outcome["coupon_claim"] = "Product loaded, but this store has no supported isolated cart adapter."
                            elif not offer.get("code") or offer["code"].upper() in {"ACTIVATE OFFER", "DEAL ACTIVATED", "NO COUPON REQUIRED"}:
                                outcome["verdict"] = "no_submitable_coupon_code"
                                outcome["coupon_claim"] = "GrabOn listed a deal without a submitable coupon code."
                            else:
                                size_index = coupon_page.locator("input[name='Size']").evaluate_all("els => els.findIndex(e => !e.disabled && !/sold out|unavailable/i.test(e.closest('label')?.innerText || e.parentElement?.innerText || ''))")
                                if size_index >= 0:
                                    coupon_page.locator("input[name='Size']").nth(size_index).check(force=True, timeout=5_000)
                                    coupon_page.wait_for_timeout(300)
                                variant_ids = coupon_page.locator("form[action*='/cart/add'] input[name='id']").evaluate_all("els => els.map(e => e.value).filter(Boolean)")
                                variant_id = variant_ids[-1] if variant_ids else None
                                if not variant_id:
                                    outcome["verdict"] = "cart_variant_not_found"
                                    outcome["coupon_claim"] = "Product page loaded, but no purchasable variant was available to test."
                                else:
                                    origin = f"{urlparse(coupon_page.url).scheme}://{urlparse(coupon_page.url).netloc}"
                                    add_response = coupon_page.request.post(urljoin(origin, "/cart/add.js"), form={"id": variant_id, "quantity": "1"}, timeout=15_000)
                                    if add_response.status >= 400:
                                        outcome["cart_probe"] = {"http_status": add_response.status, "added": False}
                                        outcome["verdict"] = "cart_add_failed"
                                        outcome["coupon_claim"] = "The retailer rejected adding the selected product to the isolated cart."
                                    else:
                                        add_data = add_response.json()
                                        outcome["cart_probe"] = {"http_status": add_response.status, "added": True, "product": add_data.get("product_title") or add_data.get("title"), "variant": add_data.get("variant_title"), "quantity": add_data.get("quantity", 1)}
                                        discount_url = urljoin(origin, f"/discount/{quote(offer['code'], safe='')}?redirect=/checkout")
                                        checkout_response = coupon_page.goto(discount_url, wait_until="domcontentloaded", timeout=35_000)
                                        coupon_page.wait_for_timeout(1_500)
                                        checkout_screenshot = run_dir / f"offer-{goid}-checkout.png"
                                        coupon_page.screenshot(path=str(checkout_screenshot), full_page=True, animations="disabled", timeout=20_000)
                                        outcome["evidence"]["checkout"] = f"/api/coupon-qa/artifacts/{run_id}/{checkout_screenshot.name}"
                                        checkout_text = coupon_page.locator("body").inner_text(timeout=8_000)[:12_000]
                                        # Count a coupon as proven only when checkout shows its code and a positive INR discount.
                                        amount = _discount_amount(checkout_text, offer["code"])
                                        applied = amount is not None and amount > 0 and offer["code"].upper() in checkout_text.upper()
                                        outcome["checkout_probe"] = {
                                            "url": coupon_page.url,
                                            "http_status": checkout_response.status if checkout_response else None,
                                            "title": coupon_page.title(),
                                            "coupon_code": offer["code"],
                                            "coupon_accepted": applied,
                                            "discount_amount_inr": amount,
                                            "personal_details_entered": False,
                                            "payment_submitted": False,
                                        }
                                        outcome["verdict"] = "coupon_applied_discount_confirmed" if applied else "coupon_not_confirmed_at_checkout"
                                        outcome["coupon_claim"] = f"Retailer checkout displayed {offer['code']} with ₹{amount:.2f} off." if applied else "The code did not appear with a positive discount in checkout; inspect the screenshot for the retailer message."
                    elif gate or (retailer_status and retailer_status >= 400):
                        outcome["verdict"] = "retailer_blocked_inconclusive"
                    coupon_page.close()
                except PlaywrightError as exc:
                    outcome["retailer_probe"] = {"url": coupon_page.url, "http_status": retailer_status, "error": str(exc).splitlines()[0][:350]}
                    outcome["verdict"] = "retailer_navigation_error_inconclusive"
                    coupon_page.close()
                results.append(outcome)
            browser.close()
    except HTTPException:
        raise
    except PlaywrightError as exc:
        raise HTTPException(status_code=502, detail=f"Coupon QA could not complete: {str(exc).splitlines()[0][:400]}") from exc

    report = {
        "run_id": run_id,
        "category": category,
        "product_query": product_query.strip(),
        "started_at": started_at,
        "source_url": GRABON_CATEGORY_URLS[category],
        "verdict": "coupon_discounts_confirmed" if results and all(x.get("verdict") == "coupon_applied_discount_confirmed" for x in results) else "completed_with_unconfirmed_offers",
        "purchase_performed": False,
        "login_attempted": False,
        "personal_details_entered": False,
        "offers": results,
    }
    report["evidence"] = {"report": f"/api/coupon-qa/reports/{run_id}"}
    (run_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def load_coupon_report(run_id: str) -> dict:
    if not re.fullmatch(r"[0-9a-f-]{36}", run_id):
        raise HTTPException(status_code=404, detail="Coupon QA report not found")
    path = ARTIFACTS_DIR / run_id / "report.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Coupon QA report not found")
    return json.loads(path.read_text(encoding="utf-8"))
