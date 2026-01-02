from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from uuid import uuid4
from datetime import datetime

app = FastAPI(title="AI Audit API (stub)", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # v0 only; tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class WorkspaceCreate(BaseModel):
    name: str
    retention_days: int = 30

class Workspace(BaseModel):
    id: str
    name: str
    status: str = "draft"
    retention_days: int
    created_at: str

class ApiResponse(BaseModel):
    data: Optional[dict] = None
    message: Optional[str] = None
    code: Optional[str] = None

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int = 1
    pageSize: int = 50

# ---------- In-memory store ----------
workspaces: Dict[str, Workspace] = {}
documents: Dict[str, List[dict]] = {}
exports: Dict[str, List[dict]] = {}
pipelines: Dict[str, dict] = {}

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

# ---------- Endpoints ----------
@app.get("/workspaces")
def list_workspaces():
    items = [w.model_dump() for w in workspaces.values()]
    return {"items": items, "total": len(items), "page": 1, "pageSize": 50}

@app.post("/workspaces")
def create_workspace(req: WorkspaceCreate):
    wid = str(uuid4())
    w = Workspace(id=wid, name=req.name, retention_days=req.retention_days, created_at=now_iso())
    workspaces[wid] = w
    documents[wid] = []
    exports[wid] = []
    pipelines[wid] = {
        "runId": str(uuid4()),
        "status": "queued",
        "stages": [{"name": n, "status": "queued"} for n in [
            "transcribe","chunk_embed","evidence_map","readiness","usecases","scoring","writer","export"
        ]]
    }
    return {"data": w.model_dump()}

@app.get("/workspaces/{workspace_id}")
def get_workspace(workspace_id: str):
    w = workspaces.get(workspace_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"data": w.model_dump()}

# Documents (matches your current UI)
@app.get("/workspaces/{workspace_id}/documents")
def list_documents(workspace_id: str):
    return {"items": documents.get(workspace_id, []), "total": len(documents.get(workspace_id, [])), "page": 1, "pageSize": 50}

@app.post("/workspaces/{workspace_id}/documents")
async def upload_document(workspace_id: str, file: UploadFile = File(...)):
    if workspace_id not in workspaces:
        raise HTTPException(status_code=404, detail="Workspace not found")
    doc = {
        "id": str(uuid4()),
        "filename": file.filename,
        "status": "uploaded",
        "uploaded_at": now_iso()
    }
    documents[workspace_id].append(doc)
    return {"data": doc}

@app.delete("/workspaces/{workspace_id}/documents/{document_id}")
def delete_document(workspace_id: str, document_id: str):
    docs = documents.get(workspace_id, [])
    documents[workspace_id] = [d for d in docs if d["id"] != document_id]
    return {"data": None}

# Pipeline (matches your current UI)
@app.get("/workspaces/{workspace_id}/pipeline")
def get_pipeline(workspace_id: str):
    p = pipelines.get(workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"data": p}

@app.post("/workspaces/{workspace_id}/pipeline/start")
def start_pipeline(workspace_id: str):
    p = pipelines.get(workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p["status"] = "running"
    # fake progress
    for s in p["stages"]:
        if s["status"] == "queued":
            s["status"] = "running"
            break
    return {"data": p}

@app.post("/workspaces/{workspace_id}/pipeline/cancel")
def cancel_pipeline(workspace_id: str):
    p = pipelines.get(workspace_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p["status"] = "failed"
    for s in p["stages"]:
        if s["status"] == "running":
            s["status"] = "failed"
    return {"data": p}

# Exports (matches your current UI)
@app.get("/workspaces/{workspace_id}/exports")
def list_exports(workspace_id: str):
    return {"items": exports.get(workspace_id, []), "total": len(exports.get(workspace_id, [])), "page": 1, "pageSize": 50}
