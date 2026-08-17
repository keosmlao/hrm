-- Keep the oldest employee link if legacy data contains the same LINE account more than once.
WITH ranked_links AS (
  SELECT
    "employee_id",
    ROW_NUMBER() OVER (PARTITION BY "line_id" ORDER BY "employee_id") AS row_no
  FROM "odg_employee"
  WHERE "line_id" IS NOT NULL
)
UPDATE "odg_employee" AS employee
SET "line_id" = NULL
FROM ranked_links
WHERE employee."employee_id" = ranked_links."employee_id"
  AND ranked_links.row_no > 1;

CREATE UNIQUE INDEX "odg_employee_line_id_key" ON "odg_employee"("line_id");
