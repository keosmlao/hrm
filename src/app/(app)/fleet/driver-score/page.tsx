import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Badge, EmptyRow, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import {
  laoGpsConfigured,
  laoGpsErrorMessage,
  listDriverBehaviour,
  type LaoGpsDriverBehaviour,
} from "@/lib/laogps";
import { gpsVehicleOptions, hours, num, resolveRange } from "@/lib/fleet-gps";
import { GpsFilter, GpsNotConfigured, GpsNotice } from "../gps-filter";

export const dynamic = "force-dynamic";

/** ຊ່ວງສູງສຸດຂອງ /driver-behaviour */
const MAX_DAYS = 31;

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 90) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

function badgeTone(score: number): "green" | "amber" | "red" {
  return score >= 90 ? "green" : score >= 70 ? "amber" : "red";
}

export default async function DriverScorePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const q = await searchParams;
  const { from, to, note } = resolveRange(q.from, q.to, MAX_DAYS, 7);

  const header = (
    <PageHeader
      title="ຄະແນນການຂັບຂີ່"
      subtitle="ຄະແນນຄວາມປອດໄພ ແລະ ປະຢັດນ້ຳມັນ ຈາກ GPS · ຄິດເປັນ “ຕໍ່ລົດ” ບໍ່ແມ່ນຕໍ່ຄົນຂັບ"
    />
  );

  if (!laoGpsConfigured()) return <>{header}<GpsNotConfigured /></>;

  let rows: LaoGpsDriverBehaviour[] | null = null;
  let error: string | null = null;
  try {
    rows = await listDriverBehaviour({ from, to });
  } catch (e) {
    error = laoGpsErrorMessage(e);
  }

  const hrmImei = new Set((await gpsVehicleOptions()).map((v) => v.imei));
  const scored = rows ?? [];
  const avgSafety = scored.length ? scored.reduce((a, r) => a + r.safety_score, 0) / scored.length : 0;
  const avgEco = scored.length ? scored.reduce((a, r) => a + r.eco_score, 0) / scored.length : 0;
  const overspeed = scored.reduce((a, r) => a + r.overspeed_count, 0);
  const longIdle = scored.reduce((a, r) => a + r.long_idle_hours, 0);

  return (
    <>
      {header}
      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
        ℹ️ ໜ້ານີ້ຖືກ<b>ລວມເຂົ້າ</b> “ສະຫຼຸບ GPS ປະຈຳເດືອນ” ແລ້ວ (ມີຄະແນນ, ເກີນຄວາມໄວ, ກ້ອງແຈ້ງ, ຈອດຕິດເຄື່ອງ ຄົບ ພ້ອມ CSV/ພິມ ແລະ ແຍກຕາມພະແນກ) —{" "}
        <Link href="/fleet/gps-summary?sort=safety" className="font-semibold underline">ໄປໜ້າໃໝ່ (ຮຽງຄະແນນຕ່ຳສຸດກ່ອນ) →</Link>
        <span className="block text-[11px] text-sky-800/80">ໜ້ານີ້ຄົງໄວ້ໃຫ້ລິງເກົ່າໃຊ້ໄດ້ ແລະ ເມື່ອຢາກເລືອກຊ່ວງວັນເອງ (ບໍ່ແມ່ນລາຍເດືອນ)</span>
      </div>
      <GpsFilter action="/fleet/driver-score" from={from} to={to} maxDays={MAX_DAYS} note={note} />

      {error && <GpsNotice title="ດຶງຄະແນນການຂັບຂີ່ບໍ່ໄດ້" detail={error} />}

      {rows && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="ຄະແນນຄວາມປອດໄພສະເລ່ຍ" value={num(avgSafety, 0)} tone={scoreTone(avgSafety)} />
            <StatCard label="ຄະແນນປະຢັດນ້ຳມັນສະເລ່ຍ" value={num(avgEco, 0)} tone={scoreTone(avgEco)} />
            <StatCard
              label="ຂັບເກີນກຳນົດ"
              value={`${overspeed} ຄັ້ງ`}
              tone={overspeed > 0 ? "warn" : "good"}
              hint="ນັບຕໍ່ຊ່ວງທີ່ເກີນຕໍ່ເນື່ອງ ບໍ່ແມ່ນຕໍ່ຈຸດ"
            />
            <StatCard
              label="ຈອດຕິດເຄື່ອງດົນ"
              value={hours(longIdle)}
              tone={longIdle > 0 ? "warn" : "good"}
              hint="ຈອດຕິດຕາມໄຟແດງບໍ່ຖືກຫັກຄະແນນ"
            />
          </div>

          <Table>
            <thead>
              <tr>
                <Th>ລົດ</Th>
                <Th className="text-right">ຄວາມປອດໄພ</Th>
                <Th className="text-right">ປະຢັດນ້ຳມັນ</Th>
                <Th className="text-right">ເກີນຄວາມໄວ</Th>
                <Th className="text-right">ກ້ອງແຈ້ງເຕືອນ</Th>
                <Th className="text-right">ຈອດຕິດເຄື່ອງດົນ</Th>
                <Th className="text-right">ໄລຍະທາງ</Th>
                <Th className="text-right">ຖ້ຽວ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={8} text="ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້" />}
              {[...rows]
                .sort((a, b) => a.safety_score - b.safety_score)
                .map((r) => (
                  <tr key={r.imei}>
                    <Td className="font-medium">
                      {r.plate ?? r.name ?? r.imei}
                      {!hrmImei.has(r.imei.trim()) && (
                        <span className="ml-2 text-xs font-normal text-muted">(ບໍ່ຢູ່ໃນ HRM)</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Badge tone={badgeTone(r.safety_score)}>{r.safety_score}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Badge tone={badgeTone(r.eco_score)}>{r.eco_score}</Badge>
                    </Td>
                    <Td className="text-right tabular">{r.overspeed_count}</Td>
                    <Td className="text-right tabular">
                      {r.has_camera ? r.dashcam_event_count : <span className="text-xs text-muted">ບໍ່ມີກ້ອງ</span>}
                    </Td>
                    <Td className="text-right tabular">{hours(r.long_idle_hours)}</Td>
                    <Td className="text-right tabular">{num(r.distance_km)} ກມ</Td>
                    <Td className="text-right tabular">{r.trips}</Td>
                  </tr>
                ))}
            </tbody>
          </Table>

          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted">
            <p className="mb-1 font-semibold text-foreground">ວິທີຄິດຄະແນນ</p>
            <p>ຄວາມປອດໄພ = 100 − 2 × (ຂັບເກີນຄວາມໄວ + ເຫດການຈາກກ້ອງ)</p>
            <p>ປະຢັດນ້ຳມັນ = 100 − 2 × ຂັບເກີນຄວາມໄວ − 5 × ນ້ຳມັນທີ່ເສຍຈາກຈອດຕິດເຄື່ອງດົນ (ລິດ)</p>
            <p className="mt-2">
              ລົດທີ່ບໍ່ມີກ້ອງຖືກຄິດຈາກການຂັບເກີນຄວາມໄວຢ່າງດຽວ ຈຶ່ງບໍ່ຄວນເອົາໄປທຽບກັບລົດທີ່ມີກ້ອງໂດຍກົງ.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
