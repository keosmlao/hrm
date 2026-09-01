"use client";

import { useActionState, useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/menu";
import {
  KB_VISIBILITIES,
  KB_VISIBILITY_LABEL,
  formatTags,
  type KbVisibility,
} from "@/lib/knowledge";
import { renderMarkdown } from "@/lib/markdown";
import { createArticle, updateArticle, type KbFormState } from "../actions";

export type ArticleFormValues = {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  categoryId: string | null;
  tags: string[];
  visibility: string;
  visibleDepartments: string[];
  visibleRoles: string[];
  requiresAck: boolean;
  version: number;
};

/**
 * ຟອມຂຽນບົດ — ໃຊ້ທັງສ້າງໃໝ່ ແລະ ແກ້ໄຂ.
 *
 * ບັນນາທິການເປັນ **Markdown ໃນ textarea** ບໍ່ແມ່ນ rich-text:
 * ເບົາ, ບໍ່ຕ້ອງເພີ່ມ dependency, ແລະ ເກັບປະຫວັດ/ປຽບທຽບຮຸ່ນງ່າຍ.
 * ຕົວຢ່າງທີ່ເຫັນຢູ່ແຖບ "ເບິ່ງຕົວຢ່າງ" ໃຊ້ renderer ອັນດຽວກັນກັບໜ້າອ່ານຈິງ.
 */
export function ArticleForm({
  article,
  categories,
  departments,
}: {
  article?: ArticleFormValues;
  categories: { id: string; nameLo: string }[];
  departments: { code: string; nameLo: string }[];
}) {
  const [state, formAction, pending] = useActionState<KbFormState, FormData>(
    article ? updateArticle : createArticle,
    {},
  );

  const [visibility, setVisibility] = useState<KbVisibility>(
    (article?.visibility as KbVisibility) ?? "ALL",
  );
  const [body, setBody] = useState(article?.body ?? "");
  const [preview, setPreview] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {article && <input type="hidden" name="id" value={article.id} />}

      {state.error && (
        <p className="rounded-md bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <Card className="space-y-4">
        <Field label="ຫົວຂໍ້" required>
          <input name="title" defaultValue={article?.title ?? ""} required maxLength={300} className={inputClass} />
        </Field>

        <Field label="ບົດຫຍໍ້" hint="ສະແດງໃນລາຍການ — ຫວ່າງໄວ້ກໍໄດ້ ລະບົບຈະຕັດຈາກເນື້ອໃນໃຫ້">
          <input name="summary" defaultValue={article?.summary ?? ""} maxLength={500} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ໝວດ">
            <select name="categoryId" defaultValue={article?.categoryId ?? ""} className={inputClass}>
              <option value="">— ບໍ່ລະບຸ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameLo}
                </option>
              ))}
            </select>
          </Field>

          <Field label="ແທັກ" hint="ຂັ້ນດ້ວຍຈຸດ ເຊັ່ນ: ນະໂຍບາຍ, ຄວາມປອດໄພ">
            <input
              name="tags"
              defaultValue={article ? formatTags(article.tags) : ""}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">ເນື້ອໃນ (Markdown)</span>
          <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`rounded px-2.5 py-1 ${!preview ? "bg-primary text-white" : ""}`}
            >
              ຂຽນ
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`rounded px-2.5 py-1 ${preview ? "bg-primary text-white" : ""}`}
            >
              ເບິ່ງຕົວຢ່າງ
            </button>
          </div>
        </div>

        {preview ? (
          <div
            className="kb-prose min-h-64 rounded-md border border-border p-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        ) : (
          <textarea
            name="body"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={20}
            className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            placeholder={"# ຫົວຂໍ້ຍ່ອຍ\n\nຂໍ້ຄວາມທຳມະດາ **ຕົວໜາ** *ຕົວອຽງ*\n\n- ລາຍການ\n- ລາຍການ\n\n1. ຂັ້ນຕອນທຳອິດ\n2. ຂັ້ນຕອນທີສອງ"}
          />
        )}
        {preview && <input type="hidden" name="body" value={body} />}
      </Card>

      <Card className="space-y-4">
        <Field label="ໃຜເຫັນໄດ້">
          <select
            name="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as KbVisibility)}
            className={inputClass}
          >
            {KB_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {KB_VISIBILITY_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>

        {visibility === "DEPARTMENT" && (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <label key={d.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="visibleDepartments"
                  value={d.code}
                  defaultChecked={article?.visibleDepartments.includes(d.code)}
                />
                {d.nameLo}
              </label>
            ))}
          </div>
        )}

        {visibility === "ROLE" && (
          <div className="flex flex-wrap gap-4">
            {ROLES.map((r: Role) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="visibleRoles"
                  value={r}
                  defaultChecked={article?.visibleRoles.includes(r)}
                />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresAck"
            defaultChecked={article?.requiresAck}
            className="mt-1"
          />
          <span>
            ບັງຄັບໃຫ້ພະນັກງານກົດ “ຮັບຮູ້”
            <span className="mt-0.5 block text-xs text-muted">
              ການຮັບຮູ້ຜູກກັບເລກຮຸ່ນ — ແກ້ເນື້ອໃນເທື່ອໃໝ່ ທຸກຄົນຕ້ອງກັບມາຮັບຮູ້ຄືນ
            </span>
          </span>
        </label>

        {article && (
          <Field label="ບັນທຶກການປ່ຽນແປງ" hint="ຈະສະແດງໃນປະຫວັດການປັບປຸງ (ສະເພາະເມື່ອເນື້ອໃນປ່ຽນ)">
            <input name="changeNote" maxLength={300} className={inputClass} />
          </Field>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "ກຳລັງບັນທຶກ…" : article ? "ບັນທຶກ" : "ສ້າງບົດ (ເປັນຮ່າງ)"}
        </Button>
        {article && <span className="text-xs text-muted">ຮຸ່ນປັດຈຸບັນ {article.version}</span>}
      </div>
    </form>
  );
}
