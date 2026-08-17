"use client";

import { useCallback, useEffect, useState } from "react";
import { EmployeeApp, type Me, clockError } from "@/components/employee-app";
import { employeeLogout } from "./actions";

/** Portal ພະນັກງານ (web) — login ດ້ວຍ session, ໃຊ້ UI ດຽວກັນກັບ LINE mini-app */
export default function EmployeePortalPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/attendance/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 401) {
      window.location.href = "/employee/login";
      return;
    }
    if (!res.ok) throw new Error("ດຶງຂໍ້ມູນບໍ່ໄດ້ — ລອງໃໝ່");
    setMe((await res.json()) as Me);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "ເກີດຂໍ້ຜິດພາດ");
      } finally {
        setBooting(false);
      }
    })();
  }, [refresh]);

  const clock = useCallback(
    async (action: "IN" | "OUT") => {
      setBusy(true);
      setError(null);
      try {
        const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
          if (!navigator.geolocation) return resolve({});
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({}),
            { timeout: 5000 },
          );
        });
        const res = await fetch("/api/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...coords }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(clockError(data.error));
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "ບັນທຶກບໍ່ໄດ້");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {booting && <p className="p-6 text-center text-sm text-slate-500">ກຳລັງໂຫຼດ...</p>}

      {error && (
        <p className="mx-auto mt-4 max-w-md rounded-lg bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
          {error}
        </p>
      )}

      {me?.linked === false && (
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-4 text-sm text-slate-600">ບັນຊີນີ້ຍັງບໍ່ໄດ້ຜູກກັບພະນັກງານ</p>
          <button onClick={() => employeeLogout()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
            ອອກຈາກລະບົບ
          </button>
        </div>
      )}

      {me?.linked === true && (
        <EmployeeApp
          me={me}
          busy={busy}
          onClock={clock}
          onChanged={refresh}
          onLogout={() => employeeLogout()}
        />
      )}
    </div>
  );
}
