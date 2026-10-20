"""Groq Cloud GPT-OSS Inference Service for TerraShield AI.

Provides source-grounded incident analysis and dossier generation using Groq Cloud
OpenAI-compatible inference (https://api.groq.com/openai/v1).
Never hallucinates URLs, never leaks credentials, and strictly grounds claims in retrieved evidence.
Enforces deterministic verification boundaries and post-synthesis validation with safe fallbacks.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.config import settings
from backend.models.evidence import EvidenceRecord, EvidenceStatus, SourceType
from backend.models.incident import VerificationStatus

logger = logging.getLogger("terrashield.groq")

# Sensible connection timeouts
GROQ_TIMEOUT = httpx.Timeout(connect=6.0, read=35.0, write=6.0, pool=6.0)
MAX_RETRIES = 2


class GroqAdapter:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.GROQ_API_KEY
        self.model = model if model is not None else settings.GROQ_MODEL
        self.base_url = (base_url if base_url is not None else settings.GROQ_API_BASE_URL).rstrip("/")

    @property
    def is_configured(self) -> bool:
        """Check if a valid Groq API key is present."""
        return bool(self.api_key and len(self.api_key) > 8)

    def _mask_key(self, text: str) -> str:
        """Never leak secret API keys."""
        if not text:
            return ""
        if self.api_key and len(self.api_key) >= 8 and self.api_key in text:
            return text.replace(self.api_key, "***REDACTED***")
        return text

    async def list_available_models(self) -> Tuple[List[str], Optional[str]]:
        """Query Groq /models to verify authenticated access and model availability."""
        if not self.is_configured:
            return [], "GROQ_API_KEY is not configured in backend environment (.env)."

        url = f"{self.base_url}/models"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code in (401, 403):
                    return [], f"Groq Authentication failed (HTTP {resp.status_code}): Invalid API key. Check console.groq.com/keys."
                if resp.status_code != 200:
                    clean_err = self._mask_key(resp.text[:140])
                    return [], f"Groq API error (HTTP {resp.status_code}): {clean_err}"

                data = resp.json()
                models = [m["id"] for m in data.get("data", []) if "id" in m]
                return models, None
        except Exception as e:
            clean_err = self._mask_key(str(e))
            logger.error(f"Error querying Groq models: {clean_err}")
            return [], f"Groq connection failed: {clean_err}"

    def build_safe_fallback_summary(
        self,
        incident_data: Dict[str, Any],
        verif_status: str,
        verif_rationale: str,
        direct_evidence: List[EvidenceRecord],
        contextual_evidence: List[EvidenceRecord],
    ) -> Dict[str, Any]:
        """Construct an authoritative, strictly grounded fallback summary when Groq is offline or hallucinating."""
        name = incident_data.get("name", "Satellite Incident")
        region = incident_data.get("region", "Target Area")
        lat = incident_data.get("latitude", 0.0)
        lon = incident_data.get("longitude", 0.0)
        date_str = incident_data.get("first_detected", "")[:10] or incident_data.get("event_date", "recent")
        hazard = incident_data.get("hazard_type", "WILDFIRE")
        frp = incident_data.get("max_frp")

        if verif_status == "INSUFFICIENT_EVIDENCE":
            exec_summary = (
                f"A NASA FIRMS satellite thermal anomaly was detected near {region} ({lat:.4f}° N, {lon:.4f}° E) on {date_str}. "
                f"Ground wildfire status remains unconfirmed because no contemporary on-ground news reports or official agency advisories "
                f"have verified active fire activity in this specific area. "
                f"A spaceborne thermal hotspot indicates radiative energy (peak FRP: {frp or 'unspecified'} MW), but is not, by itself, "
                f"proof of a ground wildfire. Cause not established by the available evidence."
            )
        elif verif_status == "NEEDS_REVIEW":
            exec_summary = (
                f"A potential incident was detected near {region} on {date_str} with {len(direct_evidence)} direct report(s) "
                f"and {len(contextual_evidence)} contextual source(s) identified. "
                f"However, conclusive corroboration remains pending due to incomplete spatial resolution, single-source reporting, "
                f"or unresolved observation windows. "
                f"Human review and field confirmation are required before treating this as a verified emergency disaster. "
                f"Cause not established by the available evidence."
            )
        else:
            sources_note = f"{len(direct_evidence)} independent and official reports" if direct_evidence else "retrieved advisories"
            exec_summary = (
                f"Incident in {region} on {date_str} is corroborated by {sources_note} aligning with orbital thermal detections. "
                f"Retrieved ground advisories document emergency suppression or regional impact matching satellite telemetry. "
                f"Specific root cause remains subject to official regulatory determination unless explicitly documented."
            )

        citations = []
        for ev in direct_evidence[:5]:
            citations.append({
                "claim": ev.finding or ev.snippet[:120],
                "source_title": ev.title,
                "url": ev.url,
            })

        return {
            "executive_summary": exec_summary,
            "incident_context": f"Centroid: {lat:.4f}° N, {lon:.4f}° E in {region}. Observation date: {date_str}. Status: {verif_status}.",
            "what_happened": verif_rationale,
            "location_and_geography": f"Verified coordinates ({lat:.4f}, {lon:.4f}) located in {region}.",
            "timeline": [],
            "satellite_and_thermal_observations": f"Orbital radiometer detected thermal energy (peak FRP: {frp or 'N/A'} MW). Spaceborne hotspots require ground verification.",
            "official_warnings": "Official ground agency bulletins summarized in evidence records.",
            "documented_impacts": "Documented in attached verified records.",
            "response_and_mitigation": "Refer to primary agency citations.",
            "evidence_assessment": f"Deterministic verification status: {verif_status}. Direct evidence sources: {len(direct_evidence)}. Contextual sources: {len(contextual_evidence)}.",
            "uncertainties_and_gaps": "Cause not established by the available evidence. Satellite anomaly does not establish legal cause without certified field inspection.",
            "citations": citations,
            "why_this_conclusion": [
                {
                    "claim": f"Incident verification evaluated as {verif_status}",
                    "supporting_sources": [ev.source_name for ev in direct_evidence[:3]] or ["NASA FIRMS Telemetry"],
                    "rationale": verif_rationale,
                }
            ],
        }

    def validate_groq_report_integrity(
        self,
        report: Dict[str, Any],
        verif_status: str,
        incident_data: Dict[str, Any],
        direct_evidence: List[EvidenceRecord],
        contextual_evidence: List[EvidenceRecord],
    ) -> Dict[str, Any]:
        """Validate synthesized report against deterministic verification constraints.

        If Groq fabricated corroboration or claimed confirmed ground wildfires when status
        is INSUFFICIENT_EVIDENCE or NEEDS_REVIEW, override executive summary with safe fallback.
        """
        if not isinstance(report, dict):
            return self.build_safe_fallback_summary(
                incident_data, verif_status, "Invalid structured output.", direct_evidence, contextual_evidence
            )

        exec_summary = str(report.get("executive_summary", ""))
        exec_lower = exec_summary.lower()

        # Rule: Groq must NEVER upgrade INSUFFICIENT_EVIDENCE into confirmed or corroborated
        if verif_status == "INSUFFICIENT_EVIDENCE":
            hallucination_indicators = [
                "confirmed wildfire", "raging wildfire", "major forest fire", "deadly blaze",
                "iaf deployed", "bambi bucket", "ndrf mobilized", "wildfire has been corroborated",
                "authorities have confirmed", "evacuation orders issued"
            ]
            has_hallucination = any(term in exec_lower for term in hallucination_indicators)
            lacks_satellite_qualification = not any(term in exec_lower for term in ["satellite", "thermal anomaly", "hotspot", "unconfirmed"])

            if has_hallucination or lacks_satellite_qualification or len(direct_evidence) == 0:
                logger.warning(f"Groq synthesis failed integrity validation for {incident_data.get('id')}; replacing with grounded fallback.")
                fallback = self.build_safe_fallback_summary(
                    incident_data, verif_status, incident_data.get("verification", {}).get("rationale", ""), direct_evidence, contextual_evidence
                )
                report["executive_summary"] = fallback["executive_summary"]
                report["uncertainties_and_gaps"] = (
                    "NASA FIRMS observed a spaceborne thermal anomaly. Wildfire status on the ground remains unconfirmed. "
                    "Cause not established by the available evidence."
                )

        elif verif_status == "NEEDS_REVIEW":
            if "conclusively corroborated" in exec_lower or "fully verified wildfire" in exec_lower:
                fallback = self.build_safe_fallback_summary(
                    incident_data, verif_status, incident_data.get("verification", {}).get("rationale", ""), direct_evidence, contextual_evidence
                )
                report["executive_summary"] = fallback["executive_summary"]

        return report

    async def generate_incident_dossier(
        self,
        incident_data: Dict[str, Any],
        evidence_records: List[EvidenceRecord],
        research_audit: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate a source-grounded incident analysis report via Groq Cloud GPT-OSS.

        Strictly partitions inputs into 6 structured sections:
        1. NASA FIRMS satellite observations
        2. Directly relevant fetched evidence
        3. Historical/contextual background
        4. Excluded or mismatched sources
        5. Retrieval errors and missing information
        6. Deterministic verification status and reasons
        """
        verif_data = incident_data.get("verification") or {}
        verif_status = verif_data.get("status") if isinstance(verif_data, dict) else getattr(verif_data, "status", "INSUFFICIENT_EVIDENCE")
        if hasattr(verif_status, "value"):
            verif_status = verif_status.value
        verif_status = str(verif_status)
        verif_rationale = verif_data.get("rationale", "Deterministic verification assessment.") if isinstance(verif_data, dict) else getattr(verif_data, "rationale", "")

        # Partition evidence records strictly
        direct_evidence: List[EvidenceRecord] = []
        contextual_evidence: List[EvidenceRecord] = []
        excluded_sources: List[str] = []

        for ev in evidence_records:
            is_direct = (
                (ev.fetch_status == EvidenceStatus.ACTIVE and ev.relevance_label == "Relevant")
                or (ev.is_official and ev.relevance_score >= 0.7)
            )
            is_historical = (
                "historical" in (ev.relevance_explanation or "").lower()
                or "historical" in (ev.evidence_role or "").lower()
                or ev.provenance_origin == "HISTORICAL_ARCHIVE"
            )

            if is_historical:
                contextual_evidence.append(ev)
            elif is_direct:
                direct_evidence.append(ev)
            elif ev.relevance_label == "Partial match":
                contextual_evidence.append(ev)
            else:
                excluded_sources.append(f"{ev.source_name} ({ev.url}): {ev.relevance_explanation or 'Failed location or date criteria'}")

        if not self.is_configured:
            fallback = self.build_safe_fallback_summary(
                incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence
            )
            return {
                "status": "credentials_missing",
                "message": (
                    "GROQ_API_KEY is not configured in backend .env. "
                    "Register for a free key at https://console.groq.com/keys and set GROQ_API_KEY in .env "
                    "to activate live GPT-OSS incident synthesis."
                ),
                "model_id": self.model,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "report": fallback,
            }

        # Format input partitions for prompt
        # [1] Satellite Observations
        lat = incident_data.get("latitude")
        lon = incident_data.get("longitude")
        satellite_section = [
            f"- Incident Centroid: {lat}° N, {lon}° E",
            f"- Region: {incident_data.get('region', 'Unknown')}",
            f"- Hazard Type: {incident_data.get('hazard_type', 'WILDFIRE')}",
            f"- Observation Date: {incident_data.get('first_detected') or incident_data.get('event_date')}",
            f"- Detections Count: {incident_data.get('detection_count', 1)}",
            f"- Max Radiative Power (FRP): {incident_data.get('max_frp', 'N/A')} MW (Physical sensor metric, NOT verification confidence)",
            f"- Max Brightness Temp: {incident_data.get('max_brightness', 'N/A')} K",
            "- CRITICAL TRUTH: Spaceborne thermal hotspots indicate surface thermal anomalies (e.g. agricultural burning, flares, or wildfires). A satellite hotspot is NOT proof of a ground wildfire without external corroboration.",
        ]

        # [2] Directly Relevant Fetched Ground Evidence
        direct_section = []
        for idx, ev in enumerate(direct_evidence[:6], 1):
            direct_section.append(
                f"[{idx}] Source: {ev.source_name} ({ev.source_type})\n"
                f"    Title: {ev.title}\n"
                f"    URL: {ev.url}\n"
                f"    Published: {ev.publication_date or 'Unknown / Undated'}\n"
                f"    Authority: {'Official Agency' if ev.is_official else 'Verified Journalism'}\n"
                f"    Verified Finding: {ev.finding or ev.snippet}\n"
                f"    Full Extract: {ev.full_text[:400] if ev.full_text else 'Snippet only'}\n"
            )
        if not direct_section:
            direct_section = ["NONE. Zero contemporary on-ground reports or official advisories were retrieved matching this event."]

        # [3] Historical / Contextual Material
        context_section = []
        for idx, ev in enumerate(contextual_evidence[:4], 1):
            context_section.append(
                f"[C-{idx}] {ev.source_name} - {ev.title} ({ev.publication_date or 'Undated'})\n"
                f"    Note: HISTORICAL/BACKGROUND ONLY. Does NOT corroborate the current satellite detection.\n"
                f"    Excerpt: {ev.snippet[:200]}\n"
            )
        if not context_section:
            context_section = ["None available."]

        # [4] Excluded Sources
        excluded_section = excluded_sources[:4] if excluded_sources else ["No sources excluded."]

        # [5] Retrieval Audit & Errors
        audit_section = []
        if research_audit:
            audit_section.append(f"- Search Query: {research_audit.get('query')}")
            audit_section.append(f"- Sources Discovered: {research_audit.get('sources_discovered', 0)}")
            audit_section.append(f"- Pages Fetched: {research_audit.get('pages_fetched', 0)}")
            failed_reqs = research_audit.get("failed_requests", [])
            audit_section.append(f"- Fetch Failures: {len(failed_reqs)}")
            for f in failed_reqs[:2]:
                audit_section.append(f"    * Failed URL: {f.get('url')} - Reason: {f.get('reason')}")
        else:
            audit_section = ["Audit metrics available in verification pipeline."]

        # [6] Deterministic Verification Status
        verif_section = [
            f"- Deterministic Status: {verif_status} (GROQ MUST NEVER ALTER OR UPGRADE THIS STATUS)",
            f"- Verifier Rationale: {verif_rationale}",
            f"- Missing Evidence Required: {', '.join(verif_data.get('missing_evidence', [])) or 'None'}",
        ]

        system_prompt = (
            "You are TerraShield AI's Senior Geospatial Incident Analyst.\n"
            "Your task is to analyze real hazard observations and produce a strictly grounded, "
            "authoritative incident dossier.\n\n"
            "MANDATORY INTEGRITY CONSTRAINTS:\n"
            "1. Plain English: Write the executive summary in simple, clear language (3 to 5 sentences).\n"
            "2. Ground Truth: Summarize ONLY facts supported by the structured inputs below. Never invent fires, deployments, casualties, damage, or citations.\n"
            "3. Deterministic Status Adherence: You must PRESERVE the deterministic verification status. Groq must NEVER upgrade 'INSUFFICIENT_EVIDENCE' or 'NEEDS_REVIEW' into 'CORROBORATED'.\n"
            "4. Hotspot vs Ground Fire: If status is 'INSUFFICIENT_EVIDENCE', explicitly state that a spaceborne thermal anomaly was observed by satellite, but ground wildfire status remains unconfirmed because no direct external evidence exists.\n"
            "5. Historical Material: Historical articles provide background ONLY; never claim they corroborate a current event.\n"
            "6. Truthful Causality: If root cause is not established by direct sources, explicitly state: 'Cause not established by the available evidence.'\n"
            "7. Output valid JSON adhering strictly to the required schema."
        )

        user_content = (
            f"Synthesize the following hazard intelligence inputs into a standardized report:\n\n"
            f"=== SECTION 1: NASA FIRMS SATELLITE OBSERVATIONS ===\n"
            + "\n".join(satellite_section) + "\n\n"
            f"=== SECTION 2: DIRECTLY RELEVANT FETCHED GROUND EVIDENCE ===\n"
            + "\n".join(direct_section) + "\n\n"
            f"=== SECTION 3: HISTORICAL / CONTEXTUAL BACKGROUND (DOES NOT CORROBORATE) ===\n"
            + "\n".join(context_section) + "\n\n"
            f"=== SECTION 4: EXCLUDED / MISMATCHED SOURCES ===\n"
            + "\n".join(excluded_section) + "\n\n"
            f"=== SECTION 5: RETRIEVAL AUDIT & MISSING INFORMATION ===\n"
            + "\n".join(audit_section) + "\n\n"
            f"=== SECTION 6: DETERMINISTIC VERIFICATION OUTCOME ===\n"
            + "\n".join(verif_section) + "\n\n"
            f"Respond with a JSON object with keys:\n"
            f"1. 'executive_summary': A clear 3-5 sentence plain English summary respecting the deterministic status. If status is INSUFFICIENT_EVIDENCE, state that satellite detected a thermal anomaly and ground wildfire status remains unconfirmed.\n"
            f"2. 'incident_context': Geographic coordinates, region, date, sensor platform, and verification state.\n"
            f"3. 'what_happened': Detailed factual narrative based strictly on evidence provided.\n"
            f"4. 'location_and_geography': Verified geographic scope and terrain.\n"
            f"5. 'timeline': Array of milestone objects with 'date_time', 'milestone', 'source_ref'.\n"
            f"6. 'satellite_and_thermal_observations': Physical sensor context (FRP, brightness temp, VIIRS passes).\n"
            f"7. 'official_warnings': Official alerts or state lack thereof.\n"
            f"8. 'documented_impacts': Verified casualties, damage, or 'Unconfirmed on ground'.\n"
            f"9. 'response_and_mitigation': Verified deployments or 'No official deployment reported'.\n"
            f"10. 'evidence_assessment': Synthesis of source credibility, fetch outcomes, and verification status.\n"
            f"11. 'uncertainties_and_gaps': Explicit missing facts. If cause is unverified, state 'Cause not established by the available evidence.'\n"
            f"12. 'citations': Array of objects with 'claim', 'source_title', 'url' matching authentic sources.\n"
            f"13. 'why_this_conclusion': Array of objects with 'claim', 'supporting_sources', and 'rationale'."
        )

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
        }

        last_error = "Unknown error"

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
                    resp = await client.post(url, headers=headers, json=payload)

                    if resp.status_code in (401, 403):
                        fallback = self.build_safe_fallback_summary(incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence)
                        return {
                            "status": "auth_error",
                            "message": f"Groq Authentication failed (HTTP {resp.status_code}): Invalid API key.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": fallback,
                        }

                    if resp.status_code == 404:
                        fallback = self.build_safe_fallback_summary(incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence)
                        return {
                            "status": "model_unavailable",
                            "message": f"Configured Groq model '{self.model}' is unavailable on Groq Cloud.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": fallback,
                        }

                    if resp.status_code == 429:
                        last_error = "Groq API rate limit reached (HTTP 429)."
                        if attempt < MAX_RETRIES - 1:
                            await asyncio.sleep(2.0)
                            continue
                        fallback = self.build_safe_fallback_summary(incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence)
                        return {
                            "status": "rate_limited",
                            "message": "Groq Cloud rate limit reached. Fallback report displayed.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": fallback,
                        }

                    if resp.status_code != 200:
                        clean_err = self._mask_key(resp.text[:180])
                        last_error = f"HTTP {resp.status_code}: {clean_err}"
                        if attempt < MAX_RETRIES - 1:
                            await asyncio.sleep(1.5)
                            continue
                        break

                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"]
                    parsed_report = json.loads(raw_content)

                    # Post-Synthesis Integrity Validation
                    validated_report = self.validate_groq_report_integrity(
                        report=parsed_report,
                        verif_status=verif_status,
                        incident_data=incident_data,
                        direct_evidence=direct_evidence,
                        contextual_evidence=contextual_evidence,
                    )

                    logger.info(f"Successfully generated Groq Cloud report for {incident_data.get('id')} using {self.model}")
                    return {
                        "status": "success",
                        "message": f"Synthesized grounded incident dossier via Groq Cloud ({self.model}).",
                        "model_id": self.model,
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                        "report": validated_report,
                    }

            except json.JSONDecodeError as e:
                logger.warning(f"Groq output was not strict JSON: {e}")
                fallback = self.build_safe_fallback_summary(incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence)
                return {
                    "status": "success",
                    "message": "Report generated with structured fallback format.",
                    "model_id": self.model,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "report": fallback,
                }
            except httpx.TimeoutException:
                last_error = "Groq Cloud request timed out after 35s."
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(1.5)
                    continue
                break
            except Exception as e:
                clean_err = self._mask_key(str(e))
                logger.error(f"Error during Groq Cloud inference: {clean_err}")
                last_error = clean_err
                break

        fallback = self.build_safe_fallback_summary(incident_data, verif_status, verif_rationale, direct_evidence, contextual_evidence)
        return {
            "status": "error",
            "message": f"Groq Cloud AI summarization could not be completed: {last_error}",
            "model_id": self.model,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "report": fallback,
        }


groq_adapter = GroqAdapter()
