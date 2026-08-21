/**
 * ທະບຽນເມນູກາງ — ແຫຼ່ງຄວາມຈິງອັນດຽວຂອງ "ລະບົບມີໜ້າໃດແດ່".
 *
 * ໃຊ້ຮ່ວມກັນ 3 ບ່ອນ: ແຖບເມນູຂ້າງ, ໜ້າຕັ້ງຄ່າສິດ ແລະ ການບັງຄັບສິດຕອນເປີດໜ້າ
 * ຈຶ່ງເພີ່ມໜ້າໃໝ່ບ່ອນດຽວແລ້ວຄົບທຸກບ່ອນ.
 *
 * ບໍ່ import server-only/prisma ຈຶ່ງ test ໄດ້ ແລະ client component ໃຊ້ໄດ້.
 */

export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE" | "EXECUTIVE";

export const ROLES: Role[] = ["ADMIN", "HR", "MANAGER", "EXECUTIVE", "EMPLOYEE"];

export type IconName =
  | "dashboard" | "employees" | "attendance" | "leave" | "overtime" | "payroll"
  | "appraisal" | "org" | "recruitment" | "assets" | "fleet" | "trips"
  | "profile" | "settings";

export type MenuItem = {
  /** ລະຫັດຄົງທີ່ — ເກັບໃນ DB, ຢ່າປ່ຽນຫຼັງໃຊ້ງານແລ້ວ */
  key: string;
  href: string;
  label: string;
  icon: IconName;
  /** ສິດເລີ່ມຕົ້ນ ເມື່ອຍັງບໍ່ໄດ້ຕັ້ງຄ່າໃນ DB */
  defaultRoles: Role[];
  /** ຄົງ route/permission ໄວ້ ແຕ່ບໍ່ສະແດງເປັນລາຍການຊ້ຳໃນ sidebar */
  hiddenFromSidebar?: boolean;
};

export type MenuGroup = { title: string; items: MenuItem[] };

const ALL: Role[] = ROLES;
const MANAGE: Role[] = ["ADMIN", "HR"];
const FLEET: Role[] = ["ADMIN", "HR", "MANAGER", "EXECUTIVE"];
/** ຜູ້ຕັດສິນເລື່ອງລົດ — ກວດ/ຢືນຢັນເຫດການ (ບໍ່ລວມ EXECUTIVE ທີ່ເບິ່ງເທົ່ານັ້ນ)  */
const FLEET_REVIEW: Role[] = ["ADMIN", "HR", "MANAGER"];

