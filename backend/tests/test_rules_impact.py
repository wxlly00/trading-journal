import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers import rules


class FakeQuery:
    def __init__(self, tables, name):
        self.tables = tables
        self.name = name
        self.filters = []
        self.operation = None
        self.values = None

    def select(self, _columns):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def insert(self, values):
        self.operation, self.values = "insert", values
        return self

    def update(self, values):
        self.operation, self.values = "update", values
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def execute(self):
        rows = [row for row in self.tables[self.name] if all(row.get(key) == value for key, value in self.filters)]
        if self.operation == "insert":
            row = {"id": f"v{len(self.tables[self.name]) + 1}", **self.values}
            self.tables[self.name].append(row)
            return SimpleNamespace(data=[row])
        if self.operation == "update":
            for row in rows:
                row.update(self.values)
        if self.operation == "delete":
            for row in rows:
                self.tables[self.name].remove(row)
        return SimpleNamespace(data=rows)


class FakeDB:
    def __init__(self):
        self.tables = {
            "trading_rules": [{"id": "r1", "user_id": "alice", "violations": 0}],
            "trades": [{"id": "t1", "user_id": "alice"}, {"id": "t2", "user_id": "bob"}],
            "rule_violations": [],
        }

    def table(self, name):
        return FakeQuery(self.tables, name)


def test_impact_counts_each_closed_trade_once():
    trades = [
        {"id": "a", "close_time": "2026-01-01", "pnl_net": "-20"},
        {"id": "b", "close_time": "2026-01-02", "pnl_net": "10"},
        {"id": "c", "close_time": "2026-01-03", "pnl_net": None},
        {"id": "d", "close_time": None, "pnl_net": "50"},
    ]
    result = rules._summary(trades, {"a", "c"})
    assert result["with_violation"] == {"count": 1, "pnl_net": -20, "average_pnl_net": -20}
    assert result["without_violation"] == {"count": 1, "pnl_net": 10, "average_pnl_net": 10}


def test_violation_rejects_foreign_trade(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(rules, "get_client", lambda: db)
    with pytest.raises(HTTPException) as error:
        asyncio.run(rules.record_violation("r1", {"trade_id": "t2"}, {"sub": "alice"}))
    assert error.value.status_code == 404
    assert db.tables["rule_violations"] == []
    assert db.tables["trading_rules"][0]["violations"] == 0


def test_violation_rejects_foreign_rule(monkeypatch):
    db = FakeDB()
    db.tables["trading_rules"][0]["user_id"] = "bob"
    monkeypatch.setattr(rules, "get_client", lambda: db)
    with pytest.raises(HTTPException) as error:
        asyncio.run(rules.record_violation("r1", {"trade_id": "t1"}, {"sub": "alice"}))
    assert error.value.status_code == 404
    assert db.tables["rule_violations"] == []


def test_violation_is_unique_per_trade_and_can_be_removed(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(rules, "get_client", lambda: db)
    user = {"sub": "alice"}
    first = asyncio.run(rules.record_violation("r1", {"trade_id": "t1"}, user))
    second = asyncio.run(rules.record_violation("r1", {"trade_id": "t1"}, user))
    assert first["id"] == second["id"]
    assert len(db.tables["rule_violations"]) == 1
    assert db.tables["trading_rules"][0]["violations"] == 1
    asyncio.run(rules.delete_violation(first["id"], user))
    assert db.tables["rule_violations"] == []
    assert db.tables["trading_rules"][0]["violations"] == 0
