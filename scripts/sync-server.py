#!/usr/bin/env python3
"""Per-user SQLite book. GET/PUT /sync, GET /sync/holdings|transactions|afre|cache.

# ponytail: global db lock, per-user locks if concurrent writers matter.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import sys
import threading
import time
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

DB_PATH = os.environ.get("SYNC_DB", "/data/invest.db")
PORT = int(os.environ.get("PORT", "3003"))
MAX_BODY = 8 * 1024 * 1024
CACHE_MAX = 512 * 1024
CACHE_TTL = 6 * 3600
PBKDF2_ROUNDS = 120_000
USER_RE = re.compile(r"^[A-Za-z0-9_.-]{1,32}$")
LOCK = threading.Lock()

KV_KEYS = (
    "todos",
    "theses",
    "journal",
    "opportunities",
    "prefs",
    "watchlist",
    "customPortfolios",
    "macroWeather",
    "macroIndicators",
    "macroBriefs",
    "macroEvents",
    "industryFocus",
    "navSnapshots",
)


def hash_pass(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return salt.hex() + ":" + dk.hex()


def check_pass(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
    except Exception:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return hmac.compare_digest(dk.hex(), dk_hex)


def connect(path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or DB_PATH, timeout=10, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            pass_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (
            user TEXT PRIMARY KEY,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS holdings (
            user TEXT NOT NULL,
            account TEXT NOT NULL,
            code TEXT NOT NULL,
            name TEXT,
            quantity REAL,
            cost REAL,
            tag TEXT,
            health TEXT,
            action TEXT,
            thesis_id TEXT,
            PRIMARY KEY (user, account, code)
        );
        CREATE TABLE IF NOT EXISTS cash (
            user TEXT NOT NULL,
            account TEXT NOT NULL,
            amount REAL NOT NULL,
            PRIMARY KEY (user, account)
        );
        CREATE TABLE IF NOT EXISTS transactions (
            user TEXT NOT NULL,
            id TEXT NOT NULL,
            date TEXT,
            account TEXT,
            code TEXT,
            name TEXT,
            side TEXT,
            price REAL,
            quantity REAL,
            amount REAL,
            fee REAL,
            note TEXT,
            PRIMARY KEY (user, id)
        );
        CREATE TABLE IF NOT EXISTS kv (
            user TEXT NOT NULL,
            key TEXT NOT NULL,
            body TEXT NOT NULL,
            PRIMARY KEY (user, key)
        );
        CREATE TABLE IF NOT EXISTS market_cache (
            k TEXT PRIMARY KEY,
            v TEXT NOT NULL,
            exp INTEGER NOT NULL
        );
        """
    )
    conn.commit()
    return conn


def seed_users(conn: sqlite3.Connection) -> None:
    raw = os.environ.get("SYNC_USERS")
    if not raw:
        raw = "%s:%s" % (
            os.environ.get("SYNC_USER", "xiong"),
            os.environ.get("SYNC_PASS", "demo"),
        )
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        u, p = pair.split(":", 1)
        u, p = u.strip(), p.strip()
        if not USER_RE.match(u) or not p:
            continue
        row = conn.execute("SELECT username FROM users WHERE username=?", (u,)).fetchone()
        if row:
            continue
        conn.execute("INSERT INTO users(username, pass_hash) VALUES (?, ?)", (u, hash_pass(p)))
    conn.commit()


def migrate_legacy_blob(conn: sqlite3.Connection) -> None:
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "snapshot" not in names:
        return
    row = conn.execute("SELECT updated_at, body FROM snapshot WHERE id=1").fetchone()
    if not row:
        return
    owned = conn.execute("SELECT 1 FROM meta WHERE user='xiong'").fetchone()
    if owned:
        return
    try:
        data = json.loads(row[1])
    except Exception:
        return
    if not isinstance(data, dict):
        return
    data.setdefault("updatedAt", int(row[0]))
    put_snapshot(conn, "xiong", data)


def register_user(conn: sqlite3.Connection, username: str, password: str) -> str:
    if not USER_RE.match(username) or not password or len(password) < 4:
        return "bad"
    row = conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
    if row:
        return "exists"
    conn.execute("INSERT INTO users(username, pass_hash) VALUES (?, ?)", (username, hash_pass(password)))
    conn.commit()
    return "ok"


