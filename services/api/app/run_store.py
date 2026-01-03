from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .db import DB_PATH, fetch_one, fetch_all
from .storage import now_iso


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
    # Keep stages.json as a plain list (matches what you showed earlier)
    _write_json(run_dir(workspace_id, run_id) / "stages.json", stages)


def append_event(workspace_id: str, run_id: str, event: Dict[str, Any]) -> None:
    logs_dir = run_dir(workspace_id, run_id) / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    line = json.dumps({**event, "ts": now_iso()}, ensure_ascii=False)
    with (logs_dir / "events.jsonl").open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def refresh_run_files(workspace_id: str, run_id: str) -> None:
    """Re-sync run.json + stages.json from SQLite and append an event."""
    run = fetch_one(
        "SELECT run_id, workspace_id, mode, status, created_at, updated_at "
        "FROM pipeline_runs WHERE run_id=?",
        (run_id,),
    )
    if not run:
        return

    persist_run_meta(workspace_id, run_id, {
        "mode": run.get("mode"),
        "createdAt": run.get("created_at"),
        "status": run.get("status"),
    })

    stages = fetch_all(
        "SELECT name, status FROM pipeline_stages WHERE run_id=? ORDER BY id ASC",
        (run_id,),
    )
    persist_stage_snapshot(workspace_id, run_id, stages)

    append_event(workspace_id, run_id, {
        "stage": "run",
        "level": "info",
        "msg": "Refreshed run.json + stages.json from DB",
    })
