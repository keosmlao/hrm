import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth";
import { Badge, Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";
import { CycleForm } from "./cycle-form";

export const dynamic = "force-dynamic";

const GRADE_TONE: Record<string, "green" | "blue" | "amber" | "gray" | "red"> = {
  A: "green",
  B: "blue",
  C: "amber",
  D: "gray",
  E: "red",
};

// ຖ້າຍັງບໍ່ໄດ້ deploy migration → ຄືນ array ວ່າງ
const ifMissing = (e: { code?: string }) => {
  if (e?.code === "P2021") return [];
  throw e;
};

export default async function AppraisalPage() {
  const session = await requireUser();
  const isHR = hasRole(session, "ADMIN", "HR");
  const now = new Date();

  const [cycles, myTodo, myResults] = await Promise.all([
    isHR
      ? prisma.appraisalCycle
          .findMany({
            orderBy: [{ year: "desc" }, { createdAt: "desc" }],
            include: { _count: { select: { appraisals: true } } },
          })
          .catch(ifMissing)
      : Promise.resolve([]),
    session.employeeCode
      ? prisma.appraisal
          .findMany({
            where: { evaluatorCode: session.employeeCode, status: "PENDING" },
            include: { employee: true, cycle: true },
          })
          .catch(ifMissing)
      : Promise.resolve([]),
    session.employeeCode
      ? prisma.appraisal
          .findMany({
            where: { employeeCode: session.employeeCode },
            include: { cycle: true },
            orderBy: { createdAt: "desc" },
          })
          .catch(ifMissing)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="ປະເມີນຜົນງານ" subtitle="ຮອບປະເມີນ · ຄະແນນ 1–100 · ເກຣດ A–E" />

      {isHR && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">ສ້າງຮອບປະເມີນໃໝ່</h2>
          <CycleForm year={now.getUTCFullYear()} />
        </Card>
      )}

      {isHR && (
        <div className="mb-8">
          <h2 className="mb-3 font-semibold">ຮອບປະເມີນ</h2>
          <Table>
            <thead>
              <tr>
                <Th>ຮອບ</Th>
                <Th className="text-center">ໃບປະເມີນ</Th>
                <Th>ສະຖານະ</Th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 && <EmptyRow colSpan={3} text="ຍັງບໍ່ມີຮອບ" />}
              {cycles.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/appraisal/${c.id}`} className="text-primary hover:underline">
                      {c.name} ({c.year})
                    </Link>
                  </Td>
                  <Td className="text-center tabular">{c._count.appraisals}</Td>
                  <Td>
                    <Badge tone={c.isOpen ? "green" : "gray"}>
                      {c.isOpen ? "ເປີດ" : "ປິດ"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {myTodo.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-semibold">ຂ້ອຍຕ້ອງປະເມີນ ({myTodo.length})</h2>
          <Table>
            <thead>
              <tr>
                <Th>ພະນັກງານ</Th>
                <Th>ຮອບ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {myTodo.map((a) => (
                <tr key={a.id}>
                  <Td>{a.employee.fullnameLo}</Td>
                  <Td className="text-xs">{a.cycle.name}</Td>
                  <Td>
                    <Link href={`/appraisal/eval/${a.id}`} className="text-primary hover:underline">
                      ປະເມີນ →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <h2 className="mb-3 font-semibold">ຜົນປະເມີນຂອງຂ້ອຍ</h2>
      <Table>
        <thead>
          <tr>
            <Th>ຮອບ</Th>
            <Th className="text-center">ຄະແນນ</Th>
            <Th className="text-center">ເກຣດ</Th>
            <Th>ສະຖານະ</Th>
          </tr>
        </thead>
        <tbody>
          {myResults.length === 0 && <EmptyRow colSpan={4} text="ຍັງບໍ່ມີຜົນປະເມີນ" />}
          {myResults.map((a) => (
            <tr key={a.id}>
              <Td>
                <Link href={`/appraisal/eval/${a.id}`} className="text-primary hover:underline">
                  {a.cycle.name} ({a.cycle.year})
                </Link>
              </Td>
              <Td className="text-center tabular">{a.score ?? "-"}</Td>
              <Td className="text-center">
                {a.grade ? <Badge tone={GRADE_TONE[a.grade] ?? "gray"}>{a.grade}</Badge> : "-"}
              </Td>
              <Td>
                <Badge tone={a.status === "COMPLETED" ? "green" : "amber"}>
                  {a.status === "COMPLETED" ? "ປະເມີນແລ້ວ" : "ລໍຖ້າ"}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
