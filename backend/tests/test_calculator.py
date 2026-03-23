import pytest
from datetime import datetime, timezone
from services.calculator import (
    get_session, calc_rr, calc_duration, enrich_trade,
    calc_equity_curve, calc_sharpe, calc_lot_size,
)


def test_session_asia():
    assert get_session(datetime(2026, 3, 23, 4, 0, tzinfo=timezone.utc)) == "asia"


def test_session_london():
    assert get_session(datetime(2026, 3, 23, 10, 0, tzinfo=timezone.utc)) == "london"


def test_session_overlap():
    assert get_session(datetime(2026, 3, 23, 14, 0, tzinfo=timezone.utc)) == "overlap"


def test_session_ny():
    assert get_session(datetime(2026, 3, 23, 17, 0, tzinfo=timezone.utc)) == "ny"


def test_session_off():
    assert get_session(datetime(2026, 3, 23, 22, 0, tzinfo=timezone.utc)) == "off"


def test_rr_buy_win():
    assert calc_rr("buy", 2024.00, 2024.50, 2023.50) == 1.0


def test_rr_buy_loss():
    rr = calc_rr("buy", 2024.00, 2023.75, 2023.50)
    assert rr == pytest.approx(-0.5, abs=0.01)


def test_rr_no_sl():
    assert calc_rr("buy", 100, 110, 0) is None


def test_calc_duration():
    ot = datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc)
    ct = datetime(2026, 3, 23, 11, 30, tzinfo=timezone.utc)
    assert calc_duration(ot, ct) == 150


def test_enrich_trade_pnl():
    trade = {
        "profit": 33.70, "commission": -0.70, "swap": 0.00,
        "type": "buy", "open_price": 2024.01, "close_price": 2024.38,
        "sl": 2023.50, "open_time": "2026-03-23T09:15:00Z",
        "close_time": "2026-03-23T11:29:00Z", "status": "closed",
    }
    r = enrich_trade(trade)
    assert r["pnl_net"] == 33.0
    assert r["session"] == "london"
    assert r["duration_min"] == 134


def test_equity_curve():
    trades = [
        {"close_time": "2026-01-01T12:00:00Z", "pnl_net": 100},
        {"close_time": "2026-01-02T12:00:00Z", "pnl_net": -50},
        {"close_time": "2026-01-03T12:00:00Z", "pnl_net": 200},
    ]
    curve = calc_equity_curve(trades, 10000)
    assert curve[0]["equity"] == 10100
    assert curve[1]["equity"] == 10050
    assert curve[2]["equity"] == 10250
    assert curve[1]["drawdown_pct"] == pytest.approx(0.495, abs=0.01)


def test_sharpe_not_enough():
    assert calc_sharpe([100.0, 200.0]) is None


def test_sharpe_returns_float():
    pnls = [10.0] * 10 + [-5.0] * 5
    assert calc_sharpe(pnls) is not None


def test_lot_size_eurusd():
    # 10000 * 1% = 100 / (20 pips * $10/pip) = 0.5 lots
    assert calc_lot_size(10000, 1.0, 20, "EURUSD") == 0.5


def test_lot_size_unknown_symbol():
    assert calc_lot_size(10000, 1.0, 20, "BTCUSD") is None
