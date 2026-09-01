import "server-only";
import { prisma } from "@/lib/prisma";
import { listPositions } from "@/lib/positions";

export type PostingOptions = {
  departments: { code: string; name: string }[];
  positions: { code: string; name: string }[];
};

export async function loadPostingOptions(): Promise<PostingOptions> {
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    listPositions(),
  ]);
  return {
    departments: departments.map((d) => ({
      code: d.code,
      name: `${d.code} — ${d.nameLo}`,
    })),
    positions: positions.map((p) => ({ code: p.code, name: p.nameLo })),
  };
}
