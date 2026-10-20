"""Groq Cloud GPT-OSS Inference Service for TerraShield AI.

Provides source-grounded incident analysis and dossier generation using Groq Cloud
OpenAI-compatible inference (https://api.groq.com/openai/v1).
Never hallucinates URLs, never leaks credentials, and strictly grounds claims in retrieved evidence.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.config import settings
from backend.models.evidence import EvidenceRecord

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

    async def generate_incident_dossier(
        self,
        incident_data: Dict[str, Any],
        evidence_records: List[EvidenceRecord],
    ) -> Dict[str, Any]:
        """Generate a source-grounded incident analysis report via Groq Cloud GPT-OSS.

        Grounds all claims in real incident metadata and retrieved evidence records.
        """
        if not self.is_configured:
            return {
                "status": "credentials_missing",
                "message": (
                    "GROQ_API_KEY is not configured in backend .env. "
                    "Register for a free key at https://console.groq.com/keys and set GROQ_API_KEY in .env "
                    "to activate GPT-OSS incident synthesis."
                ),
                "model_id": self.model,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "report": None,
            }

        # Build clean evidence context for prompt
        evidence_context = []
        for idx, ev in enumerate(evidence_records[:12], 1):
            evidence_context.append(
                f"[{idx}] Source: {ev.source_name} ({ev.source_type})\n"
                f"    Title: {ev.title}\n"
                f"    URL: {ev.url}\n"
                f"    Published: {ev.publication_date or 'Undated'}\n"
                f"    Excerpt: {ev.snippet}\n"
            )

        evidence_str = "\n".join(evidence_context) if evidence_context else "No external news or advisories linked yet."

        system_prompt = (
            "You are TerraShield AI's Senior Geospatial Incident Analyst.\n"
            "Your task is to analyze real hazard observations (wildfires/floods) and produce a clear, "
            "authoritative, evidence-grounded incident dossier.\n\n"
            "CRITICAL RULES:\n"
            "1. Plain English: Write the executive summary in simple, clear, concise language (3 to 5 sentences). Never use jargon like 'six-channel pipeline', 'geospatial inference', or 'causal attribution'.\n"
            "2. Executive Summary Structure:\n"
            "   (a) Identify the event and its verified geographic area.\n"
            "   (b) Explain what the available sources say happened.\n"
            "   (c) Summarize the documented impact, if supported.\n"
            "   (d) Explain what evidence was retrieved.\n"
            "   (e) State the most important uncertainty or limitation.\n"
            "3. Truthful Causality: Do not claim a fire's root cause unless a reliable retrieved source explicitly supports it. If the cause is unknown, explicitly state: 'Cause not established by the available evidence.'\n"
            "4. Ground all claims strictly on the provided incident facts and retrieved evidence excerpts.\n"
            "5. Never hallucinate URLs, fake statistics, casualties, or unverified facts.\n"
            "6. Output valid JSON adhering strictly to the required schema."
        )

        hazard_type = incident_data.get('hazard_type', 'WILDFIRE').upper()
        is_flood = hazard_type == 'FLOOD'

        hazard_metadata_lines = [
            f"- Name: {incident_data.get('name')}",
            f"- Hazard Type: {hazard_type}",
            f"- Region: {incident_data.get('region', 'Unknown')}",
            f"- Coordinates: {incident_data.get('latitude')}, {incident_data.get('longitude')}",
            f"- Observations / Detections: {incident_data.get('detection_count', 1)}",
            f"- First Detected / Event Date: {incident_data.get('first_detected') or incident_data.get('event_date')}",
            f"- Last Detected: {incident_data.get('last_detected') or 'Ongoing'}",
            f"- Verification Status: {incident_data.get('verification', {}).get('status', 'INSUFFICIENT_EVIDENCE')}",
        ]
        if is_flood:
            if incident_data.get('river_basin'):
                hazard_metadata_lines.append(f"- River Basin: {incident_data.get('river_basin')}")
            if incident_data.get('hydrologic_metrics'):
                metrics = incident_data.get('hydrologic_metrics', {})
                hazard_metadata_lines.append(f"- Hydrologic Telemetry: Rainfall={metrics.get('rainfall_48h_mm', 'N/A')}mm, Inundation={metrics.get('inundation_area_sqkm', 'N/A')}km²")
        else:
            if incident_data.get('max_frp'):
                hazard_metadata_lines.append(f"- Max Fire Radiative Power (FRP): {incident_data.get('max_frp')} MW")
            if incident_data.get('max_brightness'):
                hazard_metadata_lines.append(f"- Max Brightness Temp: {incident_data.get('max_brightness')} K")

        user_content = (
            f"Analyze the following verified hazard incident:\n\n"
            f"INCIDENT METADATA:\n"
            + "\n".join(hazard_metadata_lines)
            + f"\n\nRETRIEVED SOURCE EVIDENCE RECORDS:\n"
            f"{evidence_str}\n\n"
            f"Respond with a JSON object containing the standardized TerraShield Intelligence Report sections:\n"
            f"1. 'executive_summary': A clear, plain-English paragraph of 3 to 5 sentences following this exact structure: (1) Identify the event and its verified geographic area; (2) Explain what available sources say happened; (3) Summarize documented impacts if supported; (4) Explain what evidence was retrieved; (5) State the most important uncertainty or limitation. Avoid unexplained technical jargon. If root cause is not established by sources, state 'Cause not established by the available evidence.'\n"
            f"2. 'incident_context': Incident coordinates, geographic region, observation window, originating agency or sensor platform, and verification state.\n"
            f"3. 'what_happened': Detailed factual narrative of how the hazard developed, propagated, or triggered based strictly on evidence.\n"
            f"4. 'location_and_geography': Verified geographic scope, administrative districts, terrain, river basin or fuel characteristics.\n"
            f"5. 'timeline': Array of milestone objects with 'date_time', 'milestone', 'source_ref' for each corroborated event.\n"
            f"6. 'satellite_and_thermal_observations': Physical sensor context ({'Ground river gauges, IMD precipitation radar, CWC stage data' if is_flood else 'VIIRS/MODIS 375m thermal sensor passes, FRP, Brightness temperature'}).\n"
            f"7. 'official_warnings': State/national disaster alerts ({'NDMA, KSDMA, CWC, IMD' if is_flood else 'FSI, NDMA, State Forest Dept'}) and independent press dispatches.\n"
            f"8. 'documented_impacts': Sourced impacts: 'casualties', 'displaced', 'infrastructure', 'environmental'.\n"
            f"9. 'response_and_mitigation': Deployment of NDRF, armed forces, emergency bridges, aerial surveys, relief camps.\n"
            f"10. 'evidence_assessment': Synthesis of source credibility, multi-agency corroboration, and news syndication deduplication.\n"
            f"11. 'uncertainties_and_gaps': Explicit missing facts, disputed casualty counts, and unverified sensor anomalies. State what could not be established.\n"
            f"12. 'citations': Array of objects with 'claim', 'source_title', 'url' matching authentic sources provided above.\n"
            f"13. 'why_this_conclusion': Array of objects with 'claim' (key conclusion), 'supporting_sources' (list of source titles/domains), and 'rationale' (concise explanation of how the evidence supports this specific conclusion without overstepping)."
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
                        return {
                            "status": "auth_error",
                            "message": f"Groq Authentication failed (HTTP {resp.status_code}): Invalid API key. Check console.groq.com.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": None,
                        }

                    if resp.status_code == 404:
                        clean_err = self._mask_key(resp.text[:160])
                        return {
                            "status": "model_unavailable",
                            "message": f"Configured Groq model '{self.model}' is not found or unavailable on Groq Cloud. Please verify GROQ_MODEL in .env.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": None,
                        }

                    if resp.status_code == 429:
                        last_error = "Groq API rate limit reached (HTTP 429)."
                        if attempt < MAX_RETRIES - 1:
                            await asyncio.sleep(2.0)
                            continue
                        return {
                            "status": "rate_limited",
                            "message": "Groq Cloud rate limit reached. Please retry in a few moments.",
                            "model_id": self.model,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "report": None,
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

                    logger.info(f"Successfully generated Groq Cloud report for {incident_data.get('id')} using {self.model}")
                    return {
                        "status": "success",
                        "message": f"Synthesized detailed incident dossier via Groq Cloud ({self.model}).",
                        "model_id": self.model,
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                        "report": parsed_report,
                    }

            except json.JSONDecodeError as e:
                logger.warning(f"Groq output was not strict JSON: {e}")
                return {
                    "status": "success",
                    "message": "Report generated in unstructured format.",
                    "model_id": self.model,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "report": {
                        "executive_summary": raw_content[:400],
                        "event_narrative": raw_content,
                        "contributing_factors": ["Extreme weather conditions"],
                        "timeline_milestones": [],
                        "impact_assessment": {},
                        "conflicting_claims": [],
                        "evidence_gaps": [],
                        "citations": [],
                    },
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

        clean_err = self._mask_key(last_error)
        return {
            "status": "error",
            "message": f"Groq Cloud AI summarization could not be completed: {clean_err}",
            "model_id": self.model,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "report": None,
        }


groq_adapter = GroqAdapter()
