# TradeLog EA — Installation

## Steps

1. Open MT5 → File → Open Data Folder
2. Copy `TradeLogEA.mq5` to `MQL5/Experts/`
3. In MT5: Tools → Options → Expert Advisors → check "Allow WebRequest for listed URL"
4. Add your backend URL: `https://tradelog.onrender.com`
5. In Navigator, find TradeLogEA → drag onto any chart
6. Set parameters:
   - **ServerURL**: `https://tradelog.onrender.com`
   - **ApiKey**: your key from Settings page
7. Click OK — the EA status bar shows "TradeLog EA initialized"

## Verification
- Open/close a trade → check TradeLog dashboard within 5s
- Check MT5 Experts tab for any error messages
