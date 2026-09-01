"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { createCategory, type KbFormState } from "../actions";

/** ເພີ່ມໝວດ — ລຶບໝວດແມ່ນຟອມທຳມະດາໃນໜ້າ (ບົດບໍ່ຫາຍ, FK ເປັນ SET NULL) */
export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState<KbFormState, FormData>(createCategory, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="min-w-48 flex-1">
        <span className="mb-1.5 block text-sm font-medium">ຊື່ໝວດໃໝ່</span>
        <input name="nameLo" required maxLength={200} className={inputClass} placeholder="ເຊັ່ນ: ນະໂຍບາຍບຸກຄະລາກອນ" />
      </label>
      <label className="w-24">
        <span className="mb-1.5 block text-sm font-medium">ລຳດັບ</span>
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={0} className={inputClass} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "ເພີ່ມ"}
      </Button>
      {state.error && <p className="w-full text-sm text-rose-700">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
