/** ເກຣດຈາກຄະແນນ 0–100 */
export function gradeOf(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

export const GRADE_TONE: Record<string, "green" | "blue" | "amber" | "gray" | "red"> = {
  A: "green",
  B: "blue",
  C: "amber",
  D: "gray",
  E: "red",
};
