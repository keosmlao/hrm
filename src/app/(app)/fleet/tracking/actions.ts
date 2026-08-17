"use server";

import { requireRole } from "@/lib/auth";
import { livePositions, type VehiclePosition } from "@/lib/fleet-live";
import { reverseGeocode } from "@/lib/geocode";

/** ດຶງຕຳແໜ່ງລົດສົດ (ໃຫ້ client ເອີ້ນຊ້ຳເປັນໄລຍະ) */
export async function refreshPositions(): Promise<VehiclePosition[]> {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  return livePositions();
}

/**
 * ແປງພິກັດເປັນທີ່ຢູ່ຈິງ — ເອີ້ນສະເພາະຕອນຜູ້ໃຊ້ກົດເລືອກລົດຄັນໜຶ່ງ
 * ບໍ່ແມ່ນທຸກຄັນທຸກຮອບ (ນະໂຍບາຍ Nominatim: 1 ຄຳຂໍ/ວິນາທີ).
 */
export async function lookupAddress(lat: number, lng: number): Promise<string | null> {
  await requireRole("ADMIN", "HR", "MANAGER", "EXECUTIVE");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return reverseGeocode(lat, lng);
}
