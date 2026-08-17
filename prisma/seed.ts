import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Seed ໃສ່ສະເພາະຕາຕະລາງ hrm_* ເທົ່ານັ້ນ
 * ຂໍ້ມູນພະນັກງານ / ພະແນກ / ຕຳແໜ່ງ = ຂໍ້ມູນຈິງໃນ odg_* (ບໍ່ແຕະ)
 */
async function main() {
  console.log("🌱 Seed ຕາຕະລາງ hrm_* ໃນ DB odg ...");

  // ─── ປະເພດການລາ ───
  const leaveTypes = [
    { code: "ANNUAL", name: "ລາພັກປະຈຳປີ", daysPerYear: 15, isPaid: true },
    { code: "SICK", name: "ລາປ່ວຍ", daysPerYear: 30, isPaid: true, requiresProof: true },
    { code: "PERSONAL", name: "ລາກິດ", daysPerYear: 3, isPaid: true },
    { code: "MATERNITY", name: "ລາຄອດ", daysPerYear: 105, isPaid: true },
    { code: "UNPAID", name: "ລາບໍ່ຮັບເງິນເດືອນ", daysPerYear: 0, isPaid: false },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({ where: { code: lt.code }, update: {}, create: lt });
  }

  // ─── ຜູ້ໃຊ້ຜູ້ດູແລລະບົບ ───
  const hash = await bcrypt.hash("Odien@2026", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: hash, role: "ADMIN" },
  });

  const emps = await prisma.employee.count();
  const depts = await prisma.department.count();
  console.log(`✅ ສຳເລັດ — ພະນັກງານຈິງ ${emps} ຄົນ, ພະແນກ ${depts}`);
  console.log("   ເຂົ້າລະບົບ: admin / Odien@2026  (ປ່ຽນລະຫັດຜ່ານທັນທີຫຼັງໃຊ້ຄັ້ງທຳອິດ)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
