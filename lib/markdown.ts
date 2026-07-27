import { seedBuiltinPlans } from "@/data/builtinPlans";
import { relativeDue } from "@/lib/srs";
import { formatLearnedDate, sortedLearnedDays } from "@/lib/learned";
import type {
  LearnedMap,
  NotesMap,
  PlansState,
  ProgressMap,
  RefsMap,
  SrsMap,
} from "@/lib/types";

export function buildMarkdown(
  progress: ProgressMap,
  notes: NotesMap,
  srs: SrsMap,
  refs: RefsMap,
  plans?: PlansState,
  learned?: LearnedMap,
): string {
  const now = new Date();
  const lines: string[] = [];
  lines.push("# Refrainly export");
  lines.push("");
  lines.push(`Exported ${now.toISOString().slice(0, 10)}`);
  lines.push("");

  const planList = Object.values(plans || seedBuiltinPlans()).filter((p) => !p.hidden);

  planList.forEach((c) => {
    let done = 0;
    let total = 0;
    let noteDays = 0;
    c.days.forEach((d) => {
      const p = progress[d.id];
      total += d.topics.length;
      d.topics.forEach((_, i) => {
        if (p && p[i]) done += 1;
      });
      if (notes[d.id]) noteDays += 1;
    });
    lines.push(`## ${c.name}`);
    lines.push("");
    lines.push(`${c.subtitle}`);
    lines.push("");
    lines.push(`Progress: ${done}/${total} topics · ${noteDays} days with notes`);
    lines.push("");

    c.days.forEach((d) => {
      const p = progress[d.id] || {};
      const note = notes[d.id];
      const anyDone = d.topics.some((_, i) => p[i]);
      if (!anyDone && !note) return;
      const allDone = d.topics.every((_, i) => p[i]);
      lines.push(`### Day ${d.day}${allDone ? " ✓" : ""}`);
      d.topics.forEach((t, i) => lines.push(`- [${p[i] ? "x" : " "}] ${t}`));
      const e = srs[d.id];
      if (e) {
        lines.push("");
        lines.push(
          e.graduated
            ? "_Review: retained_"
            : `_Review: ${e.reps} ${e.reps === 1 ? "pass" : "passes"}, next ${relativeDue(e.due, Date.now())}_`,
        );
      }
      if (note) {
        lines.push("");
        lines.push(note.trim());
      }
      const ref = refs && refs[d.id];
      if (ref) {
        lines.push("");
        lines.push(`<details><summary>Reference notes on ${ref.topic}</summary>`);
        lines.push("");
        lines.push(ref.text.trim());
        lines.push("");
        lines.push("</details>");
      }
      lines.push("");
    });
  });

  const learnedDays = sortedLearnedDays(learned);
  if (learnedDays.length) {
    lines.push("## Other things I learned");
    lines.push("");
    learnedDays.forEach(({ date, items }) => {
      lines.push(`### ${formatLearnedDate(date)}`);
      lines.push("");
      items.forEach((item) => {
        lines.push(`#### ${item.title}`);
        lines.push("");
        if (item.body.trim()) {
          lines.push(item.body.trim());
          lines.push("");
        }
        if (item.insight?.trim()) {
          lines.push(`> **Summary:** ${item.insight.trim()}`);
          lines.push("");
        }
      });
    });
  }

  return lines.join("\n");
}