def upsert_user(conn: sqlite3.Connection, username: str, password: str) -> None:
    if not USER_RE.match(username):
        raise ValueError("bad username")
    conn.execute(
        "INSERT INTO users(username, pass_hash) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET pass_hash=excluded.pass_hash",
        (username, hash_pass(password)),
    )
    conn.commit()


def auth_user(conn: sqlite3.Connection, header: str | None) -> str | None:
    if not header or not header.startswith("Basic "):
        return None
    try:
        raw = base64.b64decode(header.split(" ", 1)[1]).decode()
        u, p = raw.split(":", 1)
    except Exception:
        return None
    row = conn.execute("SELECT pass_hash FROM users WHERE username=?", (u,)).fetchone()
    if not row or not check_pass(p, row[0]):
        return None
    return u


def put_snapshot(conn: sqlite3.Connection, user: str, data: dict) -> int:
    updated_at = int(data.get("updatedAt") or 0)
    if updated_at <= 0:
        updated_at = int(time.time() * 1000)
        data["updatedAt"] = updated_at
    holdings = data.get("holdings") if isinstance(data.get("holdings"), list) else []
    cash = data.get("cash") if isinstance(data.get("cash"), dict) else {}
    txs = data.get("transactions") if isinstance(data.get("transactions"), list) else []

    conn.execute("DELETE FROM holdings WHERE user=?", (user,))
    for h in holdings:
        if not isinstance(h, dict) or not h.get("code"):
            continue
        conn.execute(
            """INSERT INTO holdings(user, account, code, name, quantity, cost, tag, health, action, thesis_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user,
                str(h.get("account") or ""),
                str(h.get("code")),
                str(h.get("name") or ""),
                float(h.get("quantity") or 0),
                float(h.get("cost") or 0),
                h.get("tag"),
                str(h.get("health") or ""),
                str(h.get("action") or ""),
                str(h.get("thesisId") or ""),
            ),
        )

    conn.execute("DELETE FROM cash WHERE user=?", (user,))
    for account in ("stock", "etf"):
        conn.execute(
            "INSERT INTO cash(user, account, amount) VALUES (?, ?, ?)",
            (user, account, float(cash.get(account) or 0)),
        )

    conn.execute("DELETE FROM transactions WHERE user=?", (user,))
    for t in txs:
        if not isinstance(t, dict) or not t.get("id"):
            continue
        conn.execute(
            """INSERT INTO transactions(user, id, date, account, code, name, side, price, quantity, amount, fee, note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user,
                str(t.get("id")),
                t.get("date"),
                t.get("account"),
                t.get("code"),
                t.get("name"),
                t.get("side"),
                t.get("price"),
                t.get("quantity"),
                t.get("amount"),
                t.get("fee"),
                t.get("note"),
            ),
        )

    conn.execute("DELETE FROM kv WHERE user=?", (user,))
    for key in KV_KEYS:
        if key not in data:
            continue
        conn.execute(
            "INSERT INTO kv(user, key, body) VALUES (?, ?, ?)",
            (user, key, json.dumps(data[key], ensure_ascii=False, separators=(",", ":"))),
        )

    conn.execute(
        "INSERT INTO meta(user, updated_at) VALUES (?, ?) ON CONFLICT(user) DO UPDATE SET updated_at=excluded.updated_at",
        (user, updated_at),
    )
    conn.commit()
    return updated_at


def get_snapshot(conn: sqlite3.Connection, user: str) -> dict | None:
    meta = conn.execute("SELECT updated_at FROM meta WHERE user=?", (user,)).fetchone()
    holds = conn.execute(
        "SELECT account, code, name, quantity, cost, tag, health, action, thesis_id FROM holdings WHERE user=?",
        (user,),
    ).fetchall()
    cash_rows = conn.execute("SELECT account, amount FROM cash WHERE user=?", (user,)).fetchall()
    txs = conn.execute(
        "SELECT id, date, account, code, name, side, price, quantity, amount, fee, note FROM transactions WHERE user=?",
        (user,),
    ).fetchall()
    kv_rows = conn.execute("SELECT key, body FROM kv WHERE user=?", (user,)).fetchall()
    if not meta and not holds and not txs and not kv_rows:
        return None
    cash = {"stock": 0.0, "etf": 0.0}
    for account, amount in cash_rows:
        cash[str(account)] = float(amount)
    data: dict = {
        "updatedAt": int(meta[0]) if meta else 0,
        "holdings": [
            {
                "account": a,
                "code": c,
                "name": n,
                "quantity": q,
                "cost": cost,
                "tag": tag,
                "health": health,
                "action": action,
                "thesisId": thesis,
            }
            for a, c, n, q, cost, tag, health, action, thesis in holds
        ],
        "cash": cash,
        "transactions": [
            {
                "id": i,
                "date": d,
                "account": acc,
                "code": code,
                "name": name,
                "side": side,
                "price": price,
                "quantity": qty,
                "amount": amount,
                "fee": fee,
                "note": note,
            }
            for i, d, acc, code, name, side, price, qty, amount, fee, note in txs
        ],
    }
    for key, body in kv_rows:
        try:
            data[key] = json.loads(body)
        except Exception:
            data[key] = body
    return data


