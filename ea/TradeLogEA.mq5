//+------------------------------------------------------------------+
//| TradeLogEA.mq5 — Trading Journal EA                              |
//| Sends trades to TradeLog backend via HTTPS                       |
//+------------------------------------------------------------------+
#property copyright "TradeLog"
#property version   "1.10"
#property strict

input string ServerURL         = "https://tradingjournal-api.vercel.app"; // Backend URL
input string ApiKey            = "";    // Your API key
input int    RetryAttempts     = 3;     // Retry attempts
input bool   SendFloating      = false; // Send floating P&L
input bool   SendHistoryOnInit = true;  // Send full history at startup
input int    HistoryDays       = 365;   // History days to import (0 = all)

string endpoint;

//+------------------------------------------------------------------+
int OnInit()
{
   endpoint = ServerURL + "/api/trades/ingest";
   if(ApiKey == "") {
      Print("TradeLog: ERROR — ApiKey is empty. Please configure the EA parameters.");
      return INIT_FAILED;
   }
   Print("TradeLog EA v1.10 initialized. Endpoint: ", endpoint);
   EventSetTimer(60);

   if(SendHistoryOnInit)
      SendHistory();

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
void SendHistory()
{
   Print("TradeLog: Starting history export...");

   datetime from_date = (HistoryDays > 0)
      ? TimeCurrent() - (datetime)(HistoryDays * 86400)
      : D'1970.01.01';

   if(!HistorySelect(from_date, TimeCurrent())) {
      Print("TradeLog: HistorySelect failed");
      return;
   }

   int total = HistoryDealsTotal();
   Print("TradeLog: ", total, " deals found in history");

   // Map position_id -> open deal data
   // We store: symbol, type, volume, open_price, open_time, commission, sl, tp
   struct OpenDeal {
      string symbol;
      string type_str;
      double volume;
      double open_price;
      datetime open_time;
      double commission;
      double sl;
      double tp;
   };

   // Use parallel arrays since MQL5 doesn't allow dynamic struct arrays easily
   long    pos_ids[];
   string  pos_symbol[];
   string  pos_type[];
   double  pos_vol[];
   double  pos_open_price[];
   datetime pos_open_time[];
   double  pos_commission[];
   double  pos_sl[];
   double  pos_tp[];
   int     pos_count = 0;

   ArrayResize(pos_ids,        total);
   ArrayResize(pos_symbol,     total);
   ArrayResize(pos_type,       total);
   ArrayResize(pos_vol,        total);
   ArrayResize(pos_open_price, total);
   ArrayResize(pos_open_time,  total);
   ArrayResize(pos_commission, total);
   ArrayResize(pos_sl,         total);
   ArrayResize(pos_tp,         total);

   int sent = 0;
   int skipped = 0;

   for(int i = 0; i < total; i++) {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      ENUM_DEAL_TYPE  deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
      ENUM_DEAL_ENTRY entry     = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY);

      // Skip balance/credit/correction entries
      if(deal_type != DEAL_TYPE_BUY && deal_type != DEAL_TYPE_SELL) continue;
      if(entry != DEAL_ENTRY_IN && entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY) continue;

      long      pos_id     = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      string    symbol     = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double    volume     = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double    price      = HistoryDealGetDouble(ticket, DEAL_PRICE);
      double    commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      double    profit     = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double    swap       = HistoryDealGetDouble(ticket, DEAL_SWAP);
      datetime  deal_time  = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      string    type_str   = (deal_type == DEAL_TYPE_BUY) ? "buy" : "sell";

      if(entry == DEAL_ENTRY_IN) {
         // Store open deal
         pos_ids[pos_count]         = pos_id;
         pos_symbol[pos_count]      = symbol;
         pos_type[pos_count]        = type_str;
         pos_vol[pos_count]         = volume;
         pos_open_price[pos_count]  = price;
         pos_open_time[pos_count]   = deal_time;
         pos_commission[pos_count]  = commission;
         pos_sl[pos_count]          = HistoryDealGetDouble(ticket, DEAL_SL);
         pos_tp[pos_count]          = HistoryDealGetDouble(ticket, DEAL_TP);
         pos_count++;
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
         // Find matching open
         int idx = -1;
         for(int j = pos_count - 1; j >= 0; j--) {
            if(pos_ids[j] == pos_id) { idx = j; break; }
         }

         string open_price_str, open_time_str, sl_str, tp_str;
         string open_type = type_str;
         double total_commission = commission;

         if(idx >= 0) {
            open_price_str   = DoubleToString(pos_open_price[idx], 5);
            open_time_str    = TimeToString(pos_open_time[idx], TIME_DATE|TIME_SECONDS);
            sl_str           = DoubleToString(pos_sl[idx], 5);
            tp_str           = DoubleToString(pos_tp[idx], 5);
            open_type        = pos_type[idx];
            total_commission += pos_commission[idx];
            // Remove from array (swap with last)
            pos_ids[idx]         = pos_ids[pos_count-1];
            pos_symbol[idx]      = pos_symbol[pos_count-1];
            pos_type[idx]        = pos_type[pos_count-1];
            pos_vol[idx]         = pos_vol[pos_count-1];
            pos_open_price[idx]  = pos_open_price[pos_count-1];
            pos_open_time[idx]   = pos_open_time[pos_count-1];
            pos_commission[idx]  = pos_commission[pos_count-1];
            pos_sl[idx]          = pos_sl[pos_count-1];
            pos_tp[idx]          = pos_tp[pos_count-1];
            pos_count--;
         } else {
            // No matching open — use close data for both
            open_price_str = DoubleToString(price, 5);
            open_time_str  = TimeToString(deal_time, TIME_DATE|TIME_SECONDS);
            sl_str = "0"; tp_str = "0";
         }

         string close_time_str = TimeToString(deal_time, TIME_DATE|TIME_SECONDS);
         string payload = StringFormat(
            "{"
            "\"ticket\":%d,"
            "\"symbol\":\"%s\","
            "\"type\":\"%s\","
            "\"volume\":%.3f,"
            "\"open_price\":%s,"
            "\"close_price\":%.5f,"
            "\"sl\":%s,"
            "\"tp\":%s,"
            "\"open_time\":\"%sZ\","
            "\"close_time\":\"%sZ\","
            "\"profit\":%.2f,"
            "\"commission\":%.2f,"
            "\"swap\":%.2f,"
            "\"status\":\"closed\""
            "}",
            pos_id, symbol, open_type, volume,
            open_price_str, price,
            sl_str, tp_str,
            open_time_str, close_time_str,
            profit, total_commission, swap
         );

         SendWithRetry(payload);
         sent++;

         // Avoid hammering the server
         if(sent % 10 == 0) {
            Print("TradeLog: History progress — ", sent, " sent");
            Sleep(500);
         }
      }
   }

   Print("TradeLog: History export complete. Sent: ", sent, " trades.");
}

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

   ulong deal_ticket = trans.deal;
   if(deal_ticket == 0) return;

   if(!HistoryDealSelect(deal_ticket)) {
      HistorySelect(TimeCurrent() - 7*86400, TimeCurrent());
      if(!HistoryDealSelect(deal_ticket)) {
         Print("TradeLog: Cannot select deal ", deal_ticket);
         return;
      }
   }

   ENUM_DEAL_ENTRY entry      = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
   long            position_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
   string          symbol      = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
   double          volume      = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
   double          price       = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
   double          profit      = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
   double          commission  = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
   double          swap        = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
   string          comment     = HistoryDealGetString(deal_ticket, DEAL_COMMENT);
   ENUM_DEAL_TYPE  deal_type   = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
   datetime        deal_time   = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);

   string type_str        = (deal_type == DEAL_TYPE_BUY) ? "buy" : "sell";
   string status          = "open";
   string close_price_str = "null";
   string close_time_str  = "null";
   string profit_str      = "null";
   string open_price_str  = DoubleToString(price, 5);
   string open_time_str   = "\"" + TimeToString(deal_time, TIME_DATE|TIME_SECONDS) + "Z\"";
   double sl = 0, tp = 0;

   if(entry == DEAL_ENTRY_IN) {
      status = "open";
      if(PositionSelectByTicket(position_id)) {
         sl = PositionGetDouble(POSITION_SL);
         tp = PositionGetDouble(POSITION_TP);
      }
   } else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY) {
      status = "closed";
      close_price_str = DoubleToString(price, 5);
      close_time_str  = "\"" + TimeToString(deal_time, TIME_DATE|TIME_SECONDS) + "Z\"";
      profit_str      = DoubleToString(profit, 2);

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
      return;
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
      position_id, symbol, type_str, volume,
      open_price_str, close_price_str,
      sl, tp,
      open_time_str, close_time_str,
      profit_str,
      commission, swap,
      HistoryDealGetInteger(deal_ticket, DEAL_MAGIC),
      comment, status
   );

   SendWithRetry(payload);
}

//+------------------------------------------------------------------+
void OnTimer()
{
   if(!SendFloating) return;

   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;

      string symbol     = PositionGetString(POSITION_SYMBOL);
      double profit     = PositionGetDouble(POSITION_PROFIT);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      double curr_price = PositionGetDouble(POSITION_PRICE_CURRENT);
      double volume     = PositionGetDouble(POSITION_VOLUME);
      datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
      string type_str   = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
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
         ticket, symbol, type_str, volume, open_price, curr_price,
         sl, tp,
         TimeToString(open_time, TIME_DATE|TIME_SECONDS),
         profit, PositionGetInteger(POSITION_MAGIC)
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
      int res = WebRequest("POST", endpoint, headers, 5000, post_data, result_data, result_headers);
      if(res == 200 || res == 201) {
         if(attempt > 1) Print("TradeLog: Success on attempt ", attempt);
         return;
      }
      Print("TradeLog: Attempt ", attempt, " failed. HTTP ", res);
      Sleep(attempt * attempt * 1000);
   }
   Print("TradeLog: ERROR — Failed after ", RetryAttempts, " attempts.");
}
//+------------------------------------------------------------------+
