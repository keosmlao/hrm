import type { RefuelRow } from "@/lib/fuel-cache";

/** ປ້າຍຄວາມໝັ້ນໃຈ ຂອງເຫດການເຕີມ/ຫຼຸດ — ໃຊ້ຮ່ວມ ລາຍງານນ້ຳມັນ ແລະ ໜ້າ Trip */
export const CONFIDENCE_LABEL: Record<string, { text: string; cls: string }> = {
  CONFIRMED: { text: "✅ ຢືນຢັນແລ້ວ", cls: "bg-emerald-50 text-emerald-700" },
  LIKELY: { text: "🟢 ໜ້າຈະແມ່ນ", cls: "bg-teal-50 text-teal-700" },
  CHECK: { text: "🟡 ກວດ", cls: "bg-amber-50 text-amber-700" },
  REJECTED: { text: "❌ ບໍ່ແມ່ນການເຕີມ", cls: "bg-slate-100 text-slate-500 line-through" },
};

export function RefuelBadge({ e }: { e: Pick<RefuelRow, "kind" | "confidence" | "checks" | "stationName" | "receiptExpenseId" | "confirmStatus" | "confirmedBy"> }) {
  if (e.kind === "DROP") {
    return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">🩸 ນ້ຳມັນຫຼຸດຂະນະຈອດ — ກວດ</span>;
  }
  const c = CONFIDENCE_LABEL[e.confidence ?? "CHECK"] ?? CONFIDENCE_LABEL.CHECK;
  const why: string[] = [];
  if (e.stationName) why.push(`📍 ${e.stationName}`);
  else if (e.checks && !e.checks.station) why.push("ນອກຈຸດເຕີມທີ່ຮູ້ຈັກ");
  if (e.checks?.receipt) why.push("🧾 ມີບິນ");
  if (e.confirmStatus === "CONFIRMED") why.push(`👤 ${e.confirmedBy ?? "ຄົນຂັບ"} ຢືນຢັນ`);
  if (e.confirmStatus === "REJECTED") why.push(`👤 ${e.confirmedBy ?? "ຄົນຂັບ"} ບອກບໍ່ແມ່ນ`);
  if (e.checks && !e.checks.litreOk) why.push("ລິດເກີນບ່ອນວ່າງໃນຖັງ");
  if (e.checks && !e.checks.rateOk) why.push("ເຕີມໄວຜິດປົກກະຕິ");
  if (e.checks && !e.checks.sizeOk) why.push("ນ້ອຍກວ່າ 8 L");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>{c.text}</span>
      {why.length > 0 && <span className="text-[11px] text-muted">{why.join(" · ")}</span>}
    </span>
  );
}
