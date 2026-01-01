# AI Readiness Audit SaaS (v0)

A UK-first, evidence-backed **AI readiness audit** product that combines:

* **Document ingestion** (PDF/DOCX/PPTX/XLSX)
* **Semi-structured stakeholder interviews** (web audio recording + transcription)

...to generate:

* An **Executive deck** (readiness scorecard, strengths/gaps, top use cases, top 3 pilots, 30/60/90 plan)
* An **Architecture pack** (UK-bound reference architecture + controls)
* A **Backlog export** (CSV suitable for Jira/Linear import)

All outputs feature **traceability**: key claims are backed by citations to document chunks and transcript segments.

---
## Repo Structure (High Level)

* `docs/` — Canonical specs (product, architecture, pipeline, outputs)
* `schemas/` — JSON Schemas for agent outputs (validation-first)
* `prompts/` — Versioned prompt packs used by the pipeline
* `question_bank/` — Tagged question bank for semi-structured interviews
* `apps/web/` — Web UI (Next.js)
* `services/api/` — REST API service
* `services/worker/` — Async job handlers (pipeline stages)
* `infra/` — Infrastructure as code (Terraform)
---

---

## Canonical Specs

The canonical specifications live in: **`docs/00_INDEX.md`**

If something in a Google Doc/wiki disagrees with the repo, treat the repo as the source of truth and update via PR.

---

## Running Locally

### Prerequisites
* Node.js 20+
* Python 3.11+
* Docker (for Postgres)
* 'gcloud' CLI (optional but recommended)

### 1) Clone and Install

```bash
git clone <REPO_URL>
cd <REPO_NAME>

# Web UI
cd apps/web
npm install
cd ../..

# API + worker (Python example)
python -m venv .venv
source .venv/bin/activate
pip install -r services/api/requirements.txt
pip install -r services/worker/requirements.txt
