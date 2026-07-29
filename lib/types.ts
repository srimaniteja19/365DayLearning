export type Domain = string;

export type PlanDay = {
  day: number;
  id: string;
  topics: string[];
  domains: Domain[];
};

export type PlanPeriod = {
  label: string;
  sub: string;
  start: number;
  end: number;
};

/** Builder inputs that produced a plan. */
export type DomainWeight = "small" | "medium" | "large";

export type PlanDomainSpec = {
  id: string;
  label?: string;
  weight: DomainWeight;
  color?: string;
};

export type PlanGrouping = "none" | "weekly" | "monthly" | "quarterly-monthly";

export type PlanRequest = {
  name?: string;
  subtitle?: string;
  goal?: string;
  level?: string;
  exclusions?: string[];
  domains?: PlanDomainSpec[];
  mustInclude?: string[];
  totalDays?: number;
  topicsPerDay?: number;
  grouping?: PlanGrouping;
};

export type PlanStatus = "draft" | "ready";

export type Plan = {
  id: string;
  name: string;
  subtitle: string;
  builtin: boolean;
  createdAt: number;
  totalDays: number;
  topicsPerDay: number;
  accentRole: "main" | "sprint" | "auto";
  periodScopes: Array<{ key: string; label: string; periods: PlanPeriod[] }>;
  days: PlanDay[];
  meta: PlanRequest;
  status?: PlanStatus;
  hidden?: boolean;
};

/** @deprecated Use PlanDay — kept for gradual migration of UI props. */
export type DayEntry = PlanDay;
/** @deprecated Prefer Domain */
export type DomainId = Domain;

export type ThemeKey =
  | "signal"
  | "folio"
  | "afterburn"
  | "chlorophyll"
  | "oxide"
  | "ion"
  | "cinnabar"
  | "halide"
  | "voltaic"
  | "marina";

export type FontKey =
  | "space"
  | "literata"
  | "jetbrains"
  | "archivo"
  | "newsreader"
  | "spacemono"
  | "sora"
  | "kalnia"
  | "host"
  | "redmono";

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

/** Free-form “other things I learned” — keyed by calendar date `YYYY-MM-DD`. */
export type LearnedItem = {
  id: string;
  title: string;
  body: string;
  insight?: string;
  createdAt: number;
};
export type LearnedMap = Record<string, LearnedItem[]>;

/** Saved links — articles, videos, repos — with optional OG / embed preview. */
export type BookmarkKind = "youtube" | "vimeo" | "article" | "repo" | "doc" | "link";

export type BookmarkPreview = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  embedId?: string;
  embedProvider?: "youtube" | "vimeo";
  fetchedAt?: number;
};

export type BookmarkItem = {
  id: string;
  url: string;
  kind: BookmarkKind;
  title: string;
  note?: string;
  tags?: string[];
  preview?: BookmarkPreview;
  insight?: string;
  createdAt: number;
};

export type BookmarksList = BookmarkItem[];

export type UserDataState = {
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  learned: LearnedMap;
  bookmarks: BookmarksList;
};

export type MetaState = {
  schemaVersion: number;
  activePlanId: string;
  themeKey: ThemeKey;
  fontKey?: FontKey;
  hiddenPlanIds: string[];
  updatedAt?: number;
};

export type PlansState = Record<string, Plan>;

export type AppSnapshot = {
  meta: MetaState;
  plans: PlansState;
  userdata: UserDataState;
};

/** Legacy single-blob shape (pre multi-plan). */
export type PersistedState = {
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  learned?: LearnedMap;
  bookmarks?: BookmarksList;
  themeKey: ThemeKey;
  updatedAt?: number;
  schemaVersion?: number;
  activePlanId?: string;
  plans?: PlansState;
};

export type BackupFile = {
  app: "dualtrack";
  version: 2 | 3;
  exportedAt: number;
  progress: ProgressMap;
  notes: NotesMap;
  refs: RefsMap;
  srs: SrsMap;
  log: LogEntry[];
  learned?: LearnedMap;
  bookmarks?: BookmarksList;
  themeKey: ThemeKey;
  plans?: PlansState;
  activePlanId?: string;
  schemaVersion?: number;
};

export type ViewKey = "console" | "grid" | "review" | "weekly" | "log" | "learned" | "bookmarks";
export type ScopeKey = "all" | "quarter" | "month" | "week";
export type ModalState = { kind: string; day?: PlanDay } | null;
export type SaveStatus = "loading" | "idle" | "saving" | "saved" | "error" | "off";

/** Current multi-plan schema. */
export const SCHEMA_VERSION = 3;

export const BUILTIN_365_ID = "builtin-365";
export const BUILTIN_45_ID = "builtin-45";
