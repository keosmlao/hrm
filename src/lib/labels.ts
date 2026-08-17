/** ສະຖານະ HR (hrm_employee_profile.hr_status) */
export const HR_STATUS_LABEL: Record<string, string> = {
  PROBATION: "ທົດລອງງານ",
  ACTIVE: "ປະຈຳການ",
  ON_LEAVE: "ພັກຊົ່ວຄາວ",
  SUSPENDED: "ພັກງານ",
  RESIGNED: "ລາອອກ",
  TERMINATED: "ຖືກໃຫ້ອອກ",
};

export const HR_STATUS_TONE: Record<
  string,
  "green" | "amber" | "blue" | "red" | "gray"
> = {
  ACTIVE: "green",
  PROBATION: "amber",
  ON_LEAVE: "blue",
  SUSPENDED: "red",
  RESIGNED: "gray",
  TERMINATED: "gray",
};

/** ສະຖານະໃນ odg_employee.employment_status (ຂໍ້ມູນເກົ່າ) */
export const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ເຮັດວຽກຢູ່",
  INACTIVE: "ບໍ່ເຮັດວຽກແລ້ວ",
  RESIGNED: "ລາອອກ",
};

export const GENDER_LABEL: Record<string, string> = {
  MALE: "ຊາຍ",
  FEMALE: "ຍິງ",
  OTHER: "ອື່ນໆ",
};

export const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "ໂສດ",
  MARRIED: "ແຕ່ງງານແລ້ວ",
  DIVORCED: "ຢ່າຮ້າງ",
  WIDOWED: "ໝ້າຍ",
};

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  PROBATION: "ສັນຍາທົດລອງງານ",
  FIXED_TERM: "ສັນຍາມີກຳນົດ",
  PERMANENT: "ສັນຍາປະຈຳ",
  PART_TIME: "ພາກສ່ວນເວລາ",
  INTERNSHIP: "ຝຶກງານ",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "ຮ່າງ",
  PENDING_MANAGER: "ລໍຖ້າຫົວໜ້າອະນຸມັດ",
  PENDING_HR: "ລໍຖ້າ HR ກວດສອບ",
  APPROVED: "ອະນຸມັດແລ້ວ",
  REJECTED: "ບໍ່ອະນຸມັດ",
  CANCELLED: "ຍົກເລີກ",
};

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  PROMOTION: "ເລື່ອນຕຳແໜ່ງ",
  TRANSFER_DEPT: "ປ່ຽນພະແນກ",
  TRANSFER_UNIT: "ປ່ຽນໜ່ວຍງານ",
  SALARY_ADJUST: "ປັບເງິນເດືອນ",
  STATUS_CHANGE: "ປ່ຽນສະຖານະ",
};

/** ຮັບສະໝັກງານ — ປະເພດການຈ້າງ (hrm_job_posting.employment_type) */
export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "ເຕັມເວລາ",
  PART_TIME: "ພາກສ່ວນເວລາ",
  CONTRACT: "ສັນຍາຈ້າງ",
  INTERNSHIP: "ຝຶກງານ",
};

/** ສະຖານະປະກາດຮັບສະໝັກ (hrm_job_posting.status) */
export const JOB_POSTING_STATUS_LABEL: Record<string, string> = {
  DRAFT: "ຮ່າງ",
  OPEN: "ເປີດຮັບສະໝັກ",
  CLOSED: "ປິດຮັບສະໝັກ",
};

export const JOB_POSTING_STATUS_TONE: Record<
  string,
  "green" | "amber" | "gray"
> = {
  OPEN: "green",
  DRAFT: "amber",
  CLOSED: "gray",
};

/** ສະຖານະໃບສະໝັກ (hrm_job_application.status) */
export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  NEW: "ໃໝ່",
  SCREENING: "ກັ່ນຕອງ",
  INTERVIEW: "ນັດສຳພາດ",
  OFFERED: "ສະເໜີວຽກ",
  HIRED: "ຮັບເຂົ້າແລ້ວ",
  REJECTED: "ບໍ່ຜ່ານ",
};

export const APPLICATION_STATUS_TONE: Record<
  string,
  "blue" | "amber" | "violet" | "green" | "gray" | "red"
> = {
  NEW: "blue",
  SCREENING: "amber",
  INTERVIEW: "violet",
  OFFERED: "green",
  HIRED: "green",
  REJECTED: "red",
};
