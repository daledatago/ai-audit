import sqlite3
from app.db import DB_PATH

conn = sqlite3.connect(DB_PATH)
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

# Print tables + workspace schema to prove it worked
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
print("Tables:", tables)
print("workspaces columns:", conn.execute("PRAGMA table_info(workspaces)").fetchall())
print("DB:", DB_PATH)
