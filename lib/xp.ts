export const XP_PER_TOPIC = 15;
export const XP_PER_DAY_BONUS = 10;

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let remain = xp;
  let need = 120;
  while (remain >= need) {
    remain -= need;
    level += 1;
    need = Math.round(need * 1.11);
  }
  return { level, into: remain, need };
}

export function rankForLevel(level: number): string {
  const ranks: Array<[number, string]> = [
    [1, "Recruit"],
    [4, "Operator"],
    [8, "Specialist"],
    [13, "Engineer II"],
    [19, "Senior Engineer"],
    [26, "Staff Candidate"],
    [34, "Staff Engineer"],
    [43, "Principal Track"],
    [53, "Distinguished Track"],
    [65, "Architect"],
  ];
  let r = ranks[0][1];
  for (const [lvl, name] of ranks) {
    if (level >= lvl) r = name;
  }
  return r;
}
