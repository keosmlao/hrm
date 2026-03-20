import { NextResponse } from "next/server";
import pool from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import { jsonError } from "@/lib/server/http";

const TRAINING_PRIORITY_MAX = 16;
const TRAINING_POSITION_LABELS: Record<string, string> = {
  "11": "ຜູ້ຈັດການ",
  "12": "ຫົວໜ້າໜ່ວຍງານ",
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  try {
    let employee: {
      employee_code: string;
      position_code: string | null;
      division_code: string | null;
    } | null = null;

    if (session.employee) {
      employee = {
        employee_code: session.employee.employeeCode,
        position_code: session.employee.positionCode,
        division_code: session.employee.divisionCode ?? null,
      };
    } else {
      const { rows } = await pool.query(
        `SELECT employee_code, position_code, division_code
         FROM odg_employee
         WHERE line_id = $1
         LIMIT 1`,
        [session.lineUserId]
      );
      employee = rows[0] || null;
    }

    const isSurveyor = !!employee && ["11", "12"].includes(employee.position_code ?? "");
    let hasSubmitted = false;
    if (employee) {
      const { rows } = await pool.query(
        "SELECT id FROM odg_training_survey WHERE employee_code = $1 LIMIT 1",
        [employee.employee_code]
      );
      hasSubmitted = rows.length > 0;
    }

    let summary = null;
    if (isSurveyor) {
      const [participantsRes, allSurveysRes] = await Promise.all([
        pool.query(
          `SELECT e.employee_code, e.position_code, e.title_lo, e.fullname_lo, d.department_name_lo, p.position_name_lo,
                  EXISTS (SELECT 1 FROM odg_training_survey ts WHERE ts.employee_code = e.employee_code) AS has_submitted
           FROM odg_employee e
           LEFT JOIN odg_department d ON d.department_code = e.department_code
           LEFT JOIN odg_position p ON p.position_code = e.position_code
           WHERE e.position_code IN ('11', '12')
           ORDER BY e.position_code ASC, e.fullname_lo ASC, e.employee_code ASC`
        ),
        pool.query(
          `SELECT ts.skill_priorities, ts.team_problems, ts.suggested_course
           FROM odg_training_survey ts
           INNER JOIN odg_employee e ON e.employee_code = ts.employee_code
           WHERE e.position_code IN ('11', '12')`
        ),
      ]);

      const participantGroupsMap = Object.fromEntries(
        Object.entries(TRAINING_POSITION_LABELS).map(([positionCode, label]) => [
          positionCode,
          {
            positionCode,
            label,
            total: 0,
            submitted: 0,
            remaining: 0,
            submittedPeople: [] as Array<{
              employeeCode: string;
              displayName: string;
              departmentName: string | null;
            }>,
            remainingPeople: [] as Array<{
              employeeCode: string;
              displayName: string;
              departmentName: string | null;
            }>,
          },
        ])
      );

      for (const row of participantsRes.rows) {
        const positionCode = String(row.position_code ?? "");
        const group = participantGroupsMap[positionCode];
        if (!group) continue;

        if (row.position_name_lo) group.label = row.position_name_lo;

        const displayName = `${row.title_lo ? `${row.title_lo} ` : ""}${row.fullname_lo || row.employee_code}`.trim();
        const person = {
          employeeCode: row.employee_code,
          displayName,
          departmentName: row.department_name_lo ?? null,
        };

        group.total += 1;
        if (row.has_submitted) {
          group.submitted += 1;
          group.submittedPeople.push(person);
        } else {
          group.remaining += 1;
          group.remainingPeople.push(person);
        }
      }

      const participantGroups = Object.values(participantGroupsMap).sort((a, b) =>
        a.positionCode.localeCompare(b.positionCode)
      );
      const targetCount = participantGroups.reduce((sum, group) => sum + group.total, 0);
      const submittedCount = participantGroups.reduce((sum, group) => sum + group.submitted, 0);
      const allSurveys = allSurveysRes.rows;

      const skillStats: Record<
        string,
        { totalPriority: number; count: number; priorityCounts: number[] }
      > = {};
      const teamProblems: string[] = [];
      const suggestedCourses: string[] = [];

      for (const row of allSurveys) {
        const priorities = (row.skill_priorities as Record<string, unknown>) || {};
        for (const [key, value] of Object.entries(priorities)) {
          if (key.includes("_topic")) continue;
          const numericValue = Number(value);
          if (
            !Number.isInteger(numericValue) ||
            numericValue < 1 ||
            numericValue > TRAINING_PRIORITY_MAX
          ) {
            continue;
          }
          if (!skillStats[key]) {
            skillStats[key] = {
              totalPriority: 0,
              count: 0,
              priorityCounts: Array.from(
                { length: TRAINING_PRIORITY_MAX + 1 },
                () => 0
              ),
            };
          }
          skillStats[key].totalPriority += numericValue;
          skillStats[key].count += 1;
          skillStats[key].priorityCounts[numericValue] += 1;
        }

        if ((row.team_problems as string | null)?.trim()) {
          teamProblems.push((row.team_problems as string).trim());
        }
        if ((row.suggested_course as string | null)?.trim()) {
          suggestedCourses.push((row.suggested_course as string).trim());
        }
      }

      const ranked = Object.entries(skillStats)
        .map(([id, stats]) => ({
          id,
          voteCount: stats.count,
          avgPriority: stats.totalPriority / stats.count,
          priorityCounts: stats.priorityCounts,
        }))
        .sort((a, b) => {
          for (let priority = 1; priority <= TRAINING_PRIORITY_MAX; priority += 1) {
            const diff = (b.priorityCounts[priority] ?? 0) - (a.priorityCounts[priority] ?? 0);
            if (diff !== 0) return diff;
          }
          return a.avgPriority - b.avgPriority;
        });

      summary = {
        totalTarget: targetCount,
        totalSubmitted: submittedCount,
        totalRemaining: targetCount - submittedCount,
        participantGroups,
        ranked,
        teamProblems,
        suggestedCourses,
      };
    }

    return NextResponse.json({ isSurveyor, hasSubmitted, summary });
  } catch (err) {
    console.error("Failed to fetch training need page data:", err);
    return jsonError("Failed to fetch data", 500);
  }
}
