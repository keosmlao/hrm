-- Standard office schedule for employees who work 08:00–17:00, Monday–Friday.

INSERT INTO "hrm_work_shift"
    ("id", "code", "name", "start_time", "end_time", "break_minutes", "late_grace_minutes", "is_active", "schedule_type", "created_at", "updated_at")
VALUES
    ('default_shift_office', 'OFFICE', 'ກະຫ້ອງການ', '08:00', '17:00', 60, 15, true, 'WEEKDAYS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