def list_holdings(conn: sqlite3.Connection, user: str) -> list[dict]:
    rows = conn.execute(
        "SELECT account, code, name, quantity, cost, tag, health, action, thesis_id FROM holdings WHERE user=?",
        (user,),
    ).fetchall()
    return [
        {
            "account": a,
            "code": c,
            "name": n,
            "quantity": q,
            "cost": cost,
            "tag": tag,
            "health": health,
            "action": action,
            "thesisId": thesis,
        }
        for a, c, n, q, cost, tag, health, action, thesis in rows
    ]


def list_transactions(conn: sqlite3.Connection, user: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, date, account, code, name, side, price, quantity, amount, fee, note FROM transactions WHERE user=?",
        (user,),
    ).fetchall()
    return [
        {
            "id": i,
            "date": d,
            "account": acc,
            "code": code,
            "name": name,
            "side": side,
            "price": price,
            "quantity": qty,
            "amount": amount,
            "fee": fee,
            "note": note,
        }
        for i, d, acc, code, name, side, price, qty, amount, fee, note in rows
    ]


def cache_key_of(path: str) -> str | None:
    k = (parse_qs(urlparse(path).query).get("k") or [""])[0]
    if not k or len(k) > 200:
        return None
    return k


def cache_ttl_of(path: str) -> int:
    raw = (parse_qs(urlparse(path).query).get("ttl") or [""])[0]
    try:
        n = int(raw)
    except ValueError:
        n = CACHE_TTL
    return max(60, min(n, 24 * 3600))


def get_market_cache(conn: sqlite3.Connection, k: str) -> str | None:
    row = conn.execute("SELECT v, exp FROM market_cache WHERE k=?", (k,)).fetchone()
    if not row:
        return None
    v, exp = row
    if int(exp) < int(time.time()):
        conn.execute("DELETE FROM market_cache WHERE k=?", (k,))
        conn.commit()
        return None
    return str(v)


def put_market_cache(conn: sqlite3.Connection, k: str, v: str, ttl: int | None = None) -> None:
    now = int(time.time())
    ttl_s = CACHE_TTL if ttl is None else max(60, min(int(ttl), 24 * 3600))
    conn.execute(
        "INSERT INTO market_cache(k, v, exp) VALUES(?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, exp=excluded.exp",
        (k, v, now + ttl_s),
    )
    conn.execute("DELETE FROM market_cache WHERE exp < ?", (now,))
    conn.commit()


PBC_ORIGIN = "https://www.pbc.gov.cn"
PBC_INDEX = f"{PBC_ORIGIN}/diaochatongjisi/116219/116319/index.html"
AFRE_CACHE_KEY = "pbc:afre"
XLSX_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
AFRE_FIELDS = (
    "afre_total",
    "rmb_loans",
    "fx_loans",
    "entrusted_loans",
    "trust_loans",
    "undiscounted_bankers_acceptance",
    "corporate_bonds",
    "government_bonds",
    "equity_financing",
    "abs_by_depository",
    "loans_written_off",
)


def parse_afre_month(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).replace("\xa0", "").strip()
    m = re.match(r"^(\d{4})\.(\d{1,2})$", s)
    if not m:
        return None
    year, month = int(m.group(1)), int(m.group(2))
    # Excel eats 2026.10 → 2026.1; real January is 2026.01
    if month == 1 and not s.endswith(".01"):
        month = 10
    if not 1 <= month <= 12:
        return None
    return f"{year}-{month:02d}"


def parse_afre_num(raw):
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        n = float(raw)
        if n != n:
            return None
        return int(n) if n == int(n) else n
    s = str(raw).replace("\xa0", "").replace(",", "").strip()
    if not s or s in "-—":
        return None
    n = float(s)
    return int(n) if n == int(n) else n


