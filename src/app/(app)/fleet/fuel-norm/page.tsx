import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, PageHeader, StatCard, Table, Td, Th, inputClass } from "@/components/ui";
import { fleetFuelNorms, num, recentMonths } from "@/lib/fleet-gps";
import { laoGpsConfigured } from "@/lib/laogps";
import { GpsNotConfigured } from "../gps-filter";

export const dynamic = "force-dynamic";

/** ຝ່າຍຂາຍ — ຄ່າເລີ່ມຕົ້ນ (ລົດໜ້ອຍ ດຶງໄວ) */
const DEFAULT_DIVISION = "200";
/** ຕ້ອງມີຢ່າງໜ້ອຍເທົ່ານີ້ວັນ ຈຶ່ງຖືວ່າມາດຕະຖານເຊື່ອຖືໄດ້ */
const MIN_DAYS = 10;

export default async function FuelNormPage({
  searchParams,
}: {
  searchParams: Promise<{ div?: string; months?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const divisionCode = q.div ?? DEFAULT_DIVISION;
  const monthCount = Math.min(6, Math.max(1, Number(q.months) || 3));

  const header = (
    <PageHeader
      title="ມາດຕະຖານການກິນນ້ຳມັນ"
      subtitle="ຄິດ ກມ/ລິດ ຂອງແຕ່ລະຄັນ ຈາກການວັດຈິງລາຍວັນຍ້ອນຫຼັງ"
    />
  );
  if (!laoGpsConfigured()) return <>{header}<GpsNotConfigured /></>;

  const [divisions, departments] = await Promise.all([
    prisma.division.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { code: true, nameLo: true } }),
    prisma.department.findMany({ select: { code: true, divisionCode: true } }),
  ]);
  const deptCodes = departments.filter((d) => d.divisionCode === divisionCode).map((d) => d.code);

  const vehicles = await prisma.carVehicle.findMany({
    where: {
      status: { not: "retired" },
      gpsImei: { not: null },
      ...(divisionCode ? { departmentCode: { in: deptCodes } } : {}),
    },
    select: { id: true, plateNo: true, name: true, gpsImei: true },
    orderBy: { plateNo: "asc" },
  });

  const months = recentMonths(monthCount);
  const norms = await fleetFuelNorms(
    vehicles.map((v) => v.gpsImei!.trim()),
    months,
  );

  const rows = vehicles
    .map((v) => ({ v, n: norms.get(v.gpsImei!.trim()) }))
    .filter((r) => r.n);

  // ຄ່າສະເລ່ຍກອງ — ນັບສະເພາະລົດ sensor ທີ່ຂໍ້ມູນພຽງພໍ
  const solid = rows.filter((r) => r.n!.method === "sensor" && r.n!.days >= MIN_DAYS);
  const fleetKm = solid.reduce((s, r) => s + r.n!.totalKm, 0);
  const fleetL = solid.reduce((s, r) => s + r.n!.totalLitre, 0);
  const fleetNorm = fleetL > 0 ? fleetKm / fleetL : null;
  const divisionName = divisions.find((d) => d.code === divisionCode)?.nameLo ?? "ທຸກຝ່າຍ";

  return (
    <>
      {header}

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ຝ່າຍ</span>
          <select name="div" defaultValue={divisionCode} className={`${inputClass} min-w-52`}>
            <option value="">ທຸກຝ່າຍ</option>
            {divisions.map((d) => (
              <option key={d.code} value={d.code}>{d.nameLo}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ໃຊ້ຂໍ້ມູນຍ້ອນຫຼັງ</span>
          <select name="months" defaultValue={String(monthCount)} className={inputClass}>
            {[1, 2, 3, 6].map((m) => (
              <option key={m} value={m}>{m} ເດືອນ</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#5d3e55]"
        >
          ຄິດໃໝ່
        </button>
        <span className="ml-auto text-xs text-muted">
          ດຶງ {vehicles.length} ຄັນ × {monthCount} ເດືອນ = {vehicles.length * monthCount} ຄຳຂໍ
        </span>
      </form>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ລົດທີ່ຄິດໄດ້" value={`${solid.length}/${vehicles.length}`} hint={divisionName} />
        <StatCard
          label="ມາດຕະຖານກອງ"
          value={fleetNorm != null ? `${num(fleetNorm, 2)} ກມ/ລ` : "—"}
          hint={`Σ${num(fleetKm, 0)} ກມ ÷ Σ${num(fleetL, 0)} ລິດ`}
        />
        <StatCard
          label="ກິນນ້ຳມັນໜ້ອຍສຸດ"
          value={solid.length ? `${num(Math.max(...solid.map((r) => r.n!.kmPerLitre!)), 2)} ກມ/ລ` : "—"}
          tone="good"
        />
        <StatCard
          label="ກິນນ້ຳມັນຫຼາຍສຸດ"
          value={solid.length ? `${num(Math.min(...solid.map((r) => r.n!.kmPerLitre!)), 2)} ກມ/ລ` : "—"}
          tone="bad"
        />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>ລົດ</Th>
            <Th className="text-right">ມາດຕະຖານ (ກມ/ລ)</Th>
            <Th className="text-right">ມັດທະຍົມລາຍວັນ</Th>
            <Th className="text-right">ຊ່ວງປົກກະຕິ</Th>
            <Th className="text-right">ວັນທີ່ໃຊ້ຄິດ</Th>
            <Th className="text-right">ໄລຍະທາງ / ນ້ຳມັນ</Th>
            <Th>ຄວາມເຊື່ອຖື</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7} text="ບໍ່ມີລົດໃນຝ່າຍນີ້ ຫຼື ດຶງຂໍ້ມູນບໍ່ໄດ້" />}
          {rows
            .sort((a, b) => (b.n!.kmPerLitre ?? -1) - (a.n!.kmPerLitre ?? -1))
            .map(({ v, n }) => {
              const measured = n!.method === "sensor";
              const enough = n!.days >= MIN_DAYS;
              return (
                <tr key={v.id.toString()}>
                  <Td className="font-medium">
                    {v.plateNo}
                    <span className="block text-xs font-normal text-muted">{v.name}</span>
                  </Td>
                  <Td className="text-right tabular text-base font-bold">
                    {measured && enough && n!.kmPerLitre != null ? num(n!.kmPerLitre, 2) : <span className="text-muted">—</span>}
                  </Td>
                  <Td className="text-right tabular">{measured ? num(n!.median, 2) : "—"}</Td>
                  <Td className="text-right tabular text-xs text-muted">
                    {measured && n!.p25 != null ? `${num(n!.p25, 1)} – ${num(n!.p75, 1)}` : "—"}
                  </Td>
                  <Td className="text-right tabular">{n!.days}</Td>
                  <Td className="text-right tabular text-xs text-muted">
                    {num(n!.totalKm, 0)} ກມ / {num(n!.totalLitre, 1)} ລ
                  </Td>
                  <Td className="text-xs">
                    {!measured ? (
                      <>
                        <Badge tone="gray">ບໍ່ແມ່ນການວັດ</Badge>
                        <span className="mt-1 block text-muted">
                          ລົດແບບອັດຕາ — ຕັ້ງໄວ້ {n!.configuredKmPerLitre ?? "—"} ກມ/ລ
                        </span>
                      </>
                    ) : !enough ? (
                      <>
                        <Badge tone="amber">ຂໍ້ມູນໜ້ອຍ</Badge>
                        <span className="mt-1 block text-muted">ຕ້ອງການຢ່າງໜ້ອຍ {MIN_DAYS} ວັນ</span>
                      </>
                    ) : (
                      <Badge tone="green">ວັດຈາກເຊັນເຊີຖັງ</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
        </tbody>
      </Table>

      <div className="mt-3 rounded-lg border border-border bg-card p-4 text-xs text-muted">
        <p className="mb-1 font-semibold text-foreground">ວິທີຄິດ ແລະ ຂໍ້ຄວນລະວັງ</p>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>ມາດຕະຖານ</strong> = Σໄລຍະທາງ ÷ Σນ້ຳມັນ ຂອງທຸກວັນທີ່ໃຊ້ຄິດໄດ້ (ຖ່ວງນ້ຳໜັກຕາມໄລຍະທາງ)</li>
          <li><strong>ມັດທະຍົມລາຍວັນ</strong> ທົນຕໍ່ວັນທີ່ຜິດປົກກະຕິ — ຖ້າຫ່າງຈາກມາດຕະຖານຫຼາຍ ແປວ່າມີວັນທີ່ຂໍ້ມູນແປກປົນ</li>
          <li>ຄັດວັນທີ່ແລ່ນໜ້ອຍກວ່າ 5 ກມ ອອກ — ໄລຍະສັ້ນເກີນໄປຈົນອັດຕາບໍ່ມີຄວາມໝາຍ</li>
          <li>
            <strong>ລົດແບບອັດຕາ (rate) ຄິດມາດຕະຖານບໍ່ໄດ້</strong> — ລະບົບ GPS ຄິດນ້ຳມັນ
            ຈາກອັດຕາທີ່ຕັ້ງໄວ້ຢູ່ແລ້ວ ການເອົາມາຄິດ ກມ/ລິດ ຄືນຈຶ່ງເປັນການວົນຊ້ຳ
          </li>
        </ul>
      </div>
    </>
  );
}
