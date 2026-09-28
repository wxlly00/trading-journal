-- Connection presence is only set by authenticated EA requests.
alter table public.accounts
  add column last_seen_at timestamptz,
  add column imported_trades_count integer not null default 0
    check (imported_trades_count >= 0);

-- Positive tickets come from the EA or a MT5 CSV import. Manual trades
-- have negative synthetic tickets and are excluded from this count.
update public.accounts a
set imported_trades_count = (
  select count(*)::integer
  from public.trades t
  where t.account_id = a.id and t.ticket > 0
);

create function public.refresh_account_imported_trades_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.ticket > 0 then
      update public.accounts
      set imported_trades_count = imported_trades_count + 1
      where id = new.account_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.ticket = old.ticket and new.account_id = old.account_id then
      return new;
    end if;
    if old.ticket > 0 then
      update public.accounts
      set imported_trades_count = imported_trades_count - 1
      where id = old.account_id;
    end if;
    if new.ticket > 0 then
      update public.accounts
      set imported_trades_count = imported_trades_count + 1
      where id = new.account_id;
    end if;
    return new;
  end if;

  if old.ticket > 0 then
    update public.accounts
    set imported_trades_count = imported_trades_count - 1
    where id = old.account_id;
  end if;
  return old;
end;
$$;

create trigger trades_imported_count_insert
after insert on public.trades
for each row execute function public.refresh_account_imported_trades_count();

create trigger trades_imported_count_delete
after delete on public.trades
for each row execute function public.refresh_account_imported_trades_count();

create trigger trades_imported_count_update
after update of ticket, account_id on public.trades
for each row execute function public.refresh_account_imported_trades_count();
