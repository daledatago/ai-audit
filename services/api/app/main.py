from .run_store import persist_run_meta, persist_inputs, persist_stage_snapshot, append_event
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from uuid import uuid4
from datetime import datetime
import time

from .db import init_db, execute, fetch_one, fetch_all
from .storage import now_iso, save_document, save_export

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

def api_error(message: str, status: int = 400, code: str = "bad_request"):
    return JSONResponse(status_code=status, content={"message": message, "code": code})

app = FastAPI(title="AI Audit API (local v0)", version="0.1")

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

def paginated(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"items": items, "total": len(items), "page": 1, "pageSize": 50}

def get_workspace_or_404(workspace_id: str) -> Dict[str, Any]:
    w = fetch_one("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return w

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

def pipeline_worker(workspace_id: str, run_id: str):
    # Simple deterministic progression for v0
    update_run_status(run_id, "running")
    for s in STAGES:
        # if cancelled/failed, stop
        run = fetch_one("SELECT status FROM pipeline_runs WHERE run_id=?", (run_id,))
        if not run or run["status"] in ("failed", "cancelled"):
            return

        set_stage_status(run_id, s, "running")
        time.sleep(1.2)  # simulate work

        set_stage_status(run_id, s, "done")

    # Create placeholder exports on completion
    deck_id, deck_path = save_export(workspace_id, "deck", b'{"deck":"placeholder"}\n', "deck.json")
    execute(
        "INSERT INTO exports (id, workspace_id, kind, version, created_at, path, download_name) VALUES (?,?,?,?,?,?,?)",
        (deck_id, workspace_id, "deck", "v0.1", now_iso(), deck_path, "deck.json")
    )

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

# ---------- Workspace API (matches your UI) ----------
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
    return {"data": None}

# ---------- Documents API (matches your current UI) ----------
@app.get("/workspaces/{workspace_id}/documents")
def list_documents(workspace_id: str):
    get_workspace_or_404(workspace_id)
    items = fetch_all("SELECT id, filename, status, uploaded_at FROM documents WHERE workspace_id=? ORDER BY uploaded_at DESC", (workspace_id,))
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

# ---------- Interviews API (minimal but unblocks UI pages) ----------
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
    # placeholder question set for v0 (swap in question_bank later)
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

# ---------- Pipeline API (keep old UI endpoints + add new canonical ones) ----------
@app.get("/workspaces/{workspace_id}/pipeline")
def get_pipeline(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        # create a default queued run record
        run_id = str(uuid4())
        now = now_iso()
        execute(
            "INSERT INTO pipeline_runs (run_id, workspace_id, mode, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (run_id, workspace_id, "draft", "queued", now, now)
        )
        for s in STAGES:
            execute(
                "INSERT INTO pipeline_stages (run_id, name, status) VALUES (?,?,?)",
                (run_id, s, "queued")
            )
        run = fetch_one("SELECT * FROM pipeline_runs WHERE run_id=?", (run_id,))

    stages = stages_for_run(run["run_id"])
    return {"data": {"runId": run["run_id"], "status": run["status"], "stages": stages}}

# Existing UI button
@app.post("/workspaces/{workspace_id}/pipeline/start")
def start_pipeline(workspace_id: str, background: BackgroundTasks):
    # map to canonical run (draft)
    return run_pipeline(workspace_id, PipelineRunRequest(mode="draft"), background)

# Existing UI button
@app.post("/workspaces/{workspace_id}/pipeline/cancel")
def cancel_pipeline(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        raise HTTPException(status_code=404, detail="No pipeline run to cancel")
    update_run_status(run["run_id"], "failed")
    # mark any running stage as failed
    execute(
        "UPDATE pipeline_stages SET status='failed', finished_at=? WHERE run_id=? AND status='running'",
        (now_iso(), run["run_id"])
    )
    stages = stages_for_run(run["run_id"])
    return {"data": {"runId": run["run_id"], "status": "failed", "stages": stages}}

# Canonical endpoint (what we want long term)
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

    background.add_task(pipeline_worker, workspace_id, run_id)

    stages = stages_for_run(run_id)
    return {"data": {"runId": run_id, "status": "queued", "stages": stages}}

# Canonical endpoint (polling)
@app.get("/workspaces/{workspace_id}/pipeline/status")
def pipeline_status(workspace_id: str):
    get_workspace_or_404(workspace_id)
    run = latest_run(workspace_id)
    if not run:
        return {"data": {"runId": None, "status": "queued", "stages": []}}
    stages = stages_for_run(run["run_id"])
    return {"data": {"runId": run["run_id"], "status": run["status"], "stages": stages}}

# ---------- Exports API ----------
@app.get("/workspaces/{workspace_id}/exports")
def list_exports(workspace_id: str):
    get_workspace_or_404(workspace_id)
    items = fetch_all(
        "SELECT id, kind, version, created_at FROM exports WHERE workspace_id=? ORDER BY created_at DESC",
        (workspace_id,)
    )
    # add downloadUrl for UI convenience (optional)
    for it in items:
        it["downloadUrl"] = f"/workspaces/{workspace_id}/exports/{it['id']}/download"
    return paginated(items)

@app.post("/workspaces/{workspace_id}/exports")
def create_export(workspace_id: str, req: ExportRequest):
    get_workspace_or_404(workspace_id)
    # Create a manual placeholder export (v0)
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
