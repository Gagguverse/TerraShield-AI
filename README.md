# 🛡️ TerraShield AI — Multi-Hazard Geospatial Intelligence Platform
### *Explainable, Evidence-Grounded Disaster Intelligence from Orbit to Ground*

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Automated Tests](https://img.shields.io/badge/Tests-63%20Passed-brightgreen)](https://github.com/Gagguverse/TerraShield-AI)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Prototype](https://img.shields.io/badge/Status-Operational%20Prototype-orange)](https://github.com/Gagguverse/TerraShield-AI)

> **TerraShield AI** bridges the credibility gap in automated disaster dashboards by refusing to treat raw satellite thermal anomalies as confirmed ground wildfires. Built with an **India-first geospatial focus**, the platform cross-references **NASA FIRMS orbital radiometry** against autonomous **TinyFish web retrieval** and a **deterministic spatial-temporal verification engine**, synthesizing decision-support dossiers via **Groq Cloud GPT-OSS** while keeping machine-learning computer vision models honestly characterized and isolated from unverified orbital alerts.

---

## 📸 Operational Interface

| Command Overview & ML Suite | Live Orbital Telemetry & Incident Card |
| :---: | :---: |
| ![Command Overview](frontend/public/guide/Screenshot%20(71).png) | ![Live Incident Card](frontend/public/guide/Screenshot%20(72).png) |
| *India overview with 1,500 satellite hotspots, spatial clusters, and ML Analysis Suite.* | *Live orbital pass showing unconfirmed hotspot disclosure and TinyFish trigger.* |

| TinyFish Autonomous Research Audit | Groq Grounded Intelligence Synthesis |
| :---: | :---: |
| ![TinyFish Audit](frontend/public/guide/Screenshot%20(75).png) | ![Groq Synthesis](frontend/public/guide/Screenshot%20(76).png) |
| *Audit metrics tracking discovered queries, full-page extractions, and official source badges.* | *Grounded synthesis strictly answering structured questions without status upgrades.* |

| AI Investigation Lifecycle (6 Stages) | NASA EOSDIS GIBS Thermal Satellite |
| :---: | :---: |
| ![AI Investigation Lifecycle](frontend/public/guide/Screenshot%20(74).png) | ![NASA EOSDIS Thermal Satellite](frontend/public/guide/Screenshot%20(67).png) |
| *Deterministic 6-stage lifecycle from hotspot selection to evidence verification.* | *Global Long-Wave Infrared (11.45 μm) daily composite via NASA EOSDIS GIBS.* |

---

## 📑 Table of Contents

1. [The Problem & Core Value](#-1-the-problem--core-value)
2. [End-to-End Intelligence Pipeline](#-2-end-to-end-intelligence-pipeline)
3. [Operational Feature Matrix](#-3-operational-feature-matrix)
4. [Evidence Integrity & Verification Engine](#-4-evidence-integrity--verification-engine)
5. [Machine Learning & Computer Vision (Honest Disclosure)](#-5-machine-learning--computer-vision-honest-disclosure)
6. [Historical Disaster Library](#-6-historical-disaster-library)
7. [System Architecture & Technology Stack](#-7-system-architecture--technology-stack)
8. [Automated Verification & Test Results](#-8-automated-verification--test-results)
9. [Quick Start & Installation](#-9-quick-start--installation)
10. [Scope, Known Limitations & Roadmap](#-11-scope-known-limitations--roadmap)
11. [Credits & Provenance](#-12-credits--provenance)


---

## 🎯 1. The Problem & Core Value

Traditional disaster monitoring systems suffer from three fundamental engineering vulnerabilities:

1. **Satellite Hotspots $\neq$ Ground Wildfires**:
   Orbital sensors register thermal anomalies caused by refinery flaring, seasonal stubble burning, and solar reflections off greenhouses or water bodies. Existing dashboards cluster these into "confirmed fires" without ground verification. TerraShield unclusters detections by default, discloses sensor footprint constraints (VIIRS 375m, MODIS 1km), and labels satellite-only anomalies as **Unconfirmed Wildfires** until independent field corroboration is established.

2. **Wildfires and Floods Are Operationally Incompatible**:
   Hydrologic inundations are non-combustive and cannot be detected via thermal sensors. TerraShield completely separates wildfire radiometry from hydrologic flood monitoring, utilizing distinct data models and providing honest empty states rather than conflating thermal data with flood warnings.

3. **Hallucination & Provenance Drift in AI Reports**:
   Unconstrained LLMs frequently invent casualties, misattribute historical articles to live incidents, or declare an event "corroborated" from a single unverified blog post. TerraShield uses a **deterministic rule engine** to establish verification status *before* Groq synthesizes the dossier, enforcing a 72-hour sliding window, administrative district validation, and wire-service syndication deduplication.

---

## 🔄 2. End-to-End Intelligence Pipeline

The platform enforces a strict unidirectional pipeline where **deterministic rules govern verification status**, and AI provides structured summarization:

```mermaid
flowchart TD
    subgraph S1["1. Orbital Telemetry Ingestion"]
        FIRMS["NASA FIRMS API<br/>VIIRS (375m) & MODIS (1km)<br/>Brightness TI4/TI5 + FRP (MW)"]
        GIBS["NASA EOSDIS GIBS<br/>SWIR Bands M11-I2-I1 & TrueColor"]
    end

    subgraph S2["2. Spatial Incident Grouping"]
        Cluster["Radius Clustering (15 km)<br/>Centroid Computation<br/>Peak FRP & Sensor Footprint"]
    end

    subgraph S3["3. Autonomous Web Discovery"]
        TF_Search["TinyFish Search API<br/>Discovers Source Snippets (PARTIAL)"]
        TF_Fetch["TinyFish Fetch API<br/>Extracts Full Page Text (ACTIVE)<br/>Records HTTP Failures (e.g., 403)"]
    end

    subgraph S4["4. Deterministic Verification Engine"]
        GTV["Geo-Temporal Validator<br/>District Bounding Boxes<br/>Strict 72h Sliding Window"]
        Dedup["Wire Syndication Dedup<br/>PTI / ANI / Reuters / AP -> 1 Source"]
        Verdict["Deterministic Status Assignment<br/>CORROBORATED · NEEDS_REVIEW · INSUFFICIENT<br/>Mathematical Uncertainty Score"]
    end

    subgraph S5["5. Constrained Synthesis & Guardrails"]
        Groq["Groq Cloud Adapter (GPT-OSS)<br/>6 Partitioned Input Sections<br/>Prohibited From Upgrading Status"]
        Guard["Post-Synthesis Integrity Validator<br/>Replaces Hallucinations with Safe Fallbacks"]
        Report["11-Section Intelligence Dossier<br/>Executive Summary + Verified Source Badges"]
    end

    subgraph S6["Isolated ML Computer Vision (Offline / Demo)"]
        UNet["U-Net Thermal Hot-Region Segmenter<br/>IGNITE Dataset (Dice: 0.28, IoU: 0.19)<br/>mask_80c >= 80°C (Experimental)"]
        YOLO["Pretrained YOLOv8n Detector<br/>rahabdev/fire-smoke-yolov8n<br/>(External - Not Trained by TerraShield)"]
    end

    FIRMS --> Cluster
    GIBS -.-> Cluster
    Cluster --> TF_Search
    TF_Search --> TF_Fetch
    TF_Fetch --> GTV
    GTV --> Dedup
    Dedup --> Verdict
    Verdict --> Groq
    Groq --> Guard
    Guard --> Report

    UNet -.->|Local Frame Context Only| S6
    YOLO -.->|Bounding Boxes Only| S6
    S6 -.->|Does NOT confirm orbital wildfire| Report
```

---

## 📊 3. Operational Feature Matrix

Every feature is classified by its actual runtime implementation status:

| Capability | Status | Description | Primary File / API |
| :--- | :---: | :--- | :--- |
| **NASA FIRMS Hotspot Fetching** | `LIVE` | Fetches VIIRS (375m) and MODIS (1km) thermal anomalies across India and global regions with exponential retry backoff and local disk caching. | [`backend/adapters/firms_adapter.py`](backend/adapters/firms_adapter.py) |
| **Interactive Geospatial Map** | `LIVE` | Leaflet map with NASA GIBS False-Color SWIR (Bands M11-I2-I1), NASA True-Color, Esri Satellite, and CARTO Dark Matter basemaps. | [`frontend/src/components/MapComponent.tsx`](frontend/src/components/MapComponent.tsx) |
| **Spatial Incident Grouping** | `LIVE` | 15 km radius spatial clustering calculating incident centroids, peak Fire Radiative Power (MW), and sensor footprint boundaries. | [`backend/engine/clustering.py`](backend/engine/clustering.py) |
| **TinyFish Search & Extraction** | `LIVE` | Autonomous web discovery and full-page text extraction with research audit tracking (discovered, fetched, failed, relevant). | [`backend/adapters/tinyfish_adapter.py`](backend/adapters/tinyfish_adapter.py) |
| **Deterministic Verifier** | `LIVE` | Rule engine enforcing localized district matching, wire syndication deduplication, 72-hour correlation windows, and mathematical scoring. | [`backend/engine/verifier.py`](backend/engine/verifier.py) |
| **Constrained Groq Synthesis** | `LIVE` | 6-partition prompt design preventing status upgrades; automated post-synthesis validation with safe fallback summaries. | [`backend/adapters/groq_adapter.py`](backend/adapters/groq_adapter.py) |
| **U-Net Thermal Segmentation** | `EXPERIMENTAL` | Custom PyTorch U-Net segmenting thermal regions $\ge 80^\circ\text{C}$ on calibrated frames. Baseline model, not production-ready. | [`backend/ml/unet_inference.py`](backend/ml/unet_inference.py) |
| **Pretrained YOLO Detection** | `PRETRAINED` | Runs inference using an externally pretrained YOLOv8n checkpoint (`rahabdev/fire-smoke-yolov8n`). Not trained by TerraShield. | [`backend/ml/yolo_inference.py`](backend/ml/yolo_inference.py) |
| **Historical Disaster Library** | `HISTORICAL` | Curated archive of verified disasters (Wayanad, Chamoli, Brahmaputra, Uttarakhand, Similipal, Bandipur) with official telemetry. | [`backend/data/fixtures.py`](backend/data/fixtures.py) |
| **Flood Hydrologic Intelligence** | `HONEST EMPTY` | Returns honest empty states ("no qualifying flood anomaly") during normal river stages; strictly separated from thermal fire models. | [`backend/adapters/flood_adapter.py`](backend/adapters/flood_adapter.py) |
| **Automated CWC & SAR Pipeline** | `ROADMAP` | Real-time automated ingestion of Central Water Commission telemetry and automated Sentinel-1 SAR microwave flood extent mapping. | Under active design |

---

## 🛡️ 4. Evidence Integrity & Verification Engine

TerraShield treats evidence provenance and mathematical verification as primary engineering requirements rather than heuristic side effects:

### Core Rules Enforced by [`verifier.py`](backend/engine/verifier.py) & [`geo_temporal_validator.py`](backend/engine/geo_temporal_validator.py)

1. **Snippet vs. Fetched Source Distinction**:
   A search snippet is an unverified discovery record (`EvidenceStatus.PARTIAL`). An article only qualifies as direct ground evidence when its full-text page is successfully fetched and parsed (`EvidenceStatus.ACTIVE`).
2. **Preservation of Fetch Errors**:
   HTTP failures (e.g., 403 Forbidden paywalls, network timeouts) are recorded in the audit log and visibly displayed to analysts instead of being silently ignored.
3. **Syndicated Wire Story Deduplication**:
   When multiple newspapers reprint the exact same news agency dispatch (e.g., Press Trust of India, ANI, Reuters, Associated Press), the engine normalizes title slugs and counts the syndication as **one independent reporting entity**.
4. **Localized Administrative Boundaries**:
   Generic regional or national mentions (e.g., an article referencing "forest fires in India" or "Uttarakhand heatwave") are rejected as direct evidence for a localized fire unless matching specific district bounding boxes (e.g., Pauri Garhwal, Chamoli, Nainital).
5. **Strict 72-Hour Temporal Window**:
   Historical news articles (e.g., reporting on a 2021 or 2024 fire) are categorized strictly as *contextual background* and **cannot corroborate a current incident**.
6. **Mathematical Uncertainty Scoring**:
   Arbitrary confidence constants are replaced with dynamic calculations:
   $$\text{Uncertainty} = \text{clamp}(0.22 - \Delta_{\text{official}} - \Delta_{\text{proximity}} - \Delta_{\text{diversity}}, 0.08, 0.28)$$
   $$\text{Confidence} = 1.0 - \text{Uncertainty}$$
7. **Constrained AI Synthesis**:
   Groq Cloud GPT-OSS receives structured, partitioned context. It is structurally prohibited from altering the deterministic verification status. If an LLM response asserts an ungrounded wildfire for an uncorroborated hotspot, post-synthesis validation automatically replaces the summary with an evidence-grounded fallback.

---

## 🤖 5. Machine Learning & Computer Vision (Honest Disclosure)

TerraShield AI includes an operational ML analysis suite designed for thermal and visible frame inspection. In keeping with engineering honesty, all models and limitations are disclosed:

| Model | Architecture | Checkpoint Provenance | Dataset / Training | Evaluation Status | Honest Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **U-Net Thermal Segmenter** | PyTorch U-Net (bilinear upsampling, 4.3M params) | `backend/ml/models/unet_ignite_best.pt` | Trained on IGNITE Fire Dataset (`Kyoma001/IGNITE-fire-dataset`, CC BY 4.0) | **Held-out Test Dice: 0.276**<br/>**Held-out Test IoU: 0.194** (Sequence 0004) | **Experimental baseline, NOT production-ready.** Detects thermal hot regions ($\ge 80^\circ\text{C}$, `mask_80c`), which indicate elevated heat, not confirmed wildfires. Zero synthetic temperatures or GPS coordinates are invented. |
| **YOLO Fire & Smoke Detector** | Ultralytics YOLOv8n | `backend/ml/models/yolo_pretrained/best.pt` | Externally pretrained checkpoint (`rahabdev/fire-smoke-yolov8n`, Hugging Face, AGPL-3.0) | **Pretrained Inference Demonstration** (Returns bounding boxes and confidence) | **NOT trained by TerraShield AI.** Detection counts on sample frames illustrate bounding-box mapping and API latency, not generalized model accuracy. |

> **Telemetry Isolation**: Predictions from local computer vision models are strictly separated from NASA FIRMS satellite radiometry. Local frame analysis provides visual context but does not independently verify an orbital hotspot.

---

## 🏛️ 6. Historical Disaster Library

TerraShield AI includes curated dossiers of verified disasters with authentic official documentation to benchmark verification rules:

- **Wayanad Debris Flow & Flash Flood (Kerala, July 30, 2024)**:
  572 mm / 48h extreme precipitation recorded at IMD Vythiri AWS; 8.2 km channelized debris runout along Iruvanipuzha River destroying Chooralmala bridge. Verified via KSDMA Situation Reports, IMD bulletins, PIB Defence, and on-ground journalism.
- **Chamoli Glacial Rockslide & Flash Flood (Uttarakhand, Feb 7, 2021)**:
  Ronti peak rock-ice avalanche triggering Rishi Ganga & Dhauli Ganga flash floods, destroying Tapovan Vishnugad hydel project. Verified via GSI, ISRO, and NDMA records.
- **Brahmaputra Severe Monsoon Inundation (Assam, June 2024)**:
  Seasonal flooding across 28 districts and Kaziranga National Park. Documented through ASDMA bulletins and Central Water Commission river stages.
- **Uttarakhand Forest Fire Complex (May 2024)**:
  Severe pre-monsoon fires across Garhwal and Kumaon pine forests. Peak satellite FRP exceeding 340 MW; verified via Forest Survey of India (FSI) and MoEFCC reports.
- **Similipal Biosphere Reserve Fire (Odisha, March 2021)**:
  High-intensity fires across Mayurbhanj core and buffer zones. Corroborated by Principal Chief Conservator of Forests bulletins.
- **Bandipur Tiger Reserve Fire (Karnataka, Feb 2019)**:
  Over 4,800 hectares of deciduous forest affected. Verified via Karnataka Forest Department and ISRO Bhuvan satellite monitoring.

---

## 💻 7. System Architecture & Technology Stack

```
TerraShield-AI/
├── backend/
│   ├── main.py                     # FastAPI application entrypoint and middleware
│   ├── config.py                   # Pydantic settings and environment variables
│   ├── api/
│   │   └── routes.py               # REST endpoints (FIRMS, TinyFish, Groq, ML, Flood)
│   ├── adapters/
│   │   ├── firms_adapter.py        # NASA FIRMS API client with backoff & caching
│   │   ├── tinyfish_adapter.py     # TinyFish search/fetch client with research audit
│   │   ├── groq_adapter.py         # Constrained Groq Cloud synthesizer with guardrails
│   │   └── flood_adapter.py        # Hydrologic flood adapter and honest empty states
│   ├── engine/
│   │   ├── clustering.py           # Spatial radius clustering & centroid calculation
│   │   ├── verifier.py             # Deterministic verification & syndication dedup
│   │   └── geo_temporal_validator.py # Bounding boxes, district matching & 72h window
│   └── ml/
│       ├── unet.py                 # PyTorch U-Net architecture definition
│       ├── unet_inference.py       # U-Net hot-region segmentation inference
│       └── yolo_inference.py       # Pretrained YOLO fire/smoke detector inference
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapComponent.tsx    # Leaflet map with NASA SWIR / TrueColor basemaps
│   │   │   ├── TerraShieldReportModal.tsx # 11-section report with audit counters
│   │   │   ├── MLAnalysisPanel.tsx # Floating U-Net mask & YOLO box viewer
│   │   │   ├── IncidentDossierView.tsx # Historical incident archive viewer
│   │   │   └── GuidedDemoView.tsx  # 7-step full-screen Wayanad disaster tour
│   │   ├── index.css               # Dark Geospatial Operational Design System
│   │   └── App.tsx                 # Main application state and layout
│   └── package.json                # React 19 + TypeScript + Vite configuration
└── tests/
    ├── test_api.py                 # API endpoint and health checks (15 tests)
    ├── test_dossier_and_flood.py   # Report schema and flood status checks (12 tests)
    ├── test_evidence_integrity.py  # Verification integrity & edge cases (11 tests)
    ├── test_firms_adapter.py       # NASA FIRMS retries & caching (12 tests)
    ├── test_tinyfish_adapter.py    # TinyFish audit & status transitions (6 tests)
    └── test_verifier.py            # Mathematical scoring & deduplication (7 tests)
```

---

## 🧪 8. Automated Verification & Test Results

The platform has been validated across automated backend unit/integration tests and frontend production builds:

### Automated Backend Test Suite
Executed directly in Python 3.12 via pytest:

```bash
python -m pytest tests -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\screenshots
collected 63 items

tests/test_api.py ...............                                        [ 23%]
tests/test_dossier_and_flood.py ............                             [ 42%]
tests/test_evidence_integrity.py ...........                             [ 60%]
tests/test_firms_adapter.py ............                                 [ 79%]
tests/test_tinyfish_adapter.py ......                                    [ 88%]
tests/test_verifier.py .......                                           [100%]

======================= 63 passed, 1 warning in 35.86s ========================
```

- **`test_evidence_integrity.py` (11 tests)**: Validates that zero successful fetches cannot corroborate, wire syndications count as one source, out-of-bounds locations are rejected, historical articles cannot corroborate current events, Groq guardrails catch hallucinations, and satellite-only anomalies disclose unconfirmed ground status.
- **`test_api.py` (15 tests)**: Validates health checks, incident pagination, data modes, and ML inference endpoints.
- **`test_firms_adapter.py` (12 tests)**: Validates live URL construction, HTTP 502 exponential retry backoff, disk caching, and attribute normalization.
- **`test_dossier_and_flood.py` (12 tests)**: Validates honest empty flood states, 11-section report schema compliance, and API key masking.
- **`test_tinyfish_adapter.py` (6 tests)**: Validates research audit counters, partial vs. active statuses, and HTTP 403 preservation.
- **`test_verifier.py` (7 tests)**: Validates Haversine distance, temporal constraints, and mathematical uncertainty formulas.

### Frontend Production Build
```bash
cd frontend && npm run build
```
```
✓ 2513 modules transformed.
dist/index.html                   0.99 kB
dist/assets/index-BbbFWAi0.css   87.65 kB
dist/assets/index-DVJxiGgm.js   995.41 kB
✓ built in 328ms (0 TypeScript errors)
```

---

## 🚀 9. Quick Start & Installation

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** & **npm**
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Gagguverse/TerraShield-AI.git
cd TerraShield-AI
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cd ..
```

### 4. Configure Environment
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```
*(See [Environment Configuration](#-10-environment-configuration-env) below for optional API keys. If keys are omitted, the application runs fully in `HISTORICAL_SAMPLE` or `DEMO` mode).*

### 5. Launch Application
In two separate terminals:

```powershell
# Terminal 1: Backend Server (Port 8000)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Frontend Client (Port 5173)
cd frontend
npm run dev
```

- **Operational UI**: [`http://localhost:5173`](http://localhost:5173)
- **Interactive OpenAPI Docs**: [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

## 🔭 10. Scope, Known Limitations & Roadmap

### Current Operational Capabilities
- Live NASA FIRMS VIIRS & MODIS satellite hotspot ingestion with radius clustering.
- Interactive Leaflet map with NASA EOSDIS GIBS False-Color SWIR (Bands M11-I2-I1) and True-Color basemaps.
- Autonomous TinyFish evidence search and full-page extraction with complete research audit counters.
- Deterministic verification engine with wire syndication deduplication, district boundary checks, and 72-hour sliding windows.
- Constrained Groq Cloud 11-section report generation with post-synthesis hallucination overrides.
- Curated historical disaster library covering major Indian wildfire and flood events.

### Transparent Limitations
1. **Satellite Latency**: Low-Earth-orbit satellites pass over a location only 2–4 times per 24 hours. Orbital hotspots reflect instantaneous snapshots, not real-time video surveillance.
2. **Cloud Obscuration**: Monsoon cloud cover frequently obscures optical and thermal sensors during flood events. Microwave radar (Sentinel-1 SAR) is necessary for all-weather flood boundary mapping.
3. **U-Net Convergence**: The baseline U-Net model trained on IGNITE thermal data achieved **Dice 0.276 / IoU 0.194** on held-out test data. It is an experimental baseline intended to demonstrate the thermal ML pipeline and is **not production-ready**.
4. **Pretrained YOLO Origin**: The fire/smoke detector utilizes an external pretrained checkpoint (`rahabdev/fire-smoke-yolov8n`) and was not trained by TerraShield.
5. **Flood Pipeline Status**: Live automated streaming from Central Water Commission river gauges and automated SAR flood mapping are currently **in development (Roadmap)**. Live flood monitoring currently reports an honest empty state when gauges are normal.

### Architectural Roadmap
- [ ] Retrain U-Net thermal segmenter with expanded, radiometric long-wave infrared (LWIR 8–14μm) aerial datasets.
- [ ] Implement automated real-time CWC river gauge scraping and hydrological basin risk scoring.
- [ ] Ingest Sentinel-1 SAR GRD radar imagery via Copernicus Open Access Hub for automated flood extent masking.
- [ ] Connect live radiometric RTSP/UVC hardware streams (FLIR Boson 640 / DJI Zenmuse H20T).

---

## 📜 11. Credits & Provenance

- **NASA FIRMS**: NASA Land, Atmosphere Near-real-time Capability for EOS (LANCE), Earth Observing System Data and Information System (EOSDIS).
- **NASA GIBS**: Global Imagery Browse Services, Earth Science Data and Information System (ESDIS).
- **TinyFish AI**: Autonomous public web search and full-page text extraction APIs.
- **Groq Cloud**: High-speed inference engine for open-source foundation models (GPT-OSS / Llama).
- **IGNITE Dataset**: Kyoma001/IGNITE-fire-dataset (CC BY 4.0) used for baseline thermal U-Net exploration.
- **Pretrained YOLO Model**: `rahabdev/fire-smoke-yolov8n` on Hugging Face (AGPL-3.0) via Ultralytics YOLOv8n.
- **Map Tiles**: Esri World Imagery, CARTO Dark Matter, and OpenStreetMap contributors.

---

<div align="center">
  <b>TerraShield AI</b> — Engineered for Truth, Provenance, and Explainable Disaster Intelligence.
</div>