def parse_afre_grid(grid: list[list]) -> list[dict]:
    header_idx = next(
        (i for i, row in enumerate(grid) if str((row or [None])[0] or "").replace("\xa0", "").strip() == "月份"),
        None,
    )
    if header_idx is None:
        raise ValueError("no 月份 header")
    header = grid[header_idx]
    title = str((header[1] if len(header) > 1 else "") or "")
    if "存量" in title and "增量" not in title:
        raise ValueError("got 存量 not 增量")
    out: list[dict] = []
    for row in grid[header_idx + 3 :]:
        if not row:
            continue
        month = parse_afre_month(row[0] if row else None)
        if not month:
            continue
        nums = [parse_afre_num(row[i] if i < len(row) else None) for i in range(1, 12)]
        if nums[0] is None:
            continue
        item = {"month": month}
        for key, val in zip(AFRE_FIELDS, nums):
            if val is None:
                break
            item[key] = val
        else:
            out.append(item)
    return out


def _xlsx_colrow(ref: str) -> tuple[int, int]:
    m = re.match(r"([A-Z]+)(\d+)", ref or "")
    if not m:
        return 0, 0
    col = 0
    for ch in m.group(1):
        col = col * 26 + ord(ch) - 64
    return col, int(m.group(2))


def xlsx_to_grid(content: bytes) -> list[list]:
    z = zipfile.ZipFile(BytesIO(content))
    ss: dict[int, str] = {}
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for i, si in enumerate(root.findall(f"{XLSX_NS}si")):
            ss[i] = "".join(t.text or "" for t in si.iter(f"{XLSX_NS}t"))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    cells: dict[int, dict[int, object]] = {}
    for c in sheet.findall(f".//{XLSX_NS}c"):
        col, row = _xlsx_colrow(c.get("r") or "")
        if not row or not col:
            continue
        t = c.get("t")
        v = c.find(f"{XLSX_NS}v")
        isel = c.find(f"{XLSX_NS}is")
        if t == "s" and v is not None and v.text:
            val: object = ss.get(int(v.text), "")
        elif t == "inlineStr" and isel is not None:
            val = "".join(x.text or "" for x in isel.iter(f"{XLSX_NS}t"))
        elif v is not None and v.text:
            val = v.text
        else:
            val = None
        cells.setdefault(row, {})[col] = val
    if not cells:
        return []
    max_row = max(cells)
    grid: list[list] = []
    for r in range(1, max_row + 1):
        row = cells.get(r, {})
        grid.append([row.get(c) for c in range(1, 13)])
    return grid


def parse_afre_xlsx(content: bytes) -> list[dict]:
    return parse_afre_grid(xlsx_to_grid(content))


def pbc_abs(href: str) -> str:
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if not href.startswith("/"):
        href = "/" + href
    return PBC_ORIGIN + href


