create extension if not exists "pgcrypto";

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name varchar(100) not null,
  broker varchar(50) default 'XM',
  account_number varchar(50),
  initial_capital decimal(12,2) not null default 10000,
  currency varchar(3) default 'USD',
  is_live boolean default true,
  api_key_hash text not null,
  created_at timestamptz default now()
);
alter table accounts enable row level security;
create policy "users own accounts" on accounts for all using (auth.uid() = user_id);

create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  account_id uuid references accounts(id) not null,
  ticket bigint not null,
  symbol varchar(20) not null,
  type varchar(20) not null,
  volume decimal(10,3) not null,
  open_price decimal(12,5),
  close_price decimal(12,5),
  sl decimal(12,5),
  tp decimal(12,5),
  open_time timestamptz,
  close_time timestamptz,
  profit decimal(10,2),
  commission decimal(10,2) default 0,
  swap decimal(10,2) default 0,
  pnl_net decimal(10,2),
  rr_realized decimal(6,3),
  duration_min integer,
  session varchar(12),
  status varchar(10) not null default 'open',
  note text,
  tags text[],
  psy_score smallint check (psy_score between 1 and 5),
  screenshot_url text,
  magic integer,
  comment varchar(255),
  unique(account_id, ticket),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table trades enable row level security;
create policy "users own trades" on trades for all using (auth.uid() = user_id);
create index on trades (account_id, open_time desc);
create index on trades (account_id, symbol);
create index on trades (account_id, status);
create index on trades (account_id, session);
create index on trades (account_id, close_time desc);

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  date date not null,
  content text not null,
  unique(user_id, date),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table notes enable row level security;
create policy "users own notes" on notes for all using (auth.uid() = user_id);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  account_id uuid references accounts(id) not null,
  type varchar(30) not null,
  threshold decimal(6,2) not null,
  email varchar(255) not null,
  active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now()
);
alter table alerts enable row level security;
create policy "users own alerts" on alerts for all using (auth.uid() = user_id);

create table alert_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  alert_id uuid references alerts(id),
  triggered_at timestamptz default now(),
  payload jsonb
);
alter table alert_history enable row level security;
create policy "users own alert_history" on alert_history for all using (auth.uid() = user_id);

create table learning_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title varchar(200) not null,
  content text,
  category varchar(20) default 'autre',
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table learning_entries enable row level security;
create policy "users own learning" on learning_entries for all using (auth.uid() = user_id);

create table drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title varchar(200) not null,
  elements jsonb not null default '[]',
  app_state jsonb not null default '{}',
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table drawings enable row level security;
create policy "users own drawings" on drawings for all using (auth.uid() = user_id);
