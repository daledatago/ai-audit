from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from .db import DB_PATH
from .storage import now_iso

# Base folder: services/api/.data/workspaces/{workspaceId}/runs/{runId}/...
def run_dir(workspace_id: str, run_id: str) -> Path:
    base = DB_PATH.parent / "workspaces" / workspace_id / "runs" / run_id
    base.mkdir(parents=True, exist_ok=True)
    return base

def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")

def persist_run_meta(workspace_id: str, run_id: str, meta: Dict[str, Any]) -> None:
    meta = {**meta, "workspaceId": workspace_id, "runId": run_id, "updatedAt": now_iso()}
    _write_json(run_dir(workspace_id, run_id) / "run.json", meta)

def persist_stage_snapshot(workspace_id: str, run_id: str, stages: List[Dict[str, Any]]) -> None:
    _write_json(run_dir(workspace_id, run_id) / "stages.json", {"stages": stages, "capturedAt": now_iso()})

def append_event(workspace_id: str, run_id: str, event: Dict[str, Any]) -> None:
    logs_dir = run_dir(workspace_id, run_id) / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    line = json.dumps({**event, "ts": now_iso()}, ensure_ascii=False)
    with (logs_dir / "events.jsonl").open("a", encoding="utf-8") as f:
        f.write(line + "\n")
