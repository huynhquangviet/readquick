-- Settings, Reading positions, duplicate detection and the Library cap.
-- Like the tables before them, all of it is private to its owner.

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per user: Speed, font size and theme, shared by every Document and device.
-- The ranges and defaults mirror lib/settings/settings.ts and lib/reader/reader.ts.
-- A null theme means the user has not chosen one, so their browser's stands.
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  speed integer not null default 250 check (speed between 100 and 800),
  font_size double precision not null default 3 check (font_size between 2 and 5),
  theme text check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

create trigger user_settings_touch_updated_at
  before insert or update on public.user_settings
  for each row execute function public.touch_updated_at();

alter table public.user_settings enable row level security;

create policy "Owner can read their settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can add their settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owner can change their settings"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The Reading position: a Word index per Document. A Document belongs to one
-- user, so this is per user and Document. The most recent write wins, and
-- updated_at is when the user last read the Document.
create table public.reading_positions (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_index integer not null check (word_index >= 0),
  updated_at timestamptz not null default now()
);

create trigger reading_positions_touch_updated_at
  before insert or update on public.reading_positions
  for each row execute function public.touch_updated_at();

alter table public.reading_positions enable row level security;

create policy "Owner can read their Reading positions"
  on public.reading_positions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can save a Reading position in their own Documents"
  on public.reading_positions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "Owner can change their Reading positions"
  on public.reading_positions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

-- Duplicate detection: a SHA-256 hash of the file content, unique per user.
-- Documents uploaded before this migration have no hash, and nulls do not
-- collide, so they stay as they are.
alter table public.documents add column content_hash text;

create unique index documents_user_id_content_hash_key
  on public.documents (user_id, content_hash);

-- The 10-Document cap (MAX_DOCUMENTS in lib/library/upload-policy.ts). A trigger, so it holds however a Document is added,
-- and the lock makes two uploads at the same moment count one after the other.
create function public.enforce_documents_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.documents where user_id = new.user_id) >= 10 then
    raise exception 'library_full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger documents_enforce_limit
  before insert on public.documents
  for each row execute function public.enforce_documents_limit();
