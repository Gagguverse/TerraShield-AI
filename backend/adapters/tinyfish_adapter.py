"""TinyFish Search and Fetch integration adapter for TerraShield AI.

Connects to https://api.search.tinyfish.ai and https://api.fetch.tinyfish.ai
Preserves authentic source URLs, timestamps, provenance, and authority classifications.
Never fabricates responses or claims successful API calls when credentials are absent.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
import httpx

from backend.config import settings
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType

logger = logging.getLogger("terrashield.tinyfish")

# Known authoritative domains for wildfire intelligence (India-First & Global)
OFFICIAL_DOMAINS = [
    ".gov",
    ".gov.in",
    ".nic.in",
    "vanagni.fsi.gov.in",
    "fsi.gov.in",
    "fsi.nic.in",           # Forest Survey of India
    "ndma.gov.in",          # National Disaster Management Authority (India)
    "cwc.gov.in",           # Central Water Commission (India)
    "imd.gov.in",           # India Meteorological Department
    "pib.gov.in",           # Press Information Bureau of India
    "isro.gov.in",          # Indian Space Research Organisation
    "nrsc.gov.in",          # National Remote Sensing Centre (India)
    "moef.gov.in",          # Ministry of Environment, Forest & Climate Change
    "forest.uk.gov.in",     # Uttarakhand Forest Department
    "mahaforest.gov.in",    # Maharashtra Forest Department
    "odishaforest.in",      # Odisha Forest Department
    "forests.karnataka.gov.in", # Karnataka Forest Department
    "hptdc.in",
    "gov.bc.ca",
    "bcwildfire.ca",
    "calfire.ca.gov",
    "inciweb.wildfire.gov",
    "nifc.gov",
    "fs.usda.gov",
    "weather.gov",
    "alberta.ca",
    "ciffc.ca",
    "emergencymanagementbc.ca",
    "ready.gov",
    "fema.gov",
    "fire.ca.gov",
    "gov.yk.ca",
    "gov.nt.ca",
]

NEWS_DOMAINS = [
    # Indian News Media
    "timesofindia.indiatimes.com",
    "thehindu.com",
    "ndtv.com",
    "indianexpress.com",
    "hindustantimes.com",
    "ddnews.gov.in",
    "deccanherald.com",
    "livemint.com",
    "tribuneindia.com",
    # Global News Media
    "cbc.ca",
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "bbc.co.uk",
    "globalnews.ca",
    "ctvnews.ca",
    "theglobeandmail.com",
    "nytimes.com",
    "washingtonpost.com",
    "latimes.com",
    "sfgate.com",
    "cnn.com",
    "aljazeera.com",
    "weather.com",
]


class TinyFishAdapter:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.TINYFISH_API_KEY
        self.search_url = settings.TINYFISH_SEARCH_URL
        self.fetch_url = settings.TINYFISH_FETCH_URL
        self.last_fetch_results: Dict[str, Dict[str, Any]] = {}
        self.last_fetch_errors: Dict[str, str] = {}
        self.last_audit: Dict[str, Any] = {}

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def classify_source(self, url: str, site_name: str, title: str) -> Tuple[SourceType, bool, str]:
        """Classify source authority based on authentic domain and authority attributes."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
        except Exception:
            domain = ""

        # Check official agency domains
        for off_dom in OFFICIAL_DOMAINS:
            if domain.endswith(off_dom) or off_dom in domain:
                return SourceType.OFFICIAL_AGENCY, True, domain

        # Check emergency dispatch services
        if any(term in domain for term in ["dispatch", "pulsepoint", "broadcastify", "cad."]):
            return SourceType.EMERGENCY_DISPATCH, True, domain

        # Check curated news media domains
        for news_dom in NEWS_DOMAINS:
            if domain.endswith(news_dom) or news_dom in domain:
                return SourceType.NEWS_MEDIA, False, domain

        # General news keyword match
        if any(kw in domain or kw in site_name.lower() for kw in ["news", "times", "post", "herald", "gazette", "tribune", "radio", "press", "reuters"]):
            return SourceType.NEWS_MEDIA, False, domain

        return SourceType.UNVERIFIED, False, domain

    def evaluate_evidence_item(
        self,
        title: str,
        snippet: str,
        target_location: Optional[str] = None,
        target_date: Optional[str] = None,
        hazard_type: Optional[str] = None,
        full_text: Optional[str] = None,
        is_official: bool = False,
    ) -> Dict[str, Any]:
        """Evaluate evidence quality, relevance criteria, finding, and role."""
        combined_text = f"{title} {snippet} {full_text or ''}".lower()
        score = 0.2
        reasons = []

        wildfire_terms = [
            "wildfire", "fire", "blaze", "smoke", "evacuation", "containment",
            "burning", "forest fire", "fsi", "chir pine", "pirul", "flame", "dousing"
        ]
        flood_terms = [
            "flood", "inundation", "landslide", "debris", "cwc", "river",
            "rainfall", "submerged", "deluge", "dam", "barrage", "breach", "overflow"
        ]

        if hazard_type == "FLOOD":
            found_hazard = [t for t in flood_terms if t in combined_text]
            hazard_label = "flood/landslide"
        elif hazard_type == "WILDFIRE":
            found_hazard = [t for t in wildfire_terms if t in combined_text]
            hazard_label = "wildfire"
        else:
            found_wf = [t for t in wildfire_terms if t in combined_text]
            found_fl = [t for t in flood_terms if t in combined_text]
            if len(found_wf) >= len(found_fl) and len(found_wf) > 0:
                found_hazard = found_wf
                hazard_label = "wildfire"
            elif len(found_fl) > 0:
                found_hazard = found_fl
                hazard_label = "flood/landslide"
            else:
                found_hazard = []
                hazard_label = "hazard"

        loc_match = False
        if target_location:
            loc_lower = target_location.lower()
            sub_tokens = [
                tok.strip(" ,&()")
                for tok in loc_lower.replace("&", ",").split(",")
                if len(tok.strip(" ,&()")) >= 3
            ]
            if loc_lower in combined_text:
                loc_match = True
                reasons.append(f"Direct match for target location '{target_location}'")
            elif any(tok in combined_text for tok in sub_tokens):
                loc_match = True
                matched_toks = [tok for tok in sub_tokens if tok in combined_text]
                reasons.append(f"Regional match for location ({', '.join(matched_toks)})")

        if found_hazard:
            score += 0.35
            reasons.append(f"Contains {hazard_label} keywords ({', '.join(found_hazard[:3])})")

        if loc_match:
            score += 0.35

        date_match = False
        if target_date:
            clean_date = target_date[:10]
            year = clean_date[:4]
            if clean_date in combined_text:
                score += 0.15
                date_match = True
                reasons.append(f"Matches target date '{clean_date}'")
            elif year in combined_text:
                score += 0.10
                date_match = True
                reasons.append(f"Matches event year '{year}'")

        if not reasons:
            reasons.append("General public report")

        final_score = min(1.0, round(score, 2))

        # Qualitative relevance label based on explicit criteria
        if loc_match and found_hazard:
            relevance_label = "Relevant"
        elif loc_match or found_hazard:
            relevance_label = "Partial match"
        else:
            relevance_label = "Needs review"

        # Concise finding extracted from snippet or text
        candidate_text = snippet.strip() or (full_text.strip() if full_text else "") or title.strip()
        first_sentence = candidate_text.split(". ")[0].strip()
        if first_sentence and not first_sentence.endswith("."):
            first_sentence += "."
        finding = first_sentence[:220] if first_sentence else "Situation update reported for target area."

        # What specific aspect of the incident the source supports
        aspects = []
        if any(term in combined_text for term in ["air force", "iaf", "helicopter", "bambi bucket", "douse", "firefighter", "suppression", "containment", "personnel", "crews"]):
            aspects.append("Ground & aerial suppression operations")
        if any(term in combined_text for term in ["hectare", "acres", "burnt", "gutted", "spread", "perimeter", "forest land", "damage"]):
            aspects.append("Acreage burned & vegetative spread")
        if any(term in combined_text for term in ["heatwave", "temperature", "40°c", "wind", "dry", "pirul", "pine needles", "weather"]):
            aspects.append("Weather triggers & combustible fuel conditions")
        if any(term in combined_text for term in ["evacuation", "residents", "villages", "threat", "smoke", "alert", "advisory", "warning"]):
            aspects.append("Public safety & emergency advisories")

        supports_aspect = "; ".join(aspects) if aspects else "Regional disaster chronology & situational context"

        # Distinguish evidence role
        if is_official:
            evidence_role = "Directly reported facts (Official Agency)"
        elif any(news_key in combined_text for news_key in ["reuters", "thehindu", "ndtv", "indianexpress", "bbc", "pib"]):
            evidence_role = "Directly reported facts (Verified Journalism)"
        elif relevance_label == "Relevant":
            evidence_role = "Directly reported facts"
        elif relevance_label == "Partial match":
            evidence_role = "Contextual background"
        else:
            evidence_role = "Claims needing corroboration"

        explanation = "; ".join(reasons)

        return {
            "score": final_score,
            "explanation": explanation,
            "relevance_label": relevance_label,
            "finding": finding,
            "supports_aspect": supports_aspect,
            "evidence_role": evidence_role,
        }

    def calculate_relevance(
        self,
        title: str,
        snippet: str,
        target_location: Optional[str] = None,
        target_date: Optional[str] = None,
        hazard_type: Optional[str] = None,
    ) -> Tuple[float, str]:
        """Backward-compatible wrapper returning (score, explanation)."""
        res = self.evaluate_evidence_item(
            title=title,
            snippet=snippet,
            target_location=target_location,
            target_date=target_date,
            hazard_type=hazard_type,
        )
        return res["score"], res["explanation"]

    async def search(
        self,
        query: str,
        target_location: Optional[str] = None,
        target_date: Optional[str] = None,
        max_results: int = 5,
    ) -> Tuple[List[EvidenceRecord], Optional[str]]:
        """Backward-compatible search wrapper."""
        records, msg, _status = await self.search_and_fetch(
            query=query,
            target_location=target_location,
            target_date=target_date,
            max_results=max_results,
            do_fetch=False,
        )
        return records, msg

    async def search_and_fetch(
        self,
        query: str,
        target_location: Optional[str] = None,
        target_date: Optional[str] = None,
        hazard_type: Optional[str] = "WILDFIRE",
        max_results: int = 6,
        do_fetch: bool = True,
        return_audit: bool = False,
    ) -> Any:
        """Search public web via TinyFish Search API and fetch full content via Fetch API.

        Returns: (evidence_records, message, status) or (evidence_records, message, status, research_audit)
        """
        now_utc = datetime.now(timezone.utc).isoformat()
        research_audit = {
            "query": query,
            "queries_submitted": [query],
            "operations_completed": ["Query Construction"],
            "sources_discovered": 0,
            "pages_fetched": 0,
            "failed_requests": [],
            "retrieval_timestamps": now_utc,
        }

        if not self.is_configured:
            logger.info("TinyFish API key not configured. Returning setup instructions.")
            research_audit["operations_completed"].append("Credentials Validation (Missing Key)")
            self.last_audit = research_audit
            msg = (
                "TINYFISH_API_KEY is not configured in backend environment (.env). "
                "Register at https://www.tinyfish.ai/ to obtain an API key "
                "and set TINYFISH_API_KEY in your .env file."
            )
            if return_audit:
                return [], msg, "credentials_missing", research_audit
            return [], msg, "credentials_missing"

        headers = {
            "X-API-Key": self.api_key,
            "Accept": "application/json",
        }
        params = {"query": query}

        try:
            async with httpx.AsyncClient(timeout=14.0) as client:
                resp = await client.get(self.search_url, params=params, headers=headers)

                if resp.status_code in (401, 403):
                    research_audit["failed_requests"].append({"url": self.search_url, "reason": f"HTTP {resp.status_code} Auth error"})
                    self.last_audit = research_audit
                    res = ([], f"TinyFish authentication error (HTTP {resp.status_code}): Invalid or expired TINYFISH_API_KEY.", "error")
                    return (*res, research_audit) if return_audit else res
                elif resp.status_code == 429:
                    research_audit["failed_requests"].append({"url": self.search_url, "reason": "HTTP 429 Rate limited"})
                    self.last_audit = research_audit
                    res = ([], "TinyFish rate limit exceeded (HTTP 429). Please retry shortly.", "rate_limited")
                    return (*res, research_audit) if return_audit else res
                elif resp.status_code != 200:
                    research_audit["failed_requests"].append({"url": self.search_url, "reason": f"HTTP {resp.status_code}: {resp.text[:120]}"})
                    self.last_audit = research_audit
                    res = ([], f"TinyFish Search API error (HTTP {resp.status_code}): {resp.text[:200]}", "error")
                    return (*res, research_audit) if return_audit else res

                data = resp.json()
                raw_results = data.get("results", [])
                research_audit["operations_completed"].append("TinyFish Search API")
                research_audit["sources_discovered"] = len(raw_results)

                if not raw_results:
                    self.last_audit = research_audit
                    res = ([], f"No public reports or advisories discovered for query: '{query}'.", "empty")
                    return (*res, research_audit) if return_audit else res

                evidence_list: List[EvidenceRecord] = []
                seen_urls = set()

                for idx, item in enumerate(raw_results[:max_results]):
                    url = item.get("url", "").strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)

                    title = item.get("title", "Untitled Source").strip()
                    snippet = item.get("snippet", "").strip()
                    site_name = item.get("site_name", "")

                    source_type, is_official, domain = self.classify_source(url, site_name, title)
                    clean_source_name = site_name or domain or "Web Source"

                    evidence_record = EvidenceRecord(
                        id=f"TF-EVID-{idx + 1}-{int(datetime.now().timestamp())}",
                        source_name=clean_source_name,
                        source_type=source_type,
                        title=title,
                        url=url,
                        snippet=snippet,
                        full_text=None,
                        extracted_location=target_location,
                        latitude=None,
                        longitude=None,
                        event_date=target_date,
                        publication_date=None,
                        fetched_at=now_utc,
                        is_official=is_official,
                        domain=domain,
                        fetch_status=EvidenceStatus.ACTIVE,
                        search_query=query,
                        provenance_origin="CURRENT_SESSION",
                    )
                    evidence_list.append(evidence_record)

                # Fetch full text for top discovered URLs
                if do_fetch and evidence_list:
                    fetch_urls = [ev.url for ev in evidence_list[:4]]
                    try:
                        fetched_pages = await self.fetch_content(fetch_urls)
                        research_audit["operations_completed"].append("TinyFish Fetch API")
                        for ev in evidence_list:
                            if ev.url in fetched_pages and fetched_pages[ev.url]:
                                ev.full_text = fetched_pages[ev.url][:4000]
                                if ev.url in self.last_fetch_results:
                                    meta = self.last_fetch_results[ev.url]
                                    if meta.get("published_date"):
                                        ev.publication_date = meta["published_date"]
                            elif ev.url in self.last_fetch_errors:
                                ev.fetch_error = self.last_fetch_errors[ev.url]
                                ev.fetch_status = EvidenceStatus.FAILED
                                research_audit["failed_requests"].append({"url": ev.url, "reason": ev.fetch_error})
                    except Exception as fe:
                        logger.warning(f"Follow-up TinyFish Fetch partially failed: {fe}")
                        research_audit["failed_requests"].append({"url": "batch_fetch", "reason": str(fe)})

                research_audit["pages_fetched"] = sum(1 for ev in evidence_list if ev.full_text)

                # Evaluate quality, finding, and aspect supported for all records
                for ev in evidence_list:
                    eval_res = self.evaluate_evidence_item(
                        title=ev.title,
                        snippet=ev.snippet,
                        target_location=target_location,
                        target_date=target_date,
                        hazard_type=hazard_type,
                        full_text=ev.full_text,
                        is_official=ev.is_official,
                    )
                    ev.relevance_score = eval_res["score"]
                    ev.relevance_explanation = eval_res["explanation"]
                    ev.relevance_label = eval_res["relevance_label"]
                    ev.finding = eval_res["finding"]
                    ev.supports_aspect = eval_res["supports_aspect"]
                    ev.evidence_role = eval_res["evidence_role"]

                research_audit["operations_completed"].append("Relevance & Provenance Evaluation")
                self.last_audit = research_audit

                msg = f"Discovered {len(raw_results)} sources, successfully fetched {research_audit['pages_fetched']} pages via TinyFish."
                if return_audit:
                    return evidence_list, msg, "success", research_audit
                return evidence_list, msg, "success"

        except httpx.TimeoutException:
            logger.error("TinyFish Search API request timed out.")
            research_audit["failed_requests"].append({"url": self.search_url, "reason": "Request timed out after 14s"})
            self.last_audit = research_audit
            res = ([], "TinyFish search timed out after 14 seconds. Upstream network may be congested.", "error")
            return (*res, research_audit) if return_audit else res
        except Exception as e:
            logger.error(f"Error querying TinyFish Search: {e}")
            research_audit["failed_requests"].append({"url": self.search_url, "reason": str(e)})
            self.last_audit = research_audit
            res = ([], f"TinyFish search failed: {str(e)}", "error")
            return (*res, research_audit) if return_audit else res

    async def fetch_content(self, urls: List[str]) -> Dict[str, str]:
        """Fetch clean rendered markdown content for URLs via TinyFish Fetch API.

        Returns a dictionary of {url: text_content}.
        Also updates self.last_fetch_results and self.last_fetch_errors.
        """
        self.last_fetch_results = {}
        self.last_fetch_errors = {}

        if not self.is_configured or not urls:
            return {}

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {"urls": urls[:8]}

        try:
            async with httpx.AsyncClient(timeout=16.0) as client:
                resp = await client.post(self.fetch_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()

                    if isinstance(data, dict):
                        results_list = data.get("results", [])
                        if isinstance(results_list, list):
                            for item in results_list:
                                if isinstance(item, dict) and "url" in item:
                                    u = item["url"]
                                    txt = item.get("text") or item.get("content") or item.get("markdown") or item.get("description") or ""
                                    self.last_fetch_results[u] = {
                                        "text": txt,
                                        "title": item.get("title", ""),
                                        "published_date": item.get("published_date"),
                                    }
                        elif not results_list:
                            for k, v in data.items():
                                if k not in ("errors", "request_id"):
                                    self.last_fetch_results[k] = {"text": str(v)}

                        errors_list = data.get("errors", [])
                        if isinstance(errors_list, list):
                            for err_item in errors_list:
                                if isinstance(err_item, dict) and "url" in err_item:
                                    u = err_item["url"]
                                    self.last_fetch_errors[u] = str(err_item.get("error", "Fetch failed"))

                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and "url" in item:
                                u = item["url"]
                                txt = item.get("content") or item.get("markdown") or item.get("text") or ""
                                self.last_fetch_results[u] = {
                                    "text": txt,
                                    "title": item.get("title", ""),
                                    "published_date": item.get("published_date"),
                                }
                else:
                    for u in urls:
                        self.last_fetch_errors[u] = f"Fetch API HTTP {resp.status_code}"

        except Exception as e:
            logger.warning(f"TinyFish Fetch content failed: {e}")
            for u in urls:
                self.last_fetch_errors[u] = str(e)

        return {u: info.get("text", "") for u, info in self.last_fetch_results.items()}


tinyfish_adapter = TinyFishAdapter()

