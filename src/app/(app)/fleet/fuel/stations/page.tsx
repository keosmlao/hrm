import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Badge, Button, EmptyRow, PageHeader, Table, Th, inputClass } from "@/components/ui";
import { fuelStations, refuelEventsBetween } from "@/lib/fuel-cache";
import { rescoreRefuels, saveFuelStation, suggestFuelStations } from "./actions";

export const dynamic = "force-dynamic";

/**
 * 📍 ຈຸດເຕີມ (geofence) — ປໍ້າບໍລິສັດ / ປໍ້າສາທາລະນະທີ່ໃຊ້ປະຈຳ
 * ເຫດການເຕີມທີ່ຢູ່ໃນລັດສະໝີ ຈະຖືກໃຫ້ຄະແນນ "ໜ້າຈະແມ່ນ" ອັດຕະໂນມັດ (fuel-cache.ts scoreRefuelEvents)
 * cron ສະເໜີຈຸດໃໝ່ຈາກ cluster ເຫດການ (ຊື່ຂຶ້ນຕົ້ນ "ຈຸດເຕີມ (ສະເໜີ) …") — HR ຕັ້ງຊື່ຈິງຢູ່ນີ້
 */
export default async function FuelStationsPage() {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  const stations = await fuelStations();
  // ເຫດການ 30 ວັນ ນອກຈຸດເຕີມ — ໄວ້ໃຫ້ HR ຕັດສິນເພີ່ມເປັນຈຸດໃໝ່ (copy ພິກັດໄດ້ເລີຍ)
  const now = new Date();
  const outside = (await refuelEventsBetween(new Date(now.getTime() - 30 * 86_400_000), now))
    .filter((e) => e.kind === "REFUEL" && !e.stationId && e.lat != null && e.lng != null)
    .sort((a, b) => b.litre - a.litre)
    .slice(0, 30);

  return (
    <>
      <PageHeader
        title="ຈຸດເຕີມນ້ຳມັນ (geofence)"
        subtitle="ເຫດການເຕີມທີ່ເກີດພາຍໃນລັດສະໝີຈຸດເຕີມ ຈະນັບວ່າ ໜ້າຈະແມ່ນ ອັດຕະໂນມັດ · ຊື່ທີ່ຂຶ້ນຕົ້ນ “ສະເໜີ” ແມ່ນລະບົບສ້າງຈາກ cluster — ກະລຸນາຕັ້ງຊື່ຈິງ"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form action={suggestFuelStations}><Button variant="ghost" type="submit">＋ ສະເໜີຈາກເຫດການ</Button></form>
            <form action={rescoreRefuels}><Button variant="ghost" type="submit">↻ ໃຫ້ຄະແນນຄືນ</Button></form>
            <Link href="/fleet/fuel" className="text-sm text-primary hover:underline">← ລາຍງານນ້ຳມັນ</Link>
          </div>
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>ຊື່ຈຸດເຕີມ</Th>
            <Th>ປະເພດ</Th>
            <Th className="text-right">ພິກັດ</Th>
            <Th className="text-right">ລັດສະໝີ (m)</Th>
            <Th className="text-right">ເຕີມ 30 ວັນ</Th>
            <Th>ໃຊ້ງານ</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {stations.length === 0 && <EmptyRow colSpan={7} text="ຍັງບໍ່ມີຈຸດເຕີມ — ກົດ “ສະເໜີຈາກເຫດການ” ຫຼື ເພີ່ມເອງລຸ່ມນີ້" />}
          {stations.map((s) => (
            <tr key={s.id} className={s.active ? "" : "opacity-50"}>
              <td colSpan={7} className="p-0">
                <form action={saveFuelStation} className="grid items-center gap-2 px-3 py-2 md:grid-cols-[1fr_130px_200px_100px_90px_90px_90px]">
                  <input type="hidden" name="id" value={s.id} />
                  <input name="name" defaultValue={s.name} className={inputClass} />
                  <select name="kind" defaultValue={s.kind} className={inputClass}>
                    <option value="COMPANY">ປໍ້າບໍລິສັດ</option>
                    <option value="PUBLIC">ປໍ້າສາທາລະນະ</option>
                  </select>
                  <div className="flex gap-1">
                    <input name="lat" defaultValue={s.lat} className={`${inputClass} tabular`} />
                    <input name="lng" defaultValue={s.lng} className={`${inputClass} tabular`} />
                  </div>
                  <input name="radiusM" type="number" min={30} max={1000} defaultValue={s.radiusM} className={`${inputClass} tabular text-right`} />
                  <span className="tabular text-right text-sm">{s.events30d}</span>
                  <select name="active" defaultValue={s.active ? "on" : "off"} className={inputClass}>
                    <option value="on">ໃຊ້</option>
                    <option value="off">ປິດ</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Button type="submit">ບັນທຶກ</Button>
                    <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">ແຜນທີ່</a>
                  </div>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">＋ ເພີ່ມຈຸດເຕີມເອງ</h2>
        <form action={saveFuelStation} className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_150px_150px_100px_auto]">
          <input name="name" required placeholder="ຊື່ (ເຊັ່ນ ປໍ້າ PTT ດົງໂດກ)" className={inputClass} />
          <select name="kind" defaultValue="PUBLIC" className={inputClass}>
            <option value="COMPANY">ປໍ້າບໍລິສັດ</option>
            <option value="PUBLIC">ປໍ້າສາທາລະນະ</option>
          </select>
          <input name="lat" required placeholder="lat 17.97…" className={inputClass} />
          <input name="lng" required placeholder="lng 102.63…" className={inputClass} />
          <input name="radiusM" type="number" defaultValue={150} min={30} max={1000} className={`${inputClass} tabular`} />
          <Button type="submit">ເພີ່ມ</Button>
        </form>
      </div>

      {outside.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">🟡 ເຕີມນອກຈຸດເຕີມທີ່ຮູ້ຈັກ (30 ວັນ · {outside.length} ຄັ້ງ)</h2>
          <p className="mt-1 text-xs text-muted">ຖ້າແມ່ນປໍ້າທີ່ໃຊ້ປະຈຳ ໃຫ້ copy ພິກັດ ໄປເພີ່ມເປັນຈຸດເຕີມ — ຄັ້ງຕໍ່ໄປຈະນັບອັດຕະໂນມັດ</p>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {outside.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {new Date(e.time).toLocaleString("en-GB", { timeZone: "Asia/Vientiane", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} · ≈{e.litre} ລ ·{" "}
                  <span className="text-muted">{e.address ?? ""}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5">{e.lat!.toFixed(5)}, {e.lng!.toFixed(5)}</code>
                  <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">ແຜນທີ່</a>
                  <Badge tone={(e.confidence ?? "CHECK") === "LIKELY" ? "green" : "amber"}>{e.confidence ?? "CHECK"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
