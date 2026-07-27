import type {
  LogEntry,
  NotesMap,
  ProgressMap,
  RefsMap,
  SrsMap,
  UserDataState,
} from "@/lib/types";
import { BUILTIN_365_ID, BUILTIN_45_ID } from "@/lib/types";

/** Rewrite legacy day ids: `365-12` → `builtin-365:12`, `45-3` → `builtin-45:3`. */
export function migrateDayId(id: string): string {
  const m365 = /^365-(\d+)$/.exec(id);
  if (m365) return `${BUILTIN_365_ID}:${m365[1]}`;
  const m45 = /^45-(\d+)$/.exec(id);
  if (m45) return `${BUILTIN_45_ID}:${m45[1]}`;
  return id;
}

function remapRecordKeys<T>(
  record: Record<string, T> | undefined | null,
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!record || typeof record !== "object") return out;
  for (const [key, value] of Object.entries(record)) {
    out[migrateDayId(key)] = value;
  }
  return out;
}

export function migrateProgress(progress: ProgressMap | undefined | null): ProgressMap {
  return remapRecordKeys(progress);
}

export function migrateNotes(notes: NotesMap | undefined | null): NotesMap {
  return remapRecordKeys(notes);
}

export function migrateRefs(refs: RefsMap | undefined | null): RefsMap {
  return remapRecordKeys(refs);
}

export function migrateSrs(srs: SrsMap | undefined | null): SrsMap {
  return remapRecordKeys(srs);
}

export function migrateLog(log: LogEntry[] | undefined | null): LogEntry[] {
  if (!Array.isArray(log)) return [];
  return log.map((entry) => ({
    ...entry,
    d: migrateDayId(entry.d),
  }));
}

export function migrateUserData(raw: Partial<UserDataState> | null | undefined): UserDataState {
  return {
    progress: migrateProgress(raw?.progress),
    notes: migrateNotes(raw?.notes),
    refs: migrateRefs(raw?.refs),
    srs: migrateSrs(raw?.srs),
    log: migrateLog(raw?.log),
  };
}

/** Strip all userdata entries belonging to a plan id prefix (`planId:`). */
export function purgePlanUserData(userdata: UserDataState, planId: string): UserDataState {
  const prefix = `${planId}:`;
  const strip = <T,>(rec: Record<string, T>) => {
    const next: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!k.startsWith(prefix)) next[k] = v;
    }
    return next;
  };
  return {
    progress: strip(userdata.progress),
    notes: strip(userdata.notes),
    refs: strip(userdata.refs),
    srs: strip(userdata.srs),
    log: userdata.log.filter((e) => !e.d.startsWith(prefix)),
  };
}
