import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers import accounts


class AccountQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}
        self.updated = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def update(self, payload):
        self.updated = payload
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeDb:
    def __init__(self, rows):
        self.query = AccountQuery(rows)

    def table(self, name):
        assert name == "accounts"
        return self.query


@pytest.mark.parametrize(
    ("age_minutes", "expected"),
    [(None, "never_connected"), (1, "active"), (5, "inactive")],
)
def test_status_states_and_owner_filter(monkeypatch, age_minutes, expected):
    last_seen = None if age_minutes is None else (
        datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    ).isoformat()
    db = FakeDb([{"last_seen_at": last_seen, "imported_trades_count": 7}])
    monkeypatch.setattr(accounts, "get_client", lambda: db)

    status = asyncio.run(accounts.get_mt5_status("account-1", {"sub": "user-1"}))

    assert status == {
        "state": expected,
        "last_seen_at": last_seen,
        "imported_trades_count": 7,
    }
    assert db.query.filters == {"id": "account-1", "user_id": "user-1"}


def test_status_rejects_unknown_account(monkeypatch):
    monkeypatch.setattr(accounts, "get_client", lambda: FakeDb([]))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(accounts.get_mt5_status("missing", {"sub": "user-1"}))
    assert exc.value.status_code == 404


def test_heartbeat_updates_only_authenticated_account(monkeypatch):
    db = FakeDb([])
    monkeypatch.setattr(accounts, "get_client", lambda: db)

    assert asyncio.run(accounts.mt5_heartbeat({"id": "account-1"})) == {"ok": True}
    assert db.query.filters == {"id": "account-1"}
    seen = datetime.fromisoformat(db.query.updated["last_seen_at"])
    assert datetime.now(timezone.utc) - seen < timedelta(seconds=5)
