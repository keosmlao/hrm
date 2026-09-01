"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { addAttachment, type KbFormState } from "../../actions";

/**
 * ແນບໄຟລ໌.
 *
 * ໄຟລ໌ຈະຖືກເກັບ**ນອກ** `public/` ແລ້ວເປີດຜ່ານ `/api/kb-file/<id>` ທີ່ກວດ login
 * ແລະ ຂອບເຂດການເຫັນຂອງບົດກ່ອນ — ເບິ່ງ `src/lib/kb-storage.ts`.
 */
export function AttachmentForm({
  articleId,
  accept,
  maxMb,
}: {
  articleId: string;
  accept: string;
  maxMb: number;
}) {
  const [state, formAction, pending] = useActionState<KbFormState, FormData>(addAttachment, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="file" name="file" accept={accept} required className="text-sm" />
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "ກຳລັງອັບໂຫຼດ…" : "ແນບໄຟລ໌"}
      </Button>
      <span className="text-xs text-muted">ສູງສຸດ {maxMb}MB</span>
      {state.error && <p className="w-full text-sm text-rose-700">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
