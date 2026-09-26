-- Daily reading activity: one row per user per day, holding the seconds played
-- and the Words read. The day is the user's local date, supplied by the client
-- from the user's time zone, so it is a plain date and not a moment in time.
-- Nothing shows these rows yet; the Stats page reads them. Like the tables
-- before it, all of it is private to its owner.
create table public.reading_activity (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  seconds_played double precision not null default 0 check (seconds_played >= 0),
  words_read integer not null default 0 check (words_read >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger reading_activity_touch_updated_at
  before insert or update on public.reading_activity
  for each row execute function public.touch_updated_at();

alter table public.reading_activity enable row level security;

create policy "Owner can read their reading activity"
  on public.reading_activity for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can add their reading activity"
  on public.reading_activity for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owner can change their reading activity"
  on public.reading_activity for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Adds activity to a day's row, creating the row on the first activity of the
-- day. It adds rather than sets, so two devices reading on the same day, or a
-- send that is repeated after a failure, cannot overwrite each other.
-- It runs as the caller, so the policies above still apply.
create function public.record_reading_activity(
  p_day date,
  p_seconds double precision,
  p_words integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_seconds < 0 or p_words < 0 then
    raise exception 'reading_activity_negative' using errcode = 'check_violation';
  end if;

  -- A local date is at most a day ahead of UTC's (the furthest zone is UTC+14).
  if p_day > (now() at time zone 'utc')::date + 1 then
    raise exception 'reading_activity_day_in_future' using errcode = 'check_violation';
  end if;

  insert into public.reading_activity as a (user_id, day, seconds_played, words_read)
  values ((select auth.uid()), p_day, p_seconds, p_words)
  on conflict (user_id, day) do update
    set seconds_played = a.seconds_played + excluded.seconds_played,
        words_read = a.words_read + excluded.words_read;
end;
$$;

revoke execute on function public.record_reading_activity(date, double precision, integer) from public, anon;
grant execute on function public.record_reading_activity(date, double precision, integer) to authenticated;
