-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "hrm_job_posting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "department_code" VARCHAR(20),
    "position_code" VARCHAR(20),
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "location" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "salary_range" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
    "closing_date" DATE,
    "posted_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_job_posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrm_job_application" (
    "id" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "gender" "Gender",
    "dob" DATE,
    "address" TEXT,
    "position_applied" TEXT,
    "education" TEXT,
    "experience" TEXT,
    "expected_salary" DECIMAL(14,2),
    "cover_letter" TEXT,
    "resume_url" TEXT,
    "source" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "job_posting_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_job_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_job_posting_slug_key" ON "hrm_job_posting"("slug");

-- CreateIndex
CREATE INDEX "hrm_job_posting_status_idx" ON "hrm_job_posting"("status");

-- CreateIndex
CREATE INDEX "hrm_job_application_status_idx" ON "hrm_job_application"("status");

-- CreateIndex
CREATE INDEX "hrm_job_application_job_posting_id_idx" ON "hrm_job_application"("job_posting_id");

-- AddForeignKey
ALTER TABLE "hrm_job_application" ADD CONSTRAINT "hrm_job_application_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "hrm_job_posting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
