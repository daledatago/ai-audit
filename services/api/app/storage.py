from pathlib import Path
from uuid import uuid4
from datetime import datetime

DATA_DIR = Path(__file__).resolve().parents[1] / ".data"

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def workspace_dir(workspace_id: str) -> Path:
    p = DATA_DIR / "workspaces" / workspace_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def save_document(workspace_id: str, filename: str, content: bytes) -> tuple[str, str]:
    doc_id = str(uuid4())
    safe_name = filename.replace("/", "_").replace("\\", "_")
    path = workspace_dir(workspace_id) / "documents"
    path.mkdir(parents=True, exist_ok=True)
    file_path = path / f"{doc_id}_{safe_name}"
    file_path.write_bytes(content)
    return doc_id, str(file_path)

def save_export(workspace_id: str, kind: str, content: bytes, download_name: str) -> tuple[str, str]:
    export_id = str(uuid4())
    path = workspace_dir(workspace_id) / "exports"
    path.mkdir(parents=True, exist_ok=True)
    file_path = path / f"{export_id}_{download_name}"
    file_path.write_bytes(content)
    return export_id, str(file_path)
