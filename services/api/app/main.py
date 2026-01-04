from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .db import execute, fetch_all, fetch_one, init_db
from .storage import now_iso, save_document, save_export
from .run_store import (
    append_event,
    persist_inputs,
    persist_run_meta,
    refresh_run_files,
)

STAGES = [
    "transcribe",
    "chunk_embed",
    "evidence_map",
    "readiness",
    "usecases",
    "scoring",
    "writer",
    "export",
]

# --- local FS helpers for run folders ---
def run_dir(workspace_id: str, run_id: str) -> Path:
    # DB_PATH parent is services/api/.data; run_store.py also uses this pattern
    from .db import DB_PATH  # import here to avoid circulars
    base = DB_PATH.parent / "workspaces" / workspace_id / "runs" / run_id
    base.mkdir(parents=True, exist_ok=True)
    return base

def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")

def api_error(message: str, status: int = 400, code: str = "bad_request"):
    return JSONResponse(status_code=status, content={"message": message, "code": code})

app = FastAPI(title="AI Audit API (local v0)", version="0.1")

@app.get("/")
def root():
    return {"ok": True, "service": "ai-audit-api"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()

@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    msg = str(exc.detail) if exc.detail else "Request failed"
    return api_error(msg, status=exc.status_code, code="http_error")

# ---------- Models ----------
class WorkspaceCreate(BaseModel):
    name: str
    retention_days: int = 30

class WorkspacePatch(BaseModel):
    name: Optional[str] = None
    retention_days: Optional[int] = None
    status: Optional[str] = None

class CreateInterviewRequest(BaseModel):
    workspaceId: str
    stakeholderName: str
    role: Optional[str] = None
    function: Optional[str] = None

class PipelineRunRequest(BaseModel):
    mode: str = "draft"  # draft|final

class ExportRequest(BaseModel):
    workspaceId: str
    kind: str = "deck"   # deck|architecture_pack|backlog_csv
    version: str = "v0.1"

# ---------- Helpers ----------
def paginated(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"items": items, "total": len(items), "page": 1, "pageSize": 50}

def get_workspace_or_404(workspace_id: str) -> Dict[str, Any]:
    w = fetch_one("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return w

def fetch_documents(workspace_id: str):
    return fetch_all(
        "SELECT id, filename, status, uploaded_at FROM documents WHERE workspace_id=? ORDER BY uploaded_at DESC",
        (workspace_id,)
    )

def fetch_interviews(workspace_id: str):
    return fetch_all(
        "SELECT id, stakeholder_name, role, function, status, created_at, audio_path, transcript_path "
        "FROM interviews WHERE workspace_id=? ORDER BY created_at DESC",
        (workspace_id,)
    )

def latest_run(workspace_id: str) -> Optional[Dict[str, Any]]:
    return fetch_one(
        "SELECT * FROM pipeline_runs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 1",
        (workspace_id,)
    )

def stages_for_run(run_id: str) -> List[Dict[str, Any]]:
    return fetch_all("SELECT name, status FROM pipeline_stages WHERE run_id=? ORDER BY id ASC", (run_id,))

def set_stage_status(run_id: str, stage_name: str, status: str):
    now = now_iso()
    if status == "running":
        execute(
            "UPDATE pipeline_stages SET status=?, started_at=? WHERE run_id=? AND name=?",
            (status, now, run_id, stage_name)
        )
    elif status in ("done", "failed"):
        execute(
            "UPDATE pipeline_stages SET status=?, finished_at=? WHERE run_id=? AND name=?",
            (status, now, run_id, stage_name)
        )
    else:
        execute(
            "UPDATE pipeline_stages SET status=? WHERE run_id=? AND name=?",
            (status, run_id, stage_name)
        )

def update_run_status(run_id: str, status: str):
    execute(
        "UPDATE pipeline_runs SET status=?, updated_at=? WHERE run_id=?",
        (status, now_iso(), run_id)
    )

# ---------- Artefact persistence ----------
_ARTEFACT_FILENAME_BY_STAGE = {
    "evidence_map": "evidence_map_agent.json",
    "readiness": "readiness_agent.json",
    "usecases": "usecase_agent.json",
    "scoring": "scoring_agent.json",
    "writer": "writer_agent.json",
}

def persist_placeholder_artifact(workspace_id: str, run_id: str, stage_name: str) -> Optional[Dict[str, Any]]:
    """
    Create a tiny placeholder artefact file for key stages + insert a row in run_artifacts.
    """
    filename = _ARTEFACT_FILENAME_BY_STAGE.get(stage_name)
    if not filename:
        return None

    artefacts_dir = run_dir(workspace_id, run_id) / "artefacts"
    artefacts_dir.mkdir(parents=True, exist_ok=True)

    artifact_id = str(uuid4())
    created_at = now_iso()
    path = artefacts_dir / filename

    payload = {
        "id": artifact_id,
        "workspaceId": workspace_id,
        "runId": run_id,
        "kind": stage_name,
        "name": filename,
        "status": "created",
        "createdAt": created_at,
        "data": {
            "note": "placeholder artefact (local v0)",
            "stage": stage_name,
        },
    }
    _write_json(path, payload)

    execute(
        """
        INSERT INTO run_artifacts (id, workspace_id, run_id, name, kind, schema_id, status, created_at, path)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (artifact_id, workspace_id, run_id, filename, stage_name, None, "created", created_at, str(path))
    )

    return {"id": artifact_id, "name": filename, "kind": stage_name, "status": "created", "created_at": created_at}

# ---------- Pipeline worker ----------
def pipeline_worker(workspace_id: str, run_id: str):
    # mark run running
    update_run_status(run_id, "running")
    persist_run_meta(workspace_id, run_id, {"status": "running"})
    append_event(workspace_id, run_id, {"stage": "run", "level": "info", "msg": "Run started"})
    refresh_run_files(workspace_id, run_id)

    for s in STAGES:
        # stop if cancelled/failed
        run = fetch_one("SELECT status FROM pipeline_runs WHERE run_id=?", (run_id,))
        if not run or run["status"] in ("failed", "cancelled"):
            append_event(workspace_id, run_id, {"stage": "run", "level": "warn", "msg": "Run stopped early"})
            refresh_run_files(workspace_id, run_id)
            return

        set_stage_status(run_id, s, "running")
        append_event(workspace_id, run_id, {"stage": s, "level": "info", "msg": "Stage running"})
        refresh_run_files(workspace_id, run_id)

        time.sleep(1.2)  # simulate work

        set_stage_status(run_id, s, "done")
        append_event(workspace_id, run_id, {"stage": s, "level": "info", "msg": "Stage done"})

        # create placeholder artefact for key stages
        created = persist_placeholder_artifact(workspace_id, run_id, s)
        if created:
            append_event(workspace_id, run_id, {"stage": s, "level": "info", "msg": "Artefact persisted", "extra": created})

        refresh_run_files(workspace_id, run_id)

    # exports (also copy into run exports folder for convenience)
    deck_id, deck_path = save_export(workspace_id, "deck", b'{"deck":"placeholder"}\n', "deck.json")
    execute(
        "INSERT INTO exports (id, workspace_id, kind, version, created_at, path, download_name) VALUES (?,?,?,?,?,?,?)",
        (deck_id, workspace_id, "deck", "v0.1", now_iso(), deck_path, "deck.json")
    )
    (run_dir(workspace_id, run_id) / "exports").mkdir(parents=True, exist_ok=True)
    try:
        Path(deck_path).write_bytes(Path(deck_path).read_bytes())
    except Exception:
        pass

    backlog_id, backlog_path = save_export(
        workspace_id, "backlog_csv",
        b"epic,story,description\nFoundation,Create workspace,Create workspace and persist\n",
        "backlog.csv"
    )
    execute(
        "INSERT INTO exports (id, workspace_id, kind, version, created_at, path, download_name) VALUES (?,?,?,?,?,?,?)",
        (backlog_id, workspace_id, "backlog_csv", "v0.1", now_iso(), backlog_path, "backlog.csv")
    )

    arch_id, arch_path = save_export(
        workspace_id, "architecture_pack",
        b"# Architecture Pack (placeholder)\n\nLocal v0.\n",
        "architecture_pack.md"
    )
    execute(
        "INSERT INTO exports (id, workspace_id, kind, version, created_at, path, download_name) VALUES (?,?,?,?,?,?,?)",
        (arch_id, workspace_id, "architecture_pack", "v0.1", now_iso(), arch_path, "architecture_pack.md")
    )

    update_run_status(run_id, "succeeded")
    persist_run_meta(workspace_id, run_id, {"status": "succeeded"})
    append_event(workspace_id, run_id, {"stage": "run", "level": "info", "msg": "Run succeeded"})
    refresh_run_files(workspace_id, run_id)

# ---------- Workspace API ----------
@app.get("/workspaces")
def list_workspaces():
    items = fetch_all("SELECT * FROM workspaces ORDER BY created_at DESC")
    return paginated(items)

@app.post("/workspaces")
def create_workspace(req: WorkspaceCreate):
    wid = str(uuid4())
    execute(
        "INSERT INTO workspaces (id, name, status, retention_days, created_at) VALUES (?,?,?,?,?)",
        (wid, req.name, "draft", req.retention_days, now_iso())
    )
    w = fetch_one("SELECT * FROM workspaces WHERE id=?", (wid,))
    return {"data": w}

@app.get("/workspaces/{workspace_id}")
def get_workspace(workspace_id: str):
    w = get_workspace_or_404(workspace_id)
    return {"data": w}

@app.patch("/workspaces/{workspace_id}")
def patch_workspace(workspace_id: str, req: WorkspacePatch):
    w = get_workspace_or_404(workspace_id)
    name = req.name if req.name is not None else w["name"]
    retention = req.retention_days if req.retention_days is not None else w["retention_days"]
    status = req.status if req.status is not None else w["status"]
    execute(
        "UPDATE workspaces SET name=?, retention_days=?, status=? WHERE id=?",
        (name, retention, status, workspace_id)
    )
    return {"data": fetch_one("SELECT * FROM workspaces WHERE id=?", (workspace_id,))}

@app.delete("/workspaces/{workspace_id}")
def delete_workspace(workspace_id: str):
    get_workspace_or_404(workspace_id)
    execute("DELETE FROM workspaces WHERE id=?", (workspace_id,))
    execute("DELETE FROM documents WHERE workspace_id=?", (workspace_id,))
    execute("DELETE FROM pipeline_runs WHERE workspace_id=?", (workspace_id,))
    execute("DELETE FROM exports WHERE workspace_id=?", (workspace_id,))
    execute("DELETE FROM interviews WHERE workspace_id=?", (workspace_id,))
    execute("DELETE FROM run_artifacts WHERE workspace_id=?", (workspace_id,))
    return {"data": None}

# ---------- Documents API ----------
@app.get("/workspaces/{workspace_id}/documents")
def list_documents(workspace_id: str):
    get_workspace_or_404(workspace_id)
    items = fetch_all(
        "SELECT id, filename, status, uploaded_at FROM documents WHERE workspace_id=? ORDER BY uploaded_at DESC",
        (workspace_id,)
    )
    return paginated(items)

@app.post("/workspaces/{workspace_id}/documents")
async def upload_document(workspace_id: str, file: UploadFile = File(...)):
    get_workspace_or_404(workspace_id)
    content = await file.read()
    doc_id, path = save_document(workspace_id, file.filename, content)
    execute(
        "INSERT INTO documents (id, workspace_id, filename, status, uploaded_at, path) VALUES (?,?,?,?,?,?)",
        (doc_id, workspace_id, file.filename, "uploaded", now_iso(), path)
    )
    doc = fetch_one("SELECT id, filename, status, uploaded_at FROM documents WHERE id=?", (doc_id,))
    return {"data": doc}

@app.delete("/workspaces/{workspace_id}/documents/{document_id}")
def delete_document(workspace_id: str, document_id: str):
    get_workspace_or_404(workspace_id)
    execute("DELETE FROM documents WHERE id=? AND workspace_id=?", (document_id, workspace_id))
    return {"data": None}

# ---------- Interviews API ----------
@app.get("/workspaces/{workspace_id}/interviews")
def list_interviews(workspace_id: str):
    get_workspace_or_404(workspace_id)
    items = fetch_all("SELECT * FROM interviews WHERE workspace_id=? ORDER BY created_at DESC", (workspace_id,))
    return paginated(items)

@app.post("/workspaces/{workspace_id}/interviews")
def create_interview(workspace_id: str, req: CreateInterviewRequest):
    get_workspace_or_404(workspace_id)
    iid = str(uuid4())
    execute(
        "INSERT INTO interviews (id, workspace_id, stakeholder_name, role, function, status, created_at) VALUES (?,?,?,?,?,?,?)",
        (iid, workspace_id, req.stakeholderName, req.role, req.function, "created", now_iso())
    )
    return {"data": fetch_one("SELECT * FROM interviews WHERE id=?", (iid,))}

@app.get("/workspaces/{workspace_id}/interviews/{interview_id}")
def get_interview(workspace_id: str, interview_id: str):
    get_workspace_or_404(workspace_id)
    itv = fetch_one("SELECT * FROM interviews WHERE id=? AND workspace_id=?", (interview_id, workspace_id))
    if not itv:
        raise HTTPException(status_code=404, detail="Interview not found")
    return {"data": itv}

@app.get("/workspaces/{workspace_id}/interviews/{interview_id}/questions")
def get_questions(workspace_id: str, interview_id: str):
    get_workspace_or_404(workspace_id)
    questions = [
        {"id": "q1", "text": "What are your top 3 business priorities in the next 12 months?"},
        {"id": "q2", "text": "Where do you see the biggest process friction today?"},
        {"id": "q3", "text": "What data do you trust least (and why)?"},
    ]
    return {"data": questions}

class InterviewResponseIn(BaseModel):
    responses: List[Dict[str, str]]  # {questionId, questionText, responseText}

@app.post("/workspaces/{workspace_id}/interviews/{interview_id}/responses")
def submit_responses(workspace_id: str, interview_id: str, payload: InterviewResponseIn):
    get_workspace_or_404(workspace_id)
    itv = fetch_one("SELECT * FROM interviews WHERE id=? AND workspace_id=?", (interview_id, workspace_id))
    if not itv:
        raise HTTPException(status_code=404, detail="Interview not found")

    for r in payload.responses:
        execute(
            "INSERT INTO interview_responses (interview_id, question_id, question_text, response_text, created_at) VALUES (?,?,?,?,?)",
            (interview_id, r.get("questionId",""), r.get("questionText",""), r.get("responseText",""), now_iso())
        )

    execute("UPDATE interviews SET status=? WHERE id=?", ("answered", interview_id))
    return {"data": fetch_one("SELECT * FROM interviews WHERE id=?", (interview_id,))}

# ---------- Pipeline API ----------
@app.get("/workspaces/{workspace_id}/pipeline")
def get_pipeline(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        run_id = str(uuid4())
        now = now_iso()
        execute(
            "INSERT INTO pipeline_runs (run_id, workspace_id, mode, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (run_id, workspace_id, "draft", "queued", now, now)
        )
        for s in STAGES:
            execute("INSERT INTO pipeline_stages (run_id, name, status) VALUES (?,?,?)", (run_id, s, "queued"))
        run = fetch_one("SELECT * FROM pipeline_runs WHERE run_id=?", (run_id,))

        # also write initial files
        refresh_run_files(workspace_id, run_id)

    return {"data": {"runId": run["run_id"], "status": run["status"], "stages": stages_for_run(run["run_id"])}}

@app.post("/workspaces/{workspace_id}/pipeline/start")
def start_pipeline(workspace_id: str, background: BackgroundTasks):
    return run_pipeline(workspace_id, PipelineRunRequest(mode="draft"), background)

@app.post("/workspaces/{workspace_id}/pipeline/cancel")
def cancel_pipeline(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        raise HTTPException(status_code=404, detail="No pipeline run to cancel")

    update_run_status(run["run_id"], "failed")
    execute(
        "UPDATE pipeline_stages SET status='failed', finished_at=? WHERE run_id=? AND status='running'",
        (now_iso(), run["run_id"])
    )
    append_event(workspace_id, run["run_id"], {"stage": "run", "level": "warn", "msg": "Run cancelled"})
    refresh_run_files(workspace_id, run["run_id"])

    return {"data": {"runId": run["run_id"], "status": "failed", "stages": stages_for_run(run["run_id"])}}

@app.post("/workspaces/{workspace_id}/pipeline/run")
def run_pipeline(workspace_id: str, req: PipelineRunRequest, background: BackgroundTasks):
    get_workspace_or_404(workspace_id)

    run_id = str(uuid4())
    now = now_iso()
    execute(
        "INSERT INTO pipeline_runs (run_id, workspace_id, mode, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (run_id, workspace_id, req.mode, "queued", now, now)
    )
    for s in STAGES:
        execute("INSERT INTO pipeline_stages (run_id, name, status) VALUES (?,?,?)", (run_id, s, "queued"))

    # snapshot inputs for the run
    docs = fetch_documents(workspace_id)
    itvs = fetch_interviews(workspace_id)
    persist_run_meta(workspace_id, run_id, {
        "runId": run_id,
        "workspaceId": workspace_id,
        "mode": req.mode,
        "createdAt": now,
        "status": "queued",
    })
    persist_inputs(workspace_id, run_id, documents=docs, interviews=itvs)
    append_event(workspace_id, run_id, {
        "stage": "run",
        "level": "info",
        "msg": "Run created and inputs snapshotted",
        "extra": {"documents": len(docs), "interviews": len(itvs)},
    })
    refresh_run_files(workspace_id, run_id)

    background.add_task(pipeline_worker, workspace_id, run_id)

    return {"data": {"runId": run_id, "status": "queued", "stages": stages_for_run(run_id)}}

@app.get("/workspaces/{workspace_id}/pipeline/status")
def pipeline_status(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        return {"data": {"runId": None, "status": "queued", "stages": []}}
    return {"data": {"runId": run["run_id"], "status": run["status"], "stages": stages_for_run(run["run_id"])}}

# ---------- Run Artefacts API (this is what you were calling) ----------
@app.get("/workspaces/{workspace_id}/runs/{run_id}/artifacts")
def list_run_artifacts(workspace_id: str, run_id: str):
    get_workspace_or_404(workspace_id)

    rows = fetch_all(
        "SELECT id, name, kind, status, created_at FROM run_artifacts WHERE workspace_id=? AND run_id=? ORDER BY created_at DESC",
        (workspace_id, run_id)
    )
    for r in rows:
        r["downloadUrl"] = f"/workspaces/{workspace_id}/runs/{run_id}/artifacts/{r['id']}/download"

    # fallback: if DB empty, list files under run folder artefacts/
    if not rows:
        artefacts_dir = run_dir(workspace_id, run_id) / "artefacts"
        if artefacts_dir.exists():
            files = []
            for p in sorted(artefacts_dir.glob("*.json")):
                files.append({
                    "id": None,
                    "name": p.name,
                    "kind": "file",
                    "status": "unknown",
                    "created_at": None,
                    "downloadUrl": None,
                })
            return paginated(files)

    return paginated(rows)

@app.get("/workspaces/{workspace_id}/runs/{run_id}/artifacts/{artifact_id}/download")
def download_run_artifact(workspace_id: str, run_id: str, artifact_id: str):
    get_workspace_or_404(workspace_id)
    row = fetch_one(
        "SELECT id, name, path FROM run_artifacts WHERE id=? AND workspace_id=? AND run_id=?",
        (artifact_id, workspace_id, run_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(row["path"], filename=row["name"])

# ---------- Exports API ----------
@app.get("/workspaces/{workspace_id}/exports")
def list_exports(workspace_id: str):
    get_workspace_or_404(workspace_id)
    items = fetch_all(
        "SELECT id, kind, version, created_at FROM exports WHERE workspace_id=? ORDER BY created_at DESC",
        (workspace_id,)
    )
    for it in items:
        it["downloadUrl"] = f"/workspaces/{workspace_id}/exports/{it['id']}/download"
    return paginated(items)

@app.post("/workspaces/{workspace_id}/exports")
def create_export(workspace_id: str, req: ExportRequest):
    get_workspace_or_404(workspace_id)

    kind = req.kind
    version = req.version
    created = now_iso()

    if kind == "backlog_csv":
        content = b"epic,story,description\nManual,Create export,Manual export created\n"
        download_name = "backlog.csv"
    elif kind == "architecture_pack":
        content = b"# Architecture Pack (manual placeholder)\n"
        download_name = "architecture_pack.md"
    else:
        content = b'{"deck":"manual placeholder"}\n'
        download_name = "deck.json"

    export_id, path = save_export(workspace_id, kind, content, download_name)
    execute(
        "INSERT INTO exports (id, workspace_id, kind, version, created_at, path, download_name) VALUES (?,?,?,?,?,?,?)",
        (export_id, workspace_id, kind, version, created, path, download_name)
    )
    return {"data": {"id": export_id, "kind": kind, "version": version, "created_at": created, "downloadUrl": f"/workspaces/{workspace_id}/exports/{export_id}/download"}}

@app.get("/workspaces/{workspace_id}/exports/{export_id}/download")
def download_export(workspace_id: str, export_id: str):
    get_workspace_or_404(workspace_id)
    ex = fetch_one("SELECT * FROM exports WHERE id=? AND workspace_id=?", (export_id, workspace_id))
    if not ex:
        raise HTTPException(status_code=404, detail="Export not found")
    return FileResponse(ex["path"], filename=ex["download_name"])
