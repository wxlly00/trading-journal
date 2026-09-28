import asyncio
from types import SimpleNamespace

from routers import stats


class TradesQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}
        self.start = 0
        self.end = 999

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters[key] = ("eq", value)
        return self

    def gte(self, key, value):
        self.filters[f"{key}_gte"] = ("gte", value)
        return self

    def lt(self, key, value):
        self.filters[f"{key}_lt"] = ("lt", value)
        return self

    def order(self, *_args):
        return self

    def range(self, start, end):
        self.start = start
        self.end = end
        return self

    def execute(self):
        rows = self.rows
        for key, (op, value) in self.filters.items():
            field = key.removesuffix("_gte").removesuffix("_lt")
            if op == "eq":
                rows = [row for row in rows if row[field] == value]
            elif op == "gte":
                rows = [row for row in rows if row[field] >= value]
            else:
                rows = [row for row in rows if row[field] < value]
        rows = sorted(rows, key=lambda row: (row["close_time"], row["id"]))
        return SimpleNamespace(data=rows[self.start:self.end + 1])


class FakeDb:
    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    def table(self, name):
        assert name == "trades"
        query = TradesQuery(self.rows)
        self.queries.append(query)
        return query


def trade(index, close_time, pnl=1):
    return {
        "id": f"trade-{index}",
        "account_id": "account-1",
        "user_id": "user-1",
        "status": "closed",
        "close_time": close_time,
        "pnl_net": pnl,
    }


def test_calendar_filters_before_supabase_row_cap(monkeypatch):
    rows = [trade(i, "2026-08-01T12:00:00+00:00") for i in range(1000)]
    rows.append(trade(1000, "2026-09-02T12:00:00+00:00", 42))
    db = FakeDb(rows)
    monkeypatch.setattr(stats, "get_client", lambda: db)

    result = asyncio.run(stats.calendar("account-1", month="2026-09", user={"sub": "user-1"}))

    assert result == [{"date": "2026-09-02", "pnl": 42}]
    assert db.queries[0].filters["account_id"] == ("eq", "account-1")
    assert db.queries[0].filters["user_id"] == ("eq", "user-1")
    assert "close_time_gte" in db.queries[0].filters
    assert "close_time_lt" in db.queries[0].filters


def test_calendar_reads_all_pages_in_busy_month(monkeypatch):
    db = FakeDb([trade(i, "2026-09-02T12:00:00+00:00") for i in range(1005)])
    monkeypatch.setattr(stats, "get_client", lambda: db)

    result = asyncio.run(stats.calendar("account-1", month="2026-09", user={"sub": "user-1"}))

    assert result == [{"date": "2026-09-02", "pnl": 1005}]
    assert len(db.queries) == 2


def test_calendar_uses_browser_timezone_for_day(monkeypatch):
    db = FakeDb([trade(1, "2026-09-30T22:30:00+00:00", 10)])
    monkeypatch.setattr(stats, "get_client", lambda: db)

    result = asyncio.run(stats.calendar(
        "account-1", month="2026-10", timezone_name="Europe/Paris", user={"sub": "user-1"}
    ))

    assert result == [{"date": "2026-10-01", "pnl": 10}]
