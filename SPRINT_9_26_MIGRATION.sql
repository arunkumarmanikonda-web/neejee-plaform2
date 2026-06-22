-- v23.40.8 — Vendor service categorisation.
-- Run in Supabase SQL Editor BEFORE deploying v23.40.8.

ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "serviceCategoryGroup"     TEXT,
  ADD COLUMN IF NOT EXISTS "defaultExpenseCategoryId" TEXT;

-- Optional: auto-categorise existing vendors based on their most-frequent expense category.
-- For each vendor that has at least one expense or bill, find the most-used category group
-- and stamp it as the serviceCategoryGroup.
WITH vendor_top_group AS (
  SELECT
    v."id" AS vendor_id,
    cat."group" AS grp,
    COUNT(*) AS hits,
    ROW_NUMBER() OVER (PARTITION BY v."id" ORDER BY COUNT(*) DESC) AS rnk
  FROM "Vendor" v
  JOIN (
    SELECT "vendorId", "categoryId" FROM "Expense" WHERE "vendorId" IS NOT NULL
    UNION ALL
    SELECT "vendorId", "categoryId" FROM "Bill"    WHERE "vendorId" IS NOT NULL
  ) src ON src."vendorId" = v."id"
  JOIN "ExpenseCategory" cat ON cat."id" = src."categoryId"
  GROUP BY v."id", cat."group"
)
UPDATE "Vendor" v
   SET "serviceCategoryGroup" = vtg.grp
  FROM vendor_top_group vtg
 WHERE vtg.vendor_id = v."id"
   AND vtg.rnk = 1
   AND v."serviceCategoryGroup" IS NULL;
