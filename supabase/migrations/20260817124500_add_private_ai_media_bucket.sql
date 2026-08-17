-- Private customer media bucket for AI Mirror / Space uploads.
-- Catalogue/admin media remains in the existing public `neejee-media` bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'neejee-private-ai',
  'neejee-private-ai',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
