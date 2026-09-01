-- ຄັງຄວາມຮູ້ (Knowledge Management) — ຕາຕະລາງໃໝ່ລ້ວນ, additive, ບໍ່ແຕະຂອງເກົ່າ.
--
-- ໝາຍເຫດ DB ຈິງ: PostgreSQL 11 ແລະ **ບໍ່ມີ pg_trgm** ຈຶ່ງບໍ່ມີ GIN trigram index;
-- ພາສາລາວກໍບໍ່ມີຊ່ອງຫວ່າງລະຫວ່າງຄຳ ຈຶ່ງ to_tsvector ຕັດຄຳບໍ່ໄດ້.
-- ການຄົ້ນຫາຈຶ່ງໃຊ້ ILIKE '%…%' ໃນ code (ດີພໍໃນລະດັບຫຼາຍພັນບົດ).
-- ສະຖານະ/ການເຫັນ ເປັນ TEXT ບໍ່ແມ່ນ enum — ຫຼີກການເພີ່ມ type ໃສ່ DB ຮ່ວມ.
-- ບໍ່ໃສ່ FK ໄປ odg_employee (ຕາຕະລາງ ERP ທີ່ sync ຈາກພາຍນອກ) — ກວດໃນ code ແທນ.

CREATE TABLE "hrm_kb_category" (
  "id"         TEXT NOT NULL,
  "name_lo"    TEXT NOT NULL,
  "parent_id"  TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_kb_category_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hrm_kb_category"
  ADD CONSTRAINT "hrm_kb_category_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "hrm_kb_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hrm_kb_category_parent_id_idx" ON "hrm_kb_category" ("parent_id");

CREATE TABLE "hrm_kb_article" (
  "id"                  TEXT NOT NULL,
  "category_id"         TEXT,
  "title"               TEXT NOT NULL,
  "summary"             TEXT,
  "body"                TEXT NOT NULL,
  "tags"                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"              TEXT NOT NULL DEFAULT 'DRAFT',
  "visibility"          TEXT NOT NULL DEFAULT 'ALL',
  "visible_departments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "visible_roles"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requires_ack"        BOOLEAN NOT NULL DEFAULT false,
  "version"             INTEGER NOT NULL DEFAULT 1,
  "view_count"          INTEGER NOT NULL DEFAULT 0,
  "author_code"         VARCHAR(20),
  "published_at"        TIMESTAMP(3),
  "published_by"        TEXT,
  "reject_reason"       TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"          TEXT,
  CONSTRAINT "hrm_kb_article_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hrm_kb_article"
  ADD CONSTRAINT "hrm_kb_article_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "hrm_kb_category" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hrm_kb_article_status_idx" ON "hrm_kb_article" ("status");
CREATE INDEX "hrm_kb_article_category_id_idx" ON "hrm_kb_article" ("category_id");

CREATE TABLE "hrm_kb_article_version" (
  "id"         TEXT NOT NULL,
  "article_id" TEXT NOT NULL,
  "version"    INTEGER NOT NULL,
  "title"      TEXT NOT NULL,
  "summary"    TEXT,
  "body"       TEXT NOT NULL,
  "note"       TEXT,
  "changed_by" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_kb_article_version_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hrm_kb_article_version"
  ADD CONSTRAINT "hrm_kb_article_version_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "hrm_kb_article" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "hrm_kb_article_version_article_id_version_key"
  ON "hrm_kb_article_version" ("article_id", "version");

CREATE TABLE "hrm_kb_attachment" (
  "id"          TEXT NOT NULL,
  "article_id"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "stored_name" TEXT NOT NULL,
  "mime"        TEXT NOT NULL,
  "size_bytes"  INTEGER NOT NULL,
  "uploaded_by" TEXT,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_kb_attachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hrm_kb_attachment"
  ADD CONSTRAINT "hrm_kb_attachment_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "hrm_kb_article" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "hrm_kb_attachment_article_id_idx" ON "hrm_kb_attachment" ("article_id");

-- ຮັບຮູ້ຕໍ່ "ຮຸ່ນ" — ແກ້ນະໂຍບາຍແລ້ວຕ້ອງຮັບຮູ້ໃໝ່
CREATE TABLE "hrm_kb_ack" (
  "article_id"    TEXT NOT NULL,
  "employee_code" VARCHAR(20) NOT NULL,
  "version"       INTEGER NOT NULL,
  "acked_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hrm_kb_ack_pkey" PRIMARY KEY ("article_id", "employee_code", "version")
);

ALTER TABLE "hrm_kb_ack"
  ADD CONSTRAINT "hrm_kb_ack_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "hrm_kb_article" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "hrm_kb_ack_employee_code_idx" ON "hrm_kb_ack" ("employee_code");
