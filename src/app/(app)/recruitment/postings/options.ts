import "server-only";
import { prisma } from "@/lib/prisma";

export type PostingOptions = {
  departments: { code: string; name: string }[];
  positions: { code: string; name: string }[];
};

export async function loadPostingOptions(): Promise<PostingOptions> {
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.position.findMany({ orderBy: { code: "asc" } }),
  ]);
  return {
    departments: departments.map((d) => ({
      code: d.code,
      name: `${d.code} — ${d.nameLo}`,
    })),
    positions: positions.map((p) => ({ code: p.code, name: p.nameLo })),
  };
}
