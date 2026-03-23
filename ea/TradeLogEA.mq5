//+------------------------------------------------------------------+
//| TradeLogEA.mq5 — Trading Journal EA                              |
//| Sends trades to TradeLog backend via HTTPS                       |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property version   "1.00"
#property strict

input string ServerURL      = "https://tradelog.onrender.com";  // Backend URL
input string ApiKey         = "";                                // Your API key
input int    RetryAttempts  = 3;                                 // Retry attempts
input bool   SendFloating   = false;                             // Send floating P&L

string endpoint;

//+------------------------------------------------------------------+
int OnInit()
{
   endpoint = ServerURL + "/api/trades/ingest";
   if(ApiKey == "") {
      Print("TradeLog: ERROR — ApiKey is empty. Please configure the EA parameters.");
      return INIT_FAILED;
   }
   Print("TradeLog EA initialized. Endpoint: ", endpoint);
   EventSetTimer(60); // For floating P&L updates
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // Only process deal additions
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

   ulong deal_ticket = trans.deal;
   if(deal_ticket == 0) return;

   // Select the deal from history
   if(!HistoryDealSelect(deal_ticket)) {
      // Try to load history for last 7 days
      HistorySelect(TimeCurrent() - 7*86400, TimeCurrent());
      if(!HistoryDealSelect(deal_ticket)) {
         Print("TradeLog: Cannot select deal ", deal_ticket);
         return;
      }
   }

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
   long position_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   double volume = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double profit = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double commission = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double swap = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   long magic = HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
   string comment = HistoryDealGetString(deal_ticket, DEAL_COMMENT);
   ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   datetime deal_time = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);

   // Build payload
   string type_str = (deal_type == DEAL_TYPE_BUY) ? "buy" : "sell";
   string status = "open";
   string close_price_str = "null";
   string close_time_str = "null";
   string profit_str = "null";
   string open_price_str = DoubleToString(price, 5);
   string open_time_str = "\"" + TimeToString(deal_time, TIME_DATE|TIME_SECONDS) + "Z\"";

   double sl = 0, tp = 0;

   if(entry == DEAL_ENTRY_IN) {
      // Opening trade — get SL/TP from position
      status = "open";
      if(PositionSelectByTicket(position_id)) {
         sl = PositionGetDouble(POSITION_SL);
         tp = PositionGetDouble(POSITION_TP);
      }
   } else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
      // Closing trade
      status = "closed";
      close_price_str = DoubleToString(price, 5);
      close_time_str = "\"" + TimeToString(deal_time, TIME_DATE|TIME_SECONDS) + "Z\"";
      profit_str = DoubleToString(profit, 2);

      // Get open price from history
      HistorySelect(TimeCurrent() - 30*86400, TimeCurrent());
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
         ulong h_ticket = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(h_ticket, DEAL_POSITION_ID) == position_id &&
            (ENUM_DEAL_ENTRY)HistoryDealGetInteger(h_ticket, DEAL_ENTRY) == DEAL_ENTRY_IN) {
            open_price_str = DoubleToString(HistoryDealGetDouble(h_ticket, DEAL_PRICE), 5);
            datetime open_dt = (datetime)HistoryDealGetInteger(h_ticket, DEAL_TIME);
            open_time_str = "\"" + TimeToString(open_dt, TIME_DATE|TIME_SECONDS) + "Z\"";
            sl = HistoryDealGetDouble(h_ticket, DEAL_SL);
            tp = HistoryDealGetDouble(h_ticket, DEAL_TP);
            break;
         }
      }
   } else {
      return; // Ignore other entry types
   }

   string payload = StringFormat(
      "{"
      "\"ticket\":%d,"
      "\"symbol\":\"%s\","
      "\"type\":\"%s\","
      "\"volume\":%.3f,"
      "\"open_price\":%s,"
      "\"close_price\":%s,"
      "\"sl\":%.5f,"
      "\"tp\":%.5f,"
      "\"open_time\":%s,"
      "\"close_time\":%s,"
      "\"profit\":%s,"
      "\"commission\":%.2f,"
      "\"swap\":%.2f,"
      "\"magic\":%d,"
      "\"comment\":\"%s\","
      "\"status\":\"%s\""
      "}",
      position_id,
      symbol,
      type_str,
      volume,
      open_price_str,
      close_price_str,
      sl, tp,
      open_time_str,
      close_time_str,
      profit_str,
      commission,
      swap,
      magic,
      comment,
      status
   );

   SendWithRetry(payload);
}

//+------------------------------------------------------------------+
void OnTimer()
{
   if(!SendFloating) return;

   // Send updates for all open positions
   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      double current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
      double volume = PositionGetDouble(POSITION_VOLUME);
      datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
      string type_str = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
      long magic = PositionGetInteger(POSITION_MAGIC);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);

      string payload = StringFormat(
         "{"
         "\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\","
         "\"volume\":%.3f,\"open_price\":%.5f,\"close_price\":%.5f,"
         "\"sl\":%.5f,\"tp\":%.5f,"
         "\"open_time\":\"%sZ\",\"close_time\":null,"
         "\"profit\":%.2f,\"commission\":0,\"swap\":0,"
         "\"magic\":%d,\"comment\":\"\",\"status\":\"open\""
         "}",
         ticket, symbol, type_str, volume, open_price, current_price,
         sl, tp,
         TimeToString(open_time, TIME_DATE|TIME_SECONDS),
         profit, magic
      );
      SendWithRetry(payload);
   }
}

//+------------------------------------------------------------------+
void SendWithRetry(const string &payload)
{
   string headers = "Content-Type: application/json\r\nX-API-Key: " + ApiKey;
   char post_data[];
   StringToCharArray(payload, post_data, 0, StringLen(payload));

   char result_data[];
   string result_headers;

   for(int attempt = 1; attempt <= RetryAttempts; attempt++) {
      int res = WebRequest("POST", endpoint, headers, 3000, post_data, result_data, result_headers);
      if(res == 200 || res == 201) {
         if(attempt > 1) Print("TradeLog: Success on attempt ", attempt);
         return;
      }
      Print("TradeLog: Attempt ", attempt, " failed. HTTP ", res, ". Retrying in ", attempt*attempt, "s...");
      Sleep(attempt * attempt * 1000);
   }
   Print("TradeLog: ERROR — Failed to send trade after ", RetryAttempts, " attempts. Payload: ", payload);
}
//+------------------------------------------------------------------+
