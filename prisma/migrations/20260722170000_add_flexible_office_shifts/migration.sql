-- Additional weekday office schedules for employees with different start times.

INSERT INTO "hrm_work_shift"
    ("id", "code", "name", "start_time", "end_time", "break_minutes", "late_grace_minutes", "is_active", "schedule_type", "created_at", "updated_at")
VALUES
    ('default_shift_office_9_6', 'OFFICE_9_6', 'ກະຫ້ອງການ 09:00–18:00', '09:00', '18:00', 60, 15, true, 'WEEKDAYS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('default_shift_office_7_4', 'OFFICE_7_4', 'ກະຫ້ອງການ 07:00–16:00', '07:00', '16:00', 60, 15, true, 'WEEKDAYS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
