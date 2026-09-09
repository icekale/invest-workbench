#!/usr/bin/env python3
"""Single-user snapshot store. GET/PUT /sync, SQLite WAL.

# ponytail: one-row blob, split tables if we need SQL queries over holdings.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB_PATH = os.environ.get("SYNC_DB", "/data/invest.db")
USER = os.environ.get("SYNC_USER", "xiong")
PASS = os.environ.get("SYNC_PASS", "demo")
PORT = int(os.environ.get("PORT", "3003"))
MAX_BODY = 8 * 1024 * 1024


def connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS snapshot (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            updated_at INTEGER NOT NULL,
            body TEXT NOT NULL
        )"""
    )
    conn.commit()
    return conn


def get_row(conn: sqlite3.Connection) -> tuple[int, str] | None:
    row = conn.execute("SELECT updated_at, body FROM snapshot WHERE id = 1").fetchone()
    return (int(row[0]), str(row[1])) if row else None


def put_row(conn: sqlite3.Connection, updated_at: int, body: str) -> None:
    conn.execute(
        """INSERT INTO snapshot(id, updated_at, body) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, body=excluded.body""",
        (updated_at, body),
    )
    conn.commit()


def check_basic(header: str | None) -> bool:
    if not header or not header.startswith("Basic "):
        return False
    import base64

    try:
        raw = base64.b64decode(header.split(" ", 1)[1]).decode()
        u, p = raw.split(":", 1)
    except Exception:
        return False
    return u == USER and p == PASS


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _unauth(self) -> None:
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="invest"')
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _path(self) -> str:
        return self.path.split("?", 1)[0].rstrip("/") or "/"

    def do_GET(self) -> None:  # noqa: N802
        if self._path() != "/sync":
            return self._send(404, b'{"error":"not found"}')
        if not check_basic(self.headers.get("Authorization")):
            return self._unauth()
        conn = connect()
        try:
            row = get_row(conn)
        finally:
            conn.close()
        if not row:
            return self._send(204, b"")
        return self._send(200, row[1].encode("utf-8"))

    def do_PUT(self) -> None:  # noqa: N802
        if self._path() != "/sync":
            return self._send(404, b'{"error":"not found"}')
        if not check_basic(self.headers.get("Authorization")):
            return self._unauth()
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return self._send(413, b'{"error":"too large"}')
        raw = self.rfile.read(n)
        try:
            data = json.loads(raw)
        except Exception:
            return self._send(400, b'{"error":"invalid json"}')
        if not isinstance(data, dict) or not isinstance(data.get("holdings"), list) or "cash" not in data:
            return self._send(400, b'{"error":"missing fields"}')
        updated_at = int(data.get("updatedAt") or 0)
        if updated_at <= 0:
            import time

            updated_at = int(time.time() * 1000)
            data["updatedAt"] = updated_at
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        conn = connect()
        try:
            put_row(conn, updated_at, body)
        finally:
            conn.close()
        return self._send(200, b'{"ok":true}')


def selftest() -> None:
    import tempfile

    global DB_PATH
    fd, DB_PATH = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.unlink(DB_PATH)
    conn = connect()
    assert get_row(conn) is None
    put_row(conn, 100, '{"holdings":[],"cash":{"stock":1,"etf":2}}')
    ts, body = get_row(conn)
    assert ts == 100
    assert "etf" in body
    put_row(conn, 200, '{"holdings":[{"code":"sh510300"}],"cash":{"stock":0,"etf":0}}')
    ts, body = get_row(conn)
    assert ts == 200
    assert "510300" in body
    conn.close()
    os.unlink(DB_PATH)
    print("sync-server selftest ok")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        sys.exit(0)
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"sync-server sqlite={DB_PATH} port={PORT}", flush=True)
    httpd.serve_forever()
