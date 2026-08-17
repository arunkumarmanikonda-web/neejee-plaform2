insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'neejee-private-seller-docs',
  'neejee-private-seller-docs',
  false,
  8388608,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();
