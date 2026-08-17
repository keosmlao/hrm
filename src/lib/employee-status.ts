/**
 * ສະຖານະການຈ້າງງານ — **ແຫຼ່ງຄວາມຈິງອັນດຽວ** ຄື `odg_employee.employment_status`.
 *
 * ເປັນຫຍັງຕ້ອງມີໄຟລ໌ນີ້: ແຕ່ກ່ອນແຕ່ລະໜ້າຂຽນເງື່ອນໄຂເອງ ແລະ ບໍ່ຄືກັນ —
 * ບາງບ່ອນກວດ `employment_status`, ບາງບ່ອນກວດ `profile.hr_status`, ບາງບ່ອນກວດທັງສອງ.
 * ຜົນຄື ວັນທີ 2026-08-13 ພົບພະນັກງານ 2 ຄົນທີ່ລາອອກແລ້ວ ແຕ່ຍັງໂຜ່ໃນລາຍຊື່ຄົນຂັບ
 * ເພາະ ERP ຍັງເປັນ ACTIVE ຢູ່.
 *
 * `hrm_employee_profile.hr_status` ຍັງຄົງໄວ້ເປັນລາຍລະອຽດ (ທົດລອງງານ, ພັກຊົ່ວຄາວ)
 * ແຕ່ **ບໍ່ໃຊ້ຕັດສິນ** ວ່າຍັງເຮັດວຽກຢູ່ບໍ ອີກຕໍ່ໄປ.
 *
 * ບໍ່ import prisma/server-only ຈຶ່ງ test ໄດ້ ແລະ ໃຊ້ໄດ້ທຸກບ່ອນ.
 */

/** ສະຖານະທີ່ຖືວ່າ "ອອກຈາກອົງກອນແລ້ວ" */
export const GONE_STATUS = ["RESIGNED", "TERMINATED"] as const;

/** ຍັງເຮັດວຽກຢູ່ບໍ (ຮັບຄ່າຈາກ `odg_employee.employment_status`) */
export function isEmployed(employmentStatus: string | null | undefined): boolean {
  if (!employmentStatus) return false;
  return !GONE_STATUS.includes(employmentStatus as (typeof GONE_STATUS)[number]);
}

/**
 * ເງື່ອນໄຂ Prisma ສຳລັບ "ພະນັກງານທີ່ຍັງເຮັດວຽກຢູ່".
 *
 * ໃຊ້ `{ employmentStatus: "ACTIVE" }` ບໍ່ແມ່ນ `notIn [RESIGNED, TERMINATED]`
 * ເພາະຄ່າ null ຄວນຖືວ່າ **ບໍ່ຜ່ານ** — ຂໍ້ມູນບໍ່ຄົບບໍ່ຄວນຖືກນັບເປັນພະນັກງານປັດຈຸບັນ.
 */
export const ACTIVE_EMPLOYEE = { employmentStatus: "ACTIVE" } as const;
