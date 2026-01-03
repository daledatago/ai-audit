from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime
import json

DATA_DIR = Path(__file__).resolve().parents[1] / ".data"

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def run_dir(workspace_id: str, run_id: str) -> Path:
    p = DATA_DIR / "workspaces" / workspace_id / "runs" / run_id
    p.mkdir(parents=True, exist_ok=True)
    (p / "inputs").mkdir(exist_ok=True)
    (p / "artefacts").mkdir(exist_ok=True)
    (p / "exports").mkdir(exist_ok=True)
    (p / "logs").mkdir(exist_ok=True)
    return p

def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def append_event(workspace_id: str, run_id: str, stage: str, level: str, msg: str, extra: Optional[Dict[str, Any]] = None) -> None:
    p = run_dir(workspace_id, run_id) / "logs" / "events.jsonl"
    event = {"ts": now_iso(), "stage": stage, "level": level, "msg": msg}
    if extra:
        event["extra"] = extra
    p.write_text((p.read_text(encoding="utf-8") if p.exists() else "") + json.dumps(event, ensure_ascii=False) + "\n", encoding="utf-8")

def persist_run_meta(workspace_id: str, run_id: str, meta: Dict[str, Any]) -> None:
    write_json(run_dir(workspace_id, run_id) / "run.json", meta)

def persist_stage_snapshot(workspace_id: str, run_id: str, stages: Any) -> None:
    write_json(run_dir(workspace_id, run_id) / "stages.json", stages)

def persist_inputs(workspace_id: str, run_id: str, documents: Any, interviews: Any) -> None:
    rd = run_dir(workspace_id, run_id)
    write_json(rd / "inputs" / "documents.json", documents)
    write_json(rd / "inputs" / "interviews.json", interviews)

def persist_artifact(workspace_id: str, run_id: str, filename: str, obj: Any) -> str:
    path = run_dir(workspace_id, run_id) / "artefacts" / filename
    write_json(path, obj)
    return str(path)

def persist_export(workspace_id: str, run_id: str, filename: str, content: bytes) -> str:
    path = run_dir(workspace_id, run_id) / "exports" / filename
    path.write_bytes(content)
    return str(path)

