"""Persistence of the cell controller (SQLite, standard library). Pallet LOCATIONS are not stored here – the pallet system's
PLC is the source of truth for them; the database keeps what the PLC cannot know (variant and work order on a pallet,
work orders, jobs, events).

Robustness: WAL journal (a crash never leaves a half-written page; readers do not block the writer), tx() groups all
changes of one job into ONE transaction, identical warnings / errors are logged at most once per EVENT_REPEAT_S."""
from __future__ import annotations

import contextlib
import json
import sqlite3
import threading
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS pallet (id INTEGER PRIMARY KEY, fixture TEXT, variant INTEGER DEFAULT 0, content TEXT DEFAULT 'empty', wo TEXT DEFAULT '',
                                   since REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS wo (id TEXT PRIMARY KEY, variant INTEGER, qty INTEGER, due REAL, created REAL, released INTEGER DEFAULT 0,
                               started INTEGER DEFAULT 0, done INTEGER DEFAULT 0, scrap INTEGER DEFAULT 0, finished REAL);
CREATE TABLE IF NOT EXISTS job (id INTEGER PRIMARY KEY, device TEXT, code INTEGER, params TEXT, status TEXT, created REAL, done_t REAL,
                                result INTEGER, cycle_s REAL, info TEXT);
CREATE TABLE IF NOT EXISTS event (seq INTEGER PRIMARY KEY AUTOINCREMENT, t REAL, level TEXT, device TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX IF NOT EXISTS job_status ON job (status, device);
"""
EVENT_REPEAT_S = 60.0


class DB:
    def __init__(self, path):
        self.c = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.c.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        self.depth = 0
        self.last_text = {}
        with self.lock:
            self.c.execute('PRAGMA journal_mode=WAL')
            self.c.execute('PRAGMA synchronous=NORMAL')
            self.c.executescript(SCHEMA)
            try:                                               # databases of older versions
                self.c.execute('ALTER TABLE pallet ADD COLUMN since REAL DEFAULT 0')
            except sqlite3.OperationalError:
                pass

    @contextlib.contextmanager
    def tx(self):
        """All statements inside the block are committed together, or none of them (nesting allowed)."""
        with self.lock:
            outer = self.depth == 0
            if outer:
                self.c.execute('BEGIN IMMEDIATE')
            self.depth += 1
            try:
                yield
                self.depth -= 1
                if outer:
                    self.c.execute('COMMIT')
            except BaseException:
                self.depth -= 1
                if outer:
                    self.c.execute('ROLLBACK')
                raise

    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.c.execute(sql, args).fetchall()]

    def x(self, sql, args=()):
        with self.lock:
            cur = self.c.execute(sql, args)
            return cur.lastrowid

    # ---------------------------------------------------------- events
    def event(self, level, device, text):
        if level in ('warn', 'error'):                         # no log flood from a repeating problem
            key, now = (level, device, text), time.time()
            if now - self.last_text.get(key, 0) < EVENT_REPEAT_S:
                return None
            self.last_text[key] = now
        return self.x('INSERT INTO event (t, level, device, text) VALUES (?,?,?,?)', (time.time(), level, device, text))

    def events(self, since=0, limit=200):
        return self.q('SELECT * FROM event WHERE seq > ? ORDER BY seq DESC LIMIT ?', (since, limit))

    # ---------------------------------------------------------- key / value (job id counter, mode)
    def get(self, k, default=None):
        r = self.q('SELECT v FROM kv WHERE k = ?', (k,))
        return json.loads(r[0]['v']) if r else default

    def put(self, k, v):
        self.x('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', (k, json.dumps(v)))
