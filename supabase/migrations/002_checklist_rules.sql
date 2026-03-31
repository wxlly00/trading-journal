-- Checklist items (modèle de checklist de l'utilisateur)
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  label varchar(200) not null,
  position integer not null default 0,
  created_at timestamptz default now()
);
alter table checklist_items enable row level security;
create policy "users own checklist_items" on checklist_items for all using (auth.uid() = user_id);

-- Checklist réponses par trade
create table trade_checklist (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references trades(id) on delete cascade not null,
  item_id uuid references checklist_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  checked boolean default false,
  unique(trade_id, item_id)
);
alter table trade_checklist enable row level security;
create policy "users own trade_checklist" on trade_checklist for all using (auth.uid() = user_id);

-- Règles de trading
create table trading_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title varchar(200) not null,
  description text default '',
  category varchar(50) default 'general',
  active boolean default true,
  violations integer default 0,
  created_at timestamptz default now()
);
alter table trading_rules enable row level security;
create policy "users own trading_rules" on trading_rules for all using (auth.uid() = user_id);

-- Violations de règles (historique)
create table rule_violations (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references trading_rules(id) on delete cascade not null,
  trade_id uuid references trades(id) on delete set null,
  user_id uuid references auth.users(id) not null,
  note text default '',
  created_at timestamptz default now()
);
alter table rule_violations enable row level security;
create policy "users own rule_violations" on rule_violations for all using (auth.uid() = user_id);
