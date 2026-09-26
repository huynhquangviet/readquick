-- Documents, their extracted text, and the private file bucket.
-- Everything is private to its owner: row-level security on both tables and
-- storage policies on the bucket, keyed on the owner's user id.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  format text not null,
  word_count integer not null check (word_count > 0),
  created_at timestamptz not null default now()
);

create index documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- The extracted text: the Words joined by single spaces (splitting on a space
-- gives back the exact Word stream), the Word index at which each Sentence
-- starts, and Chapters as [{ "title": text, "wordIndex": int }].
create table public.document_texts (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null,
  sentence_starts integer[] not null,
  chapters jsonb not null default '[]'::jsonb
);

alter table public.documents enable row level security;
alter table public.document_texts enable row level security;

create policy "Owner can read their Documents"
  on public.documents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can add Documents"
  on public.documents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owner can delete their Documents"
  on public.documents for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can read their Document text"
  on public.document_texts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owner can add text to their own Documents"
  on public.document_texts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "Owner can delete their Document text"
  on public.document_texts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Original files live at <user id>/<document id>.<format> in a private bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5242880)
on conflict (id) do nothing;

create policy "Owner can read their files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owner can upload files to their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owner can delete their files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