export const MENU: MenuGroup[] = [
  {
    title: "ພາບລວມ",
    items: [{ key: "dashboard", href: "/dashboard", label: "ໜ້າຫຼັກ", icon: "dashboard", defaultRoles: ALL }],
  },
  {
    title: "ບຸກຄະລາກອນ",
    items: [
      { key: "employees", href: "/employees", label: "ຂໍ້ມູນພະນັກງານ", icon: "employees", defaultRoles: ALL },
      { key: "attendance", href: "/attendance", label: "ການລົງເວລາ", icon: "attendance", defaultRoles: FLEET },
      { key: "leave", href: "/leave", label: "ການລາພັກ", icon: "leave", defaultRoles: ALL },
      { key: "overtime", href: "/overtime", label: "ວຽກລ່ວງເວລາ", icon: "overtime", defaultRoles: ALL },
      { key: "payroll", href: "/payroll", label: "ເງິນເດືອນ", icon: "payroll", defaultRoles: ["ADMIN", "HR", "EXECUTIVE"] },
      { key: "appraisal", href: "/appraisal", label: "ປະເມີນຜົນງານ", icon: "appraisal", defaultRoles: ALL },
      { key: "org", href: "/org", label: "ໂຄງສ້າງອົງກອນ", icon: "org", defaultRoles: ALL },
      { key: "assets", href: "/assets", label: "ຊັບສິນ ແລະ ອຸປະກອນ", icon: "assets", defaultRoles: MANAGE },
      { key: "recruitment", href: "/recruitment", label: "ຮັບສະໝັກງານ", icon: "recruitment", defaultRoles: ["ADMIN", "HR", "EXECUTIVE"] },
    ],
  },
  {
    title: "ຂົນສົ່ງ / ລົດ",
    items: [
      { key: "fleet.trips", href: "/fleet/trips", label: "ລາຍການ / ແຜນນຳໃຊ້ລົດ", icon: "trips", defaultRoles: FLEET },
      { key: "fleet.board", href: "/fleet/board", label: "ບອດລົດຕາມພະແນກ", icon: "fleet", defaultRoles: FLEET },
      { key: "fleet.tracking", href: "/fleet/tracking", label: "ຕິດຕາມຕຳແໜ່ງລົດ", icon: "fleet", defaultRoles: FLEET },
      { key: "fleet.history", href: "/fleet/history", label: "ປະຫວັດເສັ້ນທາງ", icon: "fleet", defaultRoles: FLEET },
      { key: "fleet.fuel", href: "/fleet/fuel", label: "ລາຍງານນ້ຳມັນ", icon: "fleet", defaultRoles: FLEET },
      // ລວມເຂົ້າ "ລາຍງານນ້ຳມັນ" ແລ້ວ — ຄົງ route ໄວ້ໃຫ້ລິງເກົ່າໃຊ້ໄດ້
      { key: "fleet.fuelNorm", href: "/fleet/fuel-norm", label: "ມາດຕະຖານກິນນ້ຳມັນ", icon: "fleet", defaultRoles: FLEET, hiddenFromSidebar: true },
      { key: "fleet.fuelCost", href: "/fleet/fuel/cost", label: "ຕົ້ນທຶນນ້ຳມັນ / ກວດບິນ", icon: "fleet", defaultRoles: FLEET },
      { key: "fleet.fuelReview", href: "/fleet/fuel/review", label: "ກວດເຫດການນ້ຳມັນ", icon: "fleet", defaultRoles: FLEET_REVIEW },
      { key: "fleet.gpsSummary", href: "/fleet/gps-summary", label: "ສະຫຼຸບ GPS ປະຈຳເດືອນ", icon: "fleet", defaultRoles: FLEET },
      // ລວມເຂົ້າ "ສະຫຼຸບ GPS ປະຈຳເດືອນ" ແລ້ວ (ຮຽງຕາມຄະແນນໄດ້ດ້ວຍ ?sort=safety)
      { key: "fleet.driverScore", href: "/fleet/driver-score", label: "ຄະແນນການຂັບຂີ່", icon: "fleet", defaultRoles: FLEET, hiddenFromSidebar: true },
      { key: "fleet.dailySlip", href: "/fleet/daily-slip", label: "ລາຍການໃບນຳໃຊ້ລົດ", icon: "trips", defaultRoles: FLEET, hiddenFromSidebar: true },
      { key: "fleet.monthlyPlan", href: "/fleet/monthly-plan", label: "ແຜນນຳໃຊ້ລົດ ລາຍເດືອນ", icon: "trips", defaultRoles: FLEET, hiddenFromSidebar: true },
      { key: "fleet.vehicles", href: "/fleet/vehicles", label: "ຈັດການລົດ", icon: "fleet", defaultRoles: MANAGE },
    ],
  },
  {
    title: "ຂ້ອຍ",
    items: [{ key: "me", href: "/me", label: "ຂໍ້ມູນສ່ວນຕົວ", icon: "profile", defaultRoles: ALL }],
  },
  {
    title: "ລະບົບ",
    items: [
      { key: "settings.permissions", href: "/settings/permissions", label: "ສິດການເຂົ້າໃຊ້ເມນູ", icon: "settings", defaultRoles: ["ADMIN"] },
      { key: "settings.units", href: "/settings/units", label: "ກຳນົດໜ່ວຍງານ", icon: "org", defaultRoles: MANAGE },
      { key: "settings.positions", href: "/settings/positions", label: "ກຳນົດຕຳແໜ່ງ", icon: "org", defaultRoles: MANAGE },
      { key: "settings.attendance", href: "/settings/attendance", label: "ຕັ້ງຄ່າການລົງເວລາ", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.shifts", href: "/settings/shifts", label: "ຕັ້ງຄ່າກະເຮັດວຽກ", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.leave", href: "/settings/leave", label: "ຕັ້ງຄ່າການລາ", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.holidays", href: "/settings/holidays", label: "ຕັ້ງຄ່າວັນພັກ", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.overtime", href: "/settings/overtime", label: "ຕັ້ງຄ່າ OT", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.tripApprovers", href: "/settings/trip-approvers", label: "ຕັ້ງຄ່າຜູ້ອະນຸມັດແຜນ", icon: "settings", defaultRoles: MANAGE },
      { key: "settings.vehicleApprovers", href: "/settings/vehicle-approvers", label: "ຕັ້ງຄ່າຜູ້ອະນຸມັດລົດ", icon: "settings", defaultRoles: MANAGE },
    ],
  },
];

export const MENU_ITEMS: MenuItem[] = MENU.flatMap((g) => g.items);

/** ສິດເລີ່ມຕົ້ນຂອງ role — ໃຊ້ເມື່ອຍັງບໍ່ໄດ້ຕັ້ງຄ່າໃນ DB */
export function defaultKeysFor(role: Role): string[] {
  return MENU_ITEMS.filter((i) => i.defaultRoles.includes(role)).map((i) => i.key);
}

/**
 * ຫາເມນູທີ່ຄຸມ path ນີ້ — ເອົາ href ທີ່ຍາວທີ່ສຸດທີ່ກົງ ເພື່ອໃຫ້
 * `/fleet/trips/123` ຕົກໃສ່ `fleet.trips` ບໍ່ແມ່ນ `/fleet`.
 * ຄືນ `null` ຖ້າ path ບໍ່ຢູ່ໃນທະບຽນ (ເຊັ່ນ /dashboard ຍ່ອຍ ຫຼື ໜ້າໃໝ່ທີ່ຍັງບໍ່ລົງທະບຽນ).
 */
export function menuForPath(pathname: string): MenuItem | null {
  let best: MenuItem | null = null;
  for (const i of MENU_ITEMS) {
    if (pathname === i.href || pathname.startsWith(i.href + "/")) {
      if (!best || i.href.length > best.href.length) best = i;
    }
  }
  return best;
}
