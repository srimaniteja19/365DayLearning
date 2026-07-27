export type DomainId =
  | "ai-ml"
  | "backend-node"
  | "frontend"
  | "databases"
  | "infra-cloud"
  | "data-eng"
  | "distributed-sys"
  | "security"
  | "observability"
  | "perf"
  | "systems-eng";

export type DayEntry = {
  day: number;
  id: string;
  topics: string[];
  domains: DomainId[];
};

export type ThemeKey =
  | "bloom"
  | "ledger"
  | "terminal"
  | "pebble"
  | "graphite"
  | "parchment"
  | "blueprint"
  | "matte";

export type CampaignKey = "main" | "sprint";

export type ProgressMap = Record<string, Record<number, boolean>>;
export type NotesMap = Record<string, string>;
export type RefsMap = Record<string, { text: string; topic: string; style: string; at: number }>;
export type SrsEntry = {
  idx: number;
  due: number | null;
  graduated: boolean;
  reps: number;
  last: number;
};
export type SrsMap = Record<string, SrsEntry>;
export type LogEntry = { d: string; i: number; at: number };

export type PersistedState = {
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  themeKey: ThemeKey;
  updatedAt?: number;
};

export type BackupFile = {
  app: "dualtrack";
  version: 2;
  exportedAt: number;
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  themeKey: ThemeKey;
};

export type ViewKey = "console" | "grid" | "review" | "weekly" | "log";
export type ScopeKey = "all" | "quarter" | "month" | "week";
export type ModalState = { kind: string; day?: DayEntry } | null;
export type SaveStatus = "loading" | "idle" | "saving" | "saved" | "error" | "off";
