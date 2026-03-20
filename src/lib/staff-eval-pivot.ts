export interface StaffEvalCriteriaRow {
  id: number;
  group_id: number;
  criteria_code: string;
  criteria_name: string;
  group_name: string;
  question_order: number;
  option_id: number;
  option_label: string;
  score: number;
}

interface ScoreValue {
  option_id: number;
  score: number;
}

export interface StaffEvalRow {
  id: number;
  evaluator_code: string;
  target_code: string;
  eval_type: string;
  year: string;
  month: number;
  scores: Record<string, ScoreValue> | null;
  comment: string | null;
  created_at: Date | string | null;
  target_name?: string | null;
}

export interface StaffEvalTeamTargetRow {
  employee_code: string;
  fullname_lo: string;
  position_name_lo?: string | null;
}

export interface SelfPivotRow {
  criteria_code: string;
  criteria_name: string;
  group_name: string;
  question_order: number;
  scores: Record<number, number | null>;
}

export interface TeamPivotRow {
  employee_code: string;
  fullname_lo: string;
  position_name_lo: string | null;
  scores: Record<number, number | null>;
}

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => typeof value === "number");
  if (numeric.length === 0) return null;

  const total = numeric.reduce((sum, value) => sum + value, 0);
  return Math.round((total / numeric.length) * 100) / 100;
}

function extractScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;

  const score = (value as ScoreValue).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function buildUniqueCriteria(criteria: StaffEvalCriteriaRow[]) {
  const byCode = new Map<string, StaffEvalCriteriaRow>();

  for (const item of criteria) {
    if (!byCode.has(item.criteria_code)) {
      byCode.set(item.criteria_code, item);
    }
  }

  return Array.from(byCode.values()).sort((a, b) => a.question_order - b.question_order);
}

export function buildStaffEvalPivotData({
  criteria,
  selfEvals,
  teamEvals,
  teamTargetNames,
}: {
  criteria: StaffEvalCriteriaRow[];
  selfEvals: StaffEvalRow[];
  teamEvals: StaffEvalRow[];
  teamTargetNames?: StaffEvalTeamTargetRow[];
}) {
  const uniqueCriteria = buildUniqueCriteria(criteria);

  const selfPivot: SelfPivotRow[] = uniqueCriteria.map((item) => {
    const scores: Record<number, number | null> = {};

    for (const evalRow of selfEvals) {
      scores[evalRow.month] = extractScore(evalRow.scores?.[item.criteria_code]);
    }

    return {
      criteria_code: item.criteria_code,
      criteria_name: item.criteria_name,
      group_name: item.group_name,
      question_order: item.question_order,
      scores,
    };
  });

  const targetMap = new Map(
    (teamTargetNames || []).map((item) => [
      item.employee_code,
      {
        fullname_lo: item.fullname_lo,
        position_name_lo: item.position_name_lo ?? null,
      },
    ])
  );

  const teamPivotMap = new Map<string, TeamPivotRow>();

  for (const evalRow of teamEvals) {
    const current = teamPivotMap.get(evalRow.target_code);
    const targetInfo = targetMap.get(evalRow.target_code);

    const row =
      current ||
      {
        employee_code: evalRow.target_code,
        fullname_lo: targetInfo?.fullname_lo || evalRow.target_code,
        position_name_lo: targetInfo?.position_name_lo ?? null,
        scores: {},
      };

    row.scores[evalRow.month] = average(
      Object.values(evalRow.scores || {}).map((value) => extractScore(value))
    );

    teamPivotMap.set(evalRow.target_code, row);
  }

  return {
    selfPivot,
    teamPivot: Array.from(teamPivotMap.values()),
  };
}
