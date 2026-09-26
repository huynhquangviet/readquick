-- The first migration created the bucket with "on conflict do nothing", which
-- leaves a pre-existing public "documents" bucket public. Make sure it is
-- private and capped at 5MB whatever state it was in.
update storage.buckets
set public = false, file_size_limit = 5242880
where id = 'documents';
