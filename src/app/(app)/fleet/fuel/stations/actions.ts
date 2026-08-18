"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { scoreRefuelEvents, suggestStationsFromEvents, upsertFuelStation } from "@/lib/fuel-cache";

/** ⛽ ຈຸດເຕີມ (geofence) — HR/ຜູ້ຈັດການ ຕັ້ງຊື່/ລັດສະໝີ; ຫຼັງແກ້ ໃຫ້ຄະແນນເຫດການ 30 ວັນຄືນ */
export async function saveFuelStation(fd: FormData): Promise<void> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  const id = String(fd.get("id") ?? "").trim() || undefined;
  const name = String(fd.get("name") ?? "").trim();
  const lat = Number(fd.get("lat"));
  const lng = Number(fd.get("lng"));
  const radiusM = Math.min(1000, Math.max(30, Number(fd.get("radiusM")) || 150));
  const kind = fd.get("kind") === "COMPANY" ? "COMPANY" : "PUBLIC";
  const active = fd.get("active") !== "off";
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  await upsertFuelStation({ id, name, lat, lng, radiusM, kind, active, by: session.username });
  await scoreRefuelEvents(30);
  revalidatePath("/fleet/fuel/stations");
  revalidatePath("/fleet/fuel");
}

/** ສະເໜີຈຸດເຕີມຈາກ cluster ເຫດການ (≥ 3 ຄັ້ງ / 150 m) */
export async function suggestFuelStations(): Promise<void> {
  const session = await requireRole("ADMIN", "HR", "MANAGER");
  await suggestStationsFromEvents(session.username);
  await scoreRefuelEvents(30);
  revalidatePath("/fleet/fuel/stations");
  revalidatePath("/fleet/fuel");
}

/** ໃຫ້ຄະແນນເຫດການ 30 ວັນຄືນ (ຫຼັງແກ້ຈຸດເຕີມ ຫຼື ບິນມາທີຫຼັງ) */
export async function rescoreRefuels(): Promise<void> {
  await requireRole("ADMIN", "HR", "MANAGER");
  await scoreRefuelEvents(30);
  revalidatePath("/fleet/fuel/stations");
  revalidatePath("/fleet/fuel");
}
