import "server-only";

/**
 * ແປງພິກັດເປັນທີ່ຢູ່ (reverse geocoding) ດ້ວຍ Nominatim ຂອງ OpenStreetMap.
 *
 * ເປັນຫຍັງຕ້ອງມີ: ທີ່ຢູ່ຈາກ Lao GPS ບອກພຽງ ແຂວງ+ເມືອງ ("จ.Vientiane
 * Prefecture เขตXaythany") ເຊິ່ງບອກບໍ່ໄດ້ວ່າລົດຈອດຢູ່ໃສແທ້.
 *
 * ⚠ ນະໂຍບາຍ Nominatim: ສູງສຸດ 1 ຄຳຂໍ/ວິນາທີ ແລະ ຕ້ອງບອກຕົວຕົນຜ່ານ User-Agent.
 * ຈຶ່ງ (1) ເອີ້ນສະເພາະຕອນຜູ້ໃຊ້ກົດເລືອກລົດ ບໍ່ແມ່ນທຸກຄັນທຸກຮອບ polling,
 * (2) ຮຽງຄິວໃຫ້ຫ່າງກັນ ≥1.1 ວິ, (3) cache ໄວ້ໃນໜ່ວຍຄວາມຈຳ.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const UA = "ODIEN-HRM/1.0 (fleet tracking; it@odien.net)";
const MIN_GAP_MS = 1100;
const TTL_MS = 24 * 60 * 60 * 1000;
/** ປັດພິກັດເປັນ 4 ຕຳແໜ່ງ ≈ 11 ແມັດ — ພໍໃຫ້ cache ຕິດເມື່ອລົດຈອດຢູ່ */
const PRECISION = 4;

type Entry = { text: string | null; at: number };
const cache = new Map<string, Entry>();
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ຕໍ່ຄິວໃຫ້ຄຳຂໍຫ່າງກັນຢ່າງໜ້ອຍ MIN_GAP_MS */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.then(() => sleep(MIN_GAP_MS)).catch(() => sleep(MIN_GAP_MS));
  return run;
}

/**
 * ຄືນທີ່ຢູ່ອ່ານໄດ້ຂອງພິກັດ — `null` ຖ້າຫາບໍ່ພົບ ຫຼື ບໍລິການລົ້ມ.
 * ບໍ່ເຄີຍ throw: ໜ້າຕິດຕາມຕ້ອງໃຊ້ໄດ້ຕໍ່ ເຖິງວ່າ geocoder ຈະລົ້ມ.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(PRECISION)},${lng.toFixed(PRECISION)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;

  const text = await enqueue(async () => {
    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "18");
      url.searchParams.set("accept-language", "lo,en");

      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;

      const body = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const a = body.address ?? {};
      // ເອົາສ່ວນທີ່ມີຄວາມໝາຍຕໍ່ຄົນອ່ານ ຈາກລະອຽດ → ກວ້າງ
      const parts = [
        a.amenity ?? a.shop ?? a.building,
        a.road,
        a.neighbourhood ?? a.suburb ?? a.village ?? a.hamlet,
        a.city ?? a.town ?? a.county,
        a.state,
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : (body.display_name ?? null);
    } catch {
      return null;
    }
  });

  cache.set(key, { text, at: Date.now() });
  return text;
}
