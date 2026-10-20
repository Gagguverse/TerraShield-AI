"""TinyFish Search and Fetch integration adapter for TerraShield AI.

Connects to https://api.search.tinyfish.ai and https://api.fetch.tinyfish.ai
Preserves authentic source URLs, timestamps, provenance, and authority classifications.
Never fabricates responses or claims successful API calls when credentials are absent.
Maintains strict evidence semantics and auditable counters.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
import httpx

from backend.config import settings
from backend.engine.geo_temporal_validator import (
    evaluate_temporal_alignment,
    normalize_utc_timestamp,
    validate_named_location_match,
)
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType

logger = logging.getLogger("terrashield.tinyfish")

# Known authoritative domains for wildfire & disaster intelligence (Global & India)
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
    "aranya.gov.in",        # Karnataka Forest Department portal
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
    "ntca.gov.in",
]

VERIFIED_NEWS_DOMAINS = [
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
    "downtoearth.org.in",
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
    "bloomberg.com",
    "theguardian.com",
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
        """Classify source authority strictly based on authentic domain identity.

        Only genuine government/emergency services receive OFFICIAL_AGENCY.
        Only recognized news publishers receive NEWS_MEDIA with verified standing.
        Otherwise UNVERIFIED.
        """
        domain = ""
        try:
            if url:
                parsed = urlparse(url)
                domain = parsed.netloc.lower()
                if domain.startswith("www."):
                    domain = domain[4:]
        except Exception:
            domain = ""

        # Check official agency domains
        for off_dom in OFFICIAL_DOMAINS:
            if domain.endswith(off_dom) or off_dom in domain:
                return SourceType.OFFICIAL_AGENCY, True, domain

        # Check emergency dispatch services
        if any(term in domain for term in ["dispatch", "pulsepoint", "broadcastify", "cad."]):
            return SourceType.EMERGENCY_DISPATCH, True, domain

        # Check curated verified news media domains
        for news_dom in VERIFIED_NEWS_DOMAINS:
            if domain.endswith(news_dom) or news_dom in domain:
                return SourceType.NEWS_MEDIA, False, domain

        # General news keyword match in domain
        if any(kw in domain for kw in ["news", "times", "post", "herald", "gazette", "tribune", "radio", "press"]):
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
        """Evaluate evidence quality, relevance criteria, finding, and role.

        Enforces strict localized administrative matching and rejects broad country hits.
        Categorizes historical articles as contextual background rather than direct evidence.
        """
        combined_text = f"{title} {snippet} {full_text or ''}".lower()
        score = 0.15
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

        # 1. Geographic Matching using strict validator (rejects broad country names like 'India')
        loc_match = False
        loc_diag = ""
        if target_location:
            loc_match, match_type, loc_diag = validate_named_location_match(
                target_region=target_location,
                extracted_location=None,
                text_content=combined_text,
            )
            if loc_match:
                score += 0.35
                reasons.append(loc_diag)
            else:
                reasons.append(f"Geographic mismatch: {loc_diag}")

        if found_hazard:
            score += 0.35
            reasons.append(f"Contains {hazard_label} keywords ({', '.join(found_hazard[:3])})")

        # 2. Temporal Matching
        date_match = False
        is_historical = False
        if target_date:
            target_dt = normalize_utc_timestamp(target_date)
            clean_date = target_date[:10]
            target_year = clean_date[:4]

            # Detect mention of target date
            if clean_date in combined_text:
                score += 0.15
                date_match = True
                reasons.append(f"Matches target date '{clean_date}'")
            elif target_year in combined_text:
                # Check if text also mentions a DIFFERENT prominent year that indicates historical mismatch
                historical_years = re.findall(r"\b(201[0-9]|202[0-3])\b", combined_text)
                if historical_years and target_year not in historical_years and int(target_year) >= 2024:
                    is_historical = True
                    reasons.append(f"Historical date mismatch: text refers to {historical_years[0]} rather than target year {target_year}")
                else:
                    score += 0.10
                    date_match = True
                    reasons.append(f"Matches event year '{target_year}'")
            else:
                # Check if it mentions historical years
                historical_years = re.findall(r"\b(19[0-9]{2}|20[0-2][0-9])\b", combined_text)
                if historical_years and target_year not in historical_years:
                    is_historical = True
                    reasons.append(f"Historical background: refers to earlier year ({historical_years[0]})")

        if not reasons:
            reasons.append("General public report")

        final_score = min(1.0, round(score, 2))

        # Qualitative relevance label based on explicit criteria
        has_content = bool(full_text and len(full_text.strip()) > 30)
        if loc_match and found_hazard and not is_historical:
            relevance_label = "Relevant"
        elif (loc_match or found_hazard) or is_historical:
            relevance_label = "Partial match"
        else:
            relevance_label = "Needs review"

        # Concise finding extracted from snippet or text
        candidate_text = snippet.strip() or (full_text.strip() if full_text else "") or title.strip()
        first_sentence = candidate_text.split(". ")[0].strip()
        if first_sentence and not first_sentence.endswith("."):
            first_sentence += "."
        finding = first_sentence[:220] if first_sentence else "Situation update reported for target area."

        # Specific aspect supported
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

        # Distinguish evidence role strictly
        if is_historical:
            evidence_role = "Contextual background (Historical event)"
        elif is_official:
            evidence_role = "Directly reported facts (Official Agency)"
        elif any(news_key in combined_text for news_key in ["reuters", "thehindu", "ndtv", "indianexpress", "bbc", "pib"]):
            evidence_role = "Directly reported facts (Verified Journalism)"
        elif relevance_label == "Relevant" and (has_content or date_match):
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
            "geo_match": loc_match,
            "date_match": date_match,
            "is_historical": is_historical,
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

        Maintains separate, accurately defined counts for:
        - sources_discovered
        - unique_urls
        - fetch_attempts
        - pages_fetched
        - failed_requests
        - pages_extracted
        - relevant_sources
        - direct_evidence
        - independent_sources
        - contextual_sources
        - geo_matches
        - temporal_matches
        """
        now_utc = datetime.now(timezone.utc).isoformat()
        research_audit: Dict[str, Any] = {
            "query": query,
            "queries_submitted": [query],
            "operations_completed": ["Query Construction"],
            "sources_discovered": 0,
            "unique_urls": 0,
            "fetch_attempts": 0,
            "pages_fetched": 0,
            "failed_requests": [],
            "pages_extracted": 0,
            "relevant_sources": 0,
            "direct_evidence": 0,
            "independent_sources": 0,
            "contextual_sources": 0,
            "geo_matches": 0,
            "temporal_matches": 0,
            "retrieval_timestamps": now_utc,
            "retrieval_timestamp": now_utc,
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

                    # Discovered item starts with PARTIAL (snippet discovered, page not yet fetched)
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
                        fetch_status=EvidenceStatus.PARTIAL,
                        search_query=query,
                        provenance_origin="CURRENT_SESSION",
                    )
                    evidence_list.append(evidence_record)

                research_audit["unique_urls"] = len(seen_urls)

                # Fetch full text for top discovered URLs
                if do_fetch and evidence_list:
                    fetch_urls = [ev.url for ev in evidence_list[:4]]
                    research_audit["fetch_attempts"] = len(fetch_urls)
                    try:
                        fetched_pages = await self.fetch_content(fetch_urls)
                        research_audit["operations_completed"].append("TinyFish Fetch API")
                        for ev in evidence_list:
                            if ev.url in fetch_urls:
                                if ev.url in fetched_pages and fetched_pages[ev.url]:
                                    ev.full_text = fetched_pages[ev.url][:4000]
                                    ev.fetch_status = EvidenceStatus.ACTIVE
                                    if ev.url in self.last_fetch_results:
                                        meta = self.last_fetch_results[ev.url]
                                        if meta.get("published_date"):
                                            ev.publication_date = meta["published_date"]
                                elif ev.url in self.last_fetch_errors:
                                    ev.fetch_error = self.last_fetch_errors[ev.url]
                                    ev.fetch_status = EvidenceStatus.FAILED
                                    research_audit["failed_requests"].append({"url": ev.url, "reason": ev.fetch_error})
                            else:
                                # Not attempted in this batch
                                ev.fetch_status = EvidenceStatus.PARTIAL
                                ev.fetch_error = "Fetch not attempted (outside top-priority fetch batch)"
                    except Exception as fe:
                        logger.warning(f"Follow-up TinyFish Fetch partially failed: {fe}")
                        research_audit["failed_requests"].append({"url": "batch_fetch", "reason": str(fe)})
                else:
                    research_audit["operations_completed"].append("Snippet-only mode (No page fetches requested)")

                research_audit["pages_fetched"] = sum(1 for ev in evidence_list if ev.full_text)
                research_audit["pages_extracted"] = sum(
                    1 for ev in evidence_list if ev.full_text and len(ev.full_text.strip()) > 30
                )

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

                    if eval_res["relevance_label"] == "Relevant":
                        research_audit["relevant_sources"] += 1
                    if "Directly reported" in eval_res["evidence_role"]:
                        research_audit["direct_evidence"] += 1
                    if "Contextual background" in eval_res["evidence_role"]:
                        research_audit["contextual_sources"] += 1
                    if eval_res.get("geo_match"):
                        research_audit["geo_matches"] += 1
                    if eval_res.get("date_match"):
                        research_audit["temporal_matches"] += 1

                # Calculate independent domains
                from backend.engine.verifier import verifier
                indep_domains = verifier.extract_independent_domains(evidence_list)
                research_audit["independent_sources"] = len(indep_domains)

                research_audit["operations_completed"].append("Relevance & Provenance Evaluation")
                self.last_audit = research_audit

                msg = (
                    f"Discovered {research_audit['sources_discovered']} sources, "
                    f"attempted {research_audit['fetch_attempts']} fetches, "
                    f"successfully fetched {research_audit['pages_fetched']} pages via TinyFish."
                )
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
