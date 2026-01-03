import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DB_PATH = Path(__file__).resolve().parents[1] / ".data" / "ai_audit.sqlite3"

def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS run_artifacts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,          -- e.g. evidence_map, readiness
          schema_id TEXT,              -- optional
          status TEXT NOT NULL,        -- created|validated|failed
          created_at TEXT NOT NULL,
          path TEXT NOT NULL
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            status TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            path TEXT NOT NULL
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_runs (
            run_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS exports (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            path TEXT NOT NULL,
            download_name TEXT NOT NULL
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS interviews (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            stakeholder_name TEXT NOT NULL,
            role TEXT,
            function TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            audio_path TEXT,
            transcript_path TEXT
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS interview_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            question_text TEXT NOT NULL,
            response_text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        retention_days INTEGER NOT NULL,
        created_at TEXT NOT NULL
        )
        """)

        conn.commit()

def execute(sql: str, params: Tuple[Any, ...] = ()) -> None:
    with get_conn() as conn:
        conn.execute(sql, params)
        conn.commit()

def fetch_one(sql: str, params: Tuple[Any, ...] = ()) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        cur = conn.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None

def fetch_all(sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def fetch_scalar(sql: str, params: Tuple[Any, ...] = ()) -> Any:
    with get_conn() as conn:
        cur = conn.execute(sql, params)
        row = cur.fetchone()
        if not row:
            return None
        return list(dict(row).values())[0]