def pbc_get(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": PBC_INDEX})
    with urlopen(req, timeout=20) as r:
        return r.read()


def pbc_html(url: str) -> str:
    raw = pbc_get(url)
    for enc in ("utf-8", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def latest_afre_xlsx_url() -> str:
    # ponytail: xlsx only; xlrd if PBC reverts to .xls
    q = r"['\"]"
    index = pbc_html(PBC_INDEX)
    years = [(int(y), href) for href, y in re.findall(rf"href={q}([^'\"]+){q}[^>]*>\s*(\d{{4}})年统计数据", index)]
    if not years:
        raise RuntimeError("pbc: no year index")
    years.sort()
    year_html = pbc_html(pbc_abs(years[-1][1]))
    topic = re.search(rf"href={q}([^'\"]+){q}[^>]*>\s*社会融资规模", year_html)
    if not topic:
        raise RuntimeError("pbc: no 社融 topic")
    html = pbc_html(pbc_abs(topic.group(1)))
    m = re.search(
        rf"社会融资规模增量统计表[\s\S]{{0,1200}}?href={q}([^'\"]+attachDir[^'\"]+\.xlsx){q}",
        html,
    )
    if not m:
        raise RuntimeError("pbc: no 增量 xlsx")
    return pbc_abs(m.group(1))


def fetch_pbc_afre() -> list[dict]:
    rows = parse_afre_xlsx(pbc_get(latest_afre_xlsx_url()))
    if not rows:
        raise RuntimeError("pbc: empty 社融")
    return rows


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

    def _user(self) -> str | None:
        with LOCK:
            conn = connect()
            try:
                return auth_user(conn, self.headers.get("Authorization"))
            finally:
                conn.close()

    def do_GET(self) -> None:  # noqa: N802
        path = self._path()
        if path not in ("/sync", "/sync/holdings", "/sync/transactions", "/sync/cache", "/sync/afre"):
            return self._send(404, b'{"error":"not found"}')
        user = self._user()
        if not user:
            return self._unauth()
        if path == "/sync/afre":
            with LOCK:
                conn = connect()
                try:
                    v = get_market_cache(conn, AFRE_CACHE_KEY)
                finally:
                    conn.close()
            if v is None:
                try:
                    rows = fetch_pbc_afre()
                except Exception as e:
                    return self._send(502, json.dumps({"error": str(e)[:200]}, ensure_ascii=False).encode())
                raw = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
                with LOCK:
                    conn = connect()
                    try:
                        put_market_cache(conn, AFRE_CACHE_KEY, raw)
                    finally:
                        conn.close()
                v = raw
            return self._send(200, v.encode())
        if path == "/sync/cache":
            k = cache_key_of(self.path)
            if not k:
                return self._send(400, b'{"error":"bad key"}')
            with LOCK:
                conn = connect()
                try:
                    v = get_market_cache(conn, k)
                finally:
                    conn.close()
            if v is None:
                return self._send(204, b"")
            return self._send(200, v.encode())
        with LOCK:
            conn = connect()
            try:
                if path == "/sync/holdings":
                    body = json.dumps(list_holdings(conn, user), ensure_ascii=False, separators=(",", ":")).encode()
                    return self._send(200, body)
                if path == "/sync/transactions":
                    body = json.dumps(list_transactions(conn, user), ensure_ascii=False, separators=(",", ":")).encode()
                    return self._send(200, body)
                data = get_snapshot(conn, user)
            finally:
                conn.close()
        if not data:
            return self._send(204, b"")
        return self._send(200, json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode())

    def do_PUT(self) -> None:  # noqa: N802
        path = self._path()
        if path not in ("/sync", "/sync/cache"):
            return self._send(404, b'{"error":"not found"}')
        user = self._user()
        if not user:
            return self._unauth()
        if path == "/sync/cache":
            k = cache_key_of(self.path)
            if not k:
                return self._send(400, b'{"error":"bad key"}')
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > CACHE_MAX:
                return self._send(413, b'{"error":"too large"}')
            raw = self.rfile.read(n)
            try:
                json.loads(raw)
            except Exception:
                return self._send(400, b'{"error":"invalid json"}')
            with LOCK:
                conn = connect()
                try:
                    put_market_cache(conn, k, raw.decode(), cache_ttl_of(self.path))
                finally:
                    conn.close()
            return self._send(200, b'{"ok":true}')
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
        with LOCK:
            conn = connect()
            try:
                put_snapshot(conn, user, data)
            finally:
                conn.close()
        return self._send(200, b'{"ok":true}')

    def do_POST(self) -> None:  # noqa: N802
        if self._path() != "/sync/register":
            return self._send(404, b'{"error":"not found"}')
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 4096:
            return self._send(413, b'{"error":"too large"}')
        try:
            data = json.loads(self.rfile.read(n))
        except Exception:
            return self._send(400, b'{"error":"invalid json"}')
        if not isinstance(data, dict):
            return self._send(400, b'{"error":"invalid json"}')
        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        with LOCK:
            conn = connect()
            try:
                result = register_user(conn, username, password)
            finally:
                conn.close()
        if result == "exists":
            return self._send(409, b'{"error":"exists"}')
        if result == "bad":
            return self._send(400, b'{"error":"bad username or password"}')
        return self._send(201, b'{"ok":true}')


def selftest() -> None:
    import tempfile

    global DB_PATH
    fd, DB_PATH = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.unlink(DB_PATH)
    os.environ["SYNC_USERS"] = "xiong:demo,bob:bobpass"
    conn = connect()
    seed_users(conn)
    assert auth_user(conn, "Basic " + base64.b64encode(b"xiong:demo").decode()) == "xiong"
    assert auth_user(conn, "Basic " + base64.b64encode(b"xiong:wrong").decode()) is None
    assert auth_user(conn, "Basic " + base64.b64encode(b"bob:bobpass").decode()) == "bob"
    assert register_user(conn, "cara", "pw12") == "ok"
    assert register_user(conn, "cara", "pw12") == "exists"
    assert register_user(conn, "bad name", "pw12") == "bad"
    assert auth_user(conn, "Basic " + base64.b64encode(b"cara:pw12").decode()) == "cara"

    put_snapshot(
        conn,
        "xiong",
        {
            "updatedAt": 10,
            "holdings": [{"account": "etf", "code": "sh510300", "name": "沪深300", "quantity": 100, "cost": 4, "health": "healthy", "action": "hold", "thesisId": ""}],
            "cash": {"stock": 1, "etf": 2},
            "transactions": [{"id": "t1", "account": "etf", "code": "sh510300", "side": "buy", "quantity": 100, "price": 4, "amount": 400}],
        },
    )
    put_snapshot(
        conn,
        "bob",
        {
            "updatedAt": 11,
            "holdings": [{"account": "etf", "code": "sz159915", "name": "创业板", "quantity": 50, "cost": 2, "health": "healthy", "action": "hold", "thesisId": ""}],
            "cash": {"stock": 9, "etf": 8},
            "transactions": [],
        },
    )
    a = get_snapshot(conn, "xiong")
    b = get_snapshot(conn, "bob")
    assert a and a["holdings"][0]["code"] == "sh510300"
    assert b and b["holdings"][0]["code"] == "sz159915"
    assert a["cash"]["etf"] == 2
    assert b["cash"]["stock"] == 9
    assert all(h["code"] != "sz159915" for h in list_holdings(conn, "xiong"))
    assert list_holdings(conn, "bob")[0]["code"] == "sz159915"
    n = conn.execute("SELECT COUNT(*) FROM holdings WHERE user='xiong'").fetchone()[0]
    assert n == 1
    put_market_cache(conn, "wind:pmi", "[1,2]")
    assert get_market_cache(conn, "wind:pmi") == "[1,2]"
    conn.execute("UPDATE market_cache SET exp=1 WHERE k='wind:pmi'")
    conn.commit()
    assert get_market_cache(conn, "wind:pmi") is None
    put_market_cache(conn, "short", "[]", 60)
    exp = conn.execute("SELECT exp FROM market_cache WHERE k='short'").fetchone()[0]
    assert 50 <= int(exp) - int(time.time()) <= 60
    assert parse_afre_month("2026.01") == "2026-01"
    assert parse_afre_month("2026.1") == "2026-10"
    assert parse_afre_month("2026.10") == "2026-10"
    grid = [[None] * 12 for _ in range(4)]
    grid[0][0] = "月份"
    grid[0][1] = "社会融资规模增量"
    grid[3] = ["2026.01", 72185, 49016, 468, -192, -4, 6293, 5033, 9764, 291, -99, 355]
    grid.append(["2026.1"] + [None] * 11)
    afre_rows = parse_afre_grid(grid)
    assert len(afre_rows) == 1
    assert afre_rows[0]["month"] == "2026-01"
    assert afre_rows[0]["afre_total"] == 72185
    assert afre_rows[0]["loans_written_off"] == 355
    conn.close()

    # legacy blob → xiong
    fd, DB_PATH = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.unlink(DB_PATH)
    conn = connect()
    seed_users(conn)
    conn.execute(
        """CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), updated_at INTEGER NOT NULL, body TEXT NOT NULL)"""
    )
    conn.execute(
        "INSERT INTO snapshot(id, updated_at, body) VALUES (1, 5, ?)",
        ('{"holdings":[{"account":"etf","code":"sh510300","quantity":1,"cost":1}],"cash":{"stock":0,"etf":0}}',),
    )
    conn.commit()
    migrate_legacy_blob(conn)
    snap = get_snapshot(conn, "xiong")
    assert snap and snap["holdings"][0]["code"] == "sh510300"
    conn.close()
    os.unlink(DB_PATH)
    print("sync-server selftest ok")


def main() -> None:
    global DB_PATH
    args = sys.argv[1:]
    if "--selftest" in args:
        selftest()
        return
    if "--add-user" in args:
        i = args.index("--add-user")
        if i + 2 >= len(args):
            raise SystemExit("usage: sync-server.py --add-user USER PASS")
        os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
        conn = connect()
        upsert_user(conn, args[i + 1], args[i + 2])
        conn.close()
        print("user upserted", args[i + 1])
        return
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = connect()
    seed_users(conn)
    migrate_legacy_blob(conn)
    conn.close()
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"sync-server sqlite={DB_PATH} port={PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
