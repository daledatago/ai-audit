from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .db import DB_PATH, fetch_one, fetch_all
from .storage import now_iso


def run_dir(workspace_id: str, run_id: str) -> Path:
    """
    Base folder: services/api/.data/workspaces/{workspaceId}/runs/{runId}/...
    """
    base = DB_PATH.parent / "workspaces" / workspace_id / "runs" / run_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")


def persist_run_meta(workspace_id: str, run_id: str, meta: Dict[str, Any]) -> None:
    """
    Writes/merges run.json (human-readable run metadata).
    """
    path = run_dir(workspace_id, run_id) / "run.json"

    existing: Dict[str, Any] = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}

    merged = {
        **existing,
        **meta,
        "workspaceId": workspace_id,
        "runId": run_id,
        "updatedAt": now_iso(),
    }
    _write_json(path, merged)


def persist_stage_snapshot(workspace_id: str, run_id: str, stages: List[Dict[str, Any]]) -> None:
    """
    Writes stages.json as a plain list (keeps it easy to inspect, matches what you saw earlier).
    """
    _write_json(run_dir(workspace_id, run_id) / "stages.json", stages)


def persist_inputs(
    workspace_id: str,
    run_id: str,
    documents: List[Dict[str, Any]],
    interviews: List[Dict[str, Any]],
) -> None:
    inputs_dir = run_dir(workspace_id, run_id) / "inputs"
    _write_json(inputs_dir / "documents.json", documents)
    _write_json(inputs_dir / "interviews.json", interviews)


def append_event(workspace_id: str, run_id: str, event: Dict[str, Any]) -> None:
    """
    Appends JSONL events into logs/events.jsonl.
    Auto-adds ts if missing.
    """
    logs_dir = run_dir(workspace_id, run_id) / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    payload = dict(event)
    payload.setdefault("ts", now_iso())

    with (logs_dir / "events.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def refresh_run_files(workspace_id: str, run_id: str) -> None:
    """
    Rebuilds run.json + stages.json from the DB for a given run.
    Useful when you want to "refresh" the on-disk view to match DB truth.
    """
    base = run_dir(workspace_id, run_id)

    run = fetch_one(
        """
        SELECT run_id, workspace_id, mode, status, created_at, updated_at
        FROM pipeline_runs
        WHERE run_id=? AND workspace_id=?
        """,
        (run_id, workspace_id),
    )

    if not run:
        append_event(workspace_id, run_id, {"stage": "run", "level": "warn", "msg": "refresh_run_files: run not found in DB"})
        return

    run_json = {
        "runId": run["run_id"],
        "workspaceId": run["workspace_id"],
        "mode": run.get("mode"),
        "status": run.get("status"),
        "createdAt": run.get("created_at"),
        "updatedAt": run.get("updated_at") or now_iso(),
    }
    (base / "run.json").write_text(json.dumps(run_json, indent=2, ensure_ascii=False), encoding="utf-8")

    stages = fetch_all(
        "SELECT name, status, started_at, finished_at FROM pipeline_stages WHERE run_id=? ORDER BY id ASC",
        (run_id,),
    )
    (base / "stages.json").write_text(json.dumps(stages, indent=2, ensure_ascii=False), encoding="utf-8")

    append_event(workspace_id, run_id, {"stage": "run", "level": "info", "msg": "Refreshed run.json + stages.json from DB"})
