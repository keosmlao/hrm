import { scryptSync, timingSafeEqual } from "node:crypto";

/**
 * ກວດລະຫັດຜ່ານເດີມໃນ odg_employee.password
 *
 * ໃນ DB ມີ 2 ຮູບແບບ:
 *   1. scrypt ຂອງ Werkzeug/Flask — "scrypt:N:r:p$salt$hexhash"   (18 ບັນຊີ)
 *   2. ຂໍ້ຄວາມລ້ວນ (plaintext)                                   (223 ບັນຊີ ⚠️ ບໍ່ປອດໄພ)
 *
 * ຫຼັງເຂົ້າສຳເລັດ ລະບົບຈະສ້າງ hrm_user ພ້ອມ bcrypt hash ໃຫ້ອັດຕະໂນມັດ
 * ແລ້ວຄັ້ງຕໍ່ໄປຈະບໍ່ແຕະລະຫັດຜ່ານເດີມອີກ (ຕາຕະລາງເກົ່າຍັງຄົງເດີມ ເພາະລະບົບອື່ນໃຊ້ຢູ່)
 */
export function verifyLegacyPassword(input: string, stored: string): boolean {
  if (!stored) return false;

  // ຮູບແບບ Werkzeug: "scrypt:N:r:p$salt$hexhash"
  if (stored.startsWith("scrypt:")) {
    return verifyWerkzeugScrypt(input, stored);
  }

  // ຮູບແບບ ERP ເກົ່າ: "scrypt$base64Salt$base64Key" (ບໍ່ບອກ parameter ໄວ້)
  if (stored.startsWith("scrypt$")) {
    return verifyBareScrypt(input, stored);
  }

  // plaintext — ທຽບແບບ constant-time ເພື່ອກັນ timing attack
  return safeEqual(Buffer.from(input), Buffer.from(stored));
}

function verifyWerkzeugScrypt(input: string, stored: string): boolean {
  try {
    const [method, salt, hexHash] = stored.split("$");
    const [, nStr, rStr, pStr] = method.split(":");
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!N || !r || !p || !salt || !hexHash) return false;

    const derived = scryptSync(input, salt, hexHash.length / 2, {
      N,
      r,
      p,
      maxmem: 132 * N * r, // ຄ່າ default ຂອງ node ນ້ອຍເກີນສຳລັບ N=32768
    });
    return safeEqual(derived, Buffer.from(hexHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * ຮູບແບບ "scrypt$base64Salt$base64Key" ຈາກ ERP ເກົ່າ (16 ບັນຊີ, ລວມທັງ IT).
 * ບໍ່ໄດ້ບັນທຶກ N/r/p ໄວ້ ຈຶ່ງລອງຊຸດ parameter ທີ່ໃຊ້ທົ່ວໄປ.
 * scrypt ບໍ່ຊ້ຳກັນ ດັ່ງນັ້ນລະຫັດຜິດຈະບໍ່ກົງກັບຊຸດໃດເລີຍ (ບໍ່ມີ false-accept).
 */
function verifyBareScrypt(input: string, stored: string): boolean {
  try {
    const [, saltB64, keyB64] = stored.split("$");
    if (!saltB64 || !keyB64) return false;

    const target = Buffer.from(keyB64, "base64");
    const keylen = target.length;
    if (keylen === 0) return false;

    // salt ອາດຖືກສົ່ງເປັນ base64-string ຫຼື ເປັນ raw bytes — ລອງທັງສອງ
    const saltCandidates: Array<Buffer | string> = [
      saltB64,
      Buffer.from(saltB64, "base64"),
    ];
    const Ns = [16384, 32768, 65536];

    for (const salt of saltCandidates) {
      for (const N of Ns) {
        const derived = scryptSync(input, salt, keylen, {
          N,
          r: 8,
          p: 1,
          maxmem: 256 * N * 8,
        });
        if (safeEqual(derived, target)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** ລະຫັດຜ່ານເດີມທີ່ຍັງເປັນ plaintext (ຄວນບັງຄັບໃຫ້ປ່ຽນ) */
export function isPlaintextLegacy(stored: string | null): boolean {
  return !!stored && !stored.startsWith("scrypt:") && !stored.startsWith("$2");
}
