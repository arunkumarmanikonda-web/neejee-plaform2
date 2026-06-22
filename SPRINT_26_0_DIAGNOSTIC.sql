-- DIAGNOSTIC: show me what the Category table actually looks like in your Supabase DB
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'Category'
ORDER BY ordinal_position;
