/**
 * ສ້ອມສະຖານະການຈ້າງງານທີ່ຂັດກັນ ລະຫວ່າງ
 *   `odg_employee.employment_status`  (ລະບົບອື່ນອ່ານ: ຄົນຂັບ, ເງິນເດືອນ, ລົງເວລາ)
 *   `hrm_employee_profile.hr_status`  (HR ຕັ້ງເອງຜ່ານໜ້າ HRM)
 *
 * ເກີດຈາກຟອມແກ້ໄຂເກົ່າ ທີ່ຕັ້ງແຕ່ `hr_status` ໂດຍບໍ່ໄດ້ອັບເດດ ERP ນຳ.
 * ຜົນຄື ຄົນທີ່ລາອອກແລ້ວຍັງໂຜ່ໃນລາຍຊື່ຄົນຂັບ/ຜູ້ຮັບເງິນເດືອນ.
 *
 * ⚠ ສະຄຣິບນີ້ **ບໍ່ເດົາວັນລາອອກ** — ໃສ່ພຽງສະຖານະໃຫ້ຕົງກັນ.
 *   ວັນທີ່ມີຜົນ ແລະ ເຫດຜົນ ຕ້ອງໃຫ້ HR ໃສ່ເອງຜ່ານໜ້າພະນັກງານ.
 *
 *   npm run hr:fix-status              # ເບິ່ງກ່ອນ
 *   npm run hr:fix-status -- --apply   # ສ້ອມແທ້
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const GONE = ["RESIGNED", "TERMINATED"];

async function main() {
  const rows = await prisma.employee.findMany({
    select: {
      code: true,
      fullnameLo: true,
      employmentStatus: true,
      profile: { select: { hrStatus: true, resignDate: true } },
      user: { select: { id: true, isActive: true } },
    },
    orderBy: { code: "asc" },
  });

  const erpGone = (s: string | null) => s != null && GONE.includes(s);
  const hrGone = (s: string | null | undefined) => s != null && GONE.includes(s);

  // HR ບອກວ່າອອກແລ້ວ ແຕ່ ERP ຍັງ ACTIVE → ເອົາ hr_status ເປັນຫຼັກ
  const toClose = rows.filter((r) => hrGone(r.profile?.hrStatus) && !erpGone(r.employmentStatus));
  // ERP ບອກວ່າອອກແລ້ວ ແຕ່ HR ຍັງບອກເຮັດວຽກຢູ່ → ບອກໃຫ້ຄົນຕັດສິນ ບໍ່ແກ້ເອງ
  const conflict = rows.filter((r) => erpGone(r.employmentStatus) && !hrGone(r.profile?.hrStatus));

  console.log(`ພະນັກງານ ${rows.length} ຄົນ\n`);

  console.log(`── ຈະຕັ້ງ ERP ໃຫ້ຕົງກັບ HR: ${toClose.length} ຄົນ ──`);
  for (const r of toClose) {
    const noDate = !r.profile?.resignDate;
    console.log(
      `  ${r.code}  ${(r.fullnameLo ?? "").padEnd(24)} ACTIVE → ${r.profile!.hrStatus}` +
        (noDate ? "   ⚠ ຍັງບໍ່ມີວັນລາອອກ" : "") +
        (r.user?.isActive ? "   ⚠ ບັນຊີຍັງເປີດ (ຈະປິດໃຫ້)" : ""),
    );
  }

  if (conflict.length) {
    console.log(`\n── ຂັດກັນທາງກົງກັນຂ້າມ ${conflict.length} ຄົນ (ບໍ່ແກ້ອັດຕະໂນມັດ) ──`);
    for (const r of conflict)
      console.log(`  ${r.code}  ${r.fullnameLo}  ERP=${r.employmentStatus} ແຕ່ hrStatus=${r.profile?.hrStatus ?? "(ບໍ່ມີ)"}`);
    console.log("  → ຕັດສິນເອງວ່າອັນໃດຖືກ ແລ້ວບັນທຶກຜ່ານໜ້າພະນັກງານ");
  }

  if (toClose.length === 0) {
    console.log("\n✓ ບໍ່ມີຫຍັງຕ້ອງສ້ອມ");
    return;
  }

  if (!APPLY) {
    console.log("\n⚠ DRY-RUN — ຍັງບໍ່ໄດ້ຂຽນ. ໃສ່ --apply ຈຶ່ງສ້ອມແທ້");
    return;
  }

  for (const r of toClose) {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { code: r.code },
        data: { employmentStatus: r.profile!.hrStatus! },
      });
      if (r.user?.isActive) {
        await tx.user.update({ where: { id: r.user.id }, data: { isActive: false } });
      }
    });
    console.log(`  ✓ ${r.code} ${r.fullnameLo}`);
  }

  console.log(`\n✓ ສ້ອມແລ້ວ ${toClose.length} ຄົນ`);
  console.log("  ຍັງເຫຼືອ: ໃສ່ວັນທີ່ມີຜົນ + ເຫດຜົນ ຜ່ານໜ້າພະນັກງານ (ບໍ່ເດົາໃຫ້)");
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
