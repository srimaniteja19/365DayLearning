/**
 * Refrainly — multi-plan learning orchestrator.
 */
// @ts-nocheck
"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useSession } from "next-auth/react";
import {
  hasStorage,
  loadAppSnapshot,
  saveAppSnapshot,
  clearUserData,
} from "@/lib/storage";
import { pullCloudSnapshot, pushCloudSnapshot } from "@/lib/cloudSync";
import {
  periodsForPlan,
  scopesForPlan,
  createBuiltin365,
  createBuiltin45,
} from "@/data/builtinPlans";
import { DOMAIN_PALETTES, THEMES, hexToRgba, themeVars } from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_PACKS,
  fontVars,
} from "@/theme/fonts";
import { ThemeCtx } from "@/theme/ThemeContext";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";
import { XP_PER_TOPIC, XP_PER_DAY_BONUS, levelFromXp, rankForLevel } from "@/lib/xp";
import { seedReview, nextReview, dueList } from "@/lib/srs";
import { buildRelatedIndex, relatedDaysFor } from "@/lib/related";
import { accentForPlan } from "@/lib/accents";
import { purgePlanUserData } from "@/lib/migration";
import {
  BUILTIN_365_ID,
  BUILTIN_45_ID,
  SCHEMA_VERSION,
} from "@/lib/types";
import { hydrateCredentialsFromStorage } from "@/lib/providers/credentials";
import { computeBadges } from "@/lib/achievements";
import { findOnThisDayMemory } from "@/lib/onThisDay";
import { dateKey } from "@/lib/learned";

import {
  BackgroundFX,
  TopBar,
  PlanSwitcher,
  CampaignHero,
  ViewTabs,
  PeriodNav,
  DomainLegend,
  ConsoleView,
  GridView,
  ReviewView,
  WeeklyView,
  LogView,
  ModalHost,
  ToastLayer,
  ConfettiBurst,
  Footer,
  HomeView,
  OnThisDayCard,
} from "@/features/ui/Views";
import { LearnedView } from "@/features/learned/LearnedView";

const GUEST_MODE_KEY = "dualtrack:guest";
const PAGE_KEY = "dualtrack:page";

export default function DualTrackConsole() {
  const [plans, setPlans] = useState({});
  const [activePlanId, setActivePlanId] = useState(BUILTIN_365_ID);
  const [progress, setProgress] = useState({});
  const [notes, setNotes] = useState({});
  const [learned, setLearned] = useState({});
  const [view, setView] = useState("console");
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [scope, setScope] = useState("all");
  const [periodIdx, setPeriodIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [refs, setRefs] = useState({});
  const [srs, setSrs] = useState({});
  const [log, setLog] = useState([]);
  const [modal, setModal] = useState(null);
  const [themeKey, setThemeKey] = useState("bloom");
  const [fontKey, setFontKey] = useState(DEFAULT_FONT_KEY);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState(null);
  /** Top-level page (Home vs Dashboard) — remembered across reloads. */
  const [page, setPageState] = useState(() => {
    if (typeof window === "undefined") return "home";
    try {
      return window.localStorage.getItem(PAGE_KEY) || "home";
    } catch {
      return "home";
    }
  });
  const setPage = useCallback((next) => {
    setPageState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PAGE_KEY, next);
    } catch {
      // best-effort only
    }
  }, []);
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const didLoad = useRef(false);
  const storageOk = useRef(false);
  const { data: session } = useSession();
  const cloudUserId = session?.user?.id || null;
  const cloudSyncedFor = useRef(null);
  const [guestMode, setGuestMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(GUEST_MODE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const pendingAuthAction = useRef(null);

  /**
   * Gate an action (build a custom plan, browse example plans) behind sign-in —
   * unless the visitor already has a session or has explicitly opted into guest mode.
   */
  const requireAuth = useCallback(
    (action) => {
      if (cloudUserId || guestMode) {
        action();
        return;
      }
      pendingAuthAction.current = action;
      setModal({ kind: "account", gated: true });
    },
    [cloudUserId, guestMode],
  );

  const resolvePendingAuthAction = useCallback(() => {
    const action = pendingAuthAction.current;
    pendingAuthAction.current = null;
    if (action) action();
  }, []);

  const handleAccountAuthenticated = useCallback(() => {
    setModal(null);
    resolvePendingAuthAction();
  }, [resolvePendingAuthAction]);

  const handleContinueAsGuest = useCallback(() => {
    setGuestMode(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(GUEST_MODE_KEY, "1");
      } catch {
        // best-effort only
      }
    }
    setModal(null);
    resolvePendingAuthAction();
  }, [resolvePendingAuthAction]);

  const theme = THEMES[themeKey] || THEMES.bloom;
  const fontPack = FONT_PACKS[fontKey] || FONT_PACKS[DEFAULT_FONT_KEY];
  const domainColors = DOMAIN_PALETTES[theme.palette];
  const rootStyle = { ...themeVars(theme), ...fontVars(fontPack) };

  const visiblePlans = useMemo(
    () => Object.values(plans).filter((p) => !p.hidden),
    [plans],
  );

  const themedPlans = useMemo(() => {
    const out = {};
    let autoIndex = 0;
    visiblePlans.forEach((p) => {
      const role = p.accentRole || "auto";
      const accent = accentForPlan(
        theme.accents,
        role === "auto" ? "auto" : role,
        role === "auto" ? autoIndex++ : 0,
      );
      out[p.id] = {
        ...p,
        key: p.id,
        accent,
        glow: theme.effects ? hexToRgba(accent, 0.35) : "transparent",
      };
    });
    return out;
  }, [visiblePlans, theme]);

  const campaign = themedPlans[activePlanId] || Object.values(themedPlans)[0];

  const buildSnapshot = useCallback(
    () => ({
      meta: {
        schemaVersion: SCHEMA_VERSION,
        activePlanId,
        themeKey,
        fontKey,
        hiddenPlanIds: Object.values(plans)
          .filter((p) => p.hidden)
          .map((p) => p.id),
        updatedAt: Date.now(),
      },
      plans,
      userdata: { progress, notes, refs, srs, log, learned },
    }),
    [activePlanId, themeKey, fontKey, plans, progress, notes, refs, srs, log, learned],
  );

  const fireToast = useCallback((msg, kind) => {
    setToast({ msg, kind, id: Math.random() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    hydrateCredentialsFromStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await hasStorage();
      storageOk.current = ok;
      if (!ok) {
        if (!cancelled) {
          didLoad.current = true;
          setSaveStatus("off");
        }
        return;
      }
      const snap = await loadAppSnapshot();
      if (cancelled) return;
      if (snap) {
        setPlans(snap.plans);
        setActivePlanId(snap.meta.activePlanId);
        setProgress(snap.userdata.progress);
        setNotes(snap.userdata.notes);
        setRefs(snap.userdata.refs);
        setSrs(snap.userdata.srs);
        setLog(snap.userdata.log);
        setLearned(snap.userdata.learned || {});
        if (snap.meta.themeKey && THEMES[snap.meta.themeKey]) {
          setThemeKey(snap.meta.themeKey);
        }
        if (snap.meta.fontKey && FONT_PACKS[snap.meta.fontKey]) {
          setFontKey(snap.meta.fontKey);
        }
      }
      didLoad.current = true;
      setSaveStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pull the account's cloud snapshot once per sign-in. If the account has
  // no cloud data yet (first sign-in from any device), seed it from
  // whatever is already loaded locally.
  useEffect(() => {
    if (!didLoad.current) return;
    if (!cloudUserId) return;
    if (cloudSyncedFor.current === cloudUserId) return;
    cloudSyncedFor.current = cloudUserId;
    (async () => {
      const result = await pullCloudSnapshot();
      if (!result.ok) return;
      if (result.snapshot) {
        const snap = result.snapshot;
        setPlans(snap.plans);
        setActivePlanId(snap.meta.activePlanId);
        setProgress(snap.userdata.progress || {});
        setNotes(snap.userdata.notes || {});
        setRefs(snap.userdata.refs || {});
        setSrs(snap.userdata.srs || {});
        setLog(snap.userdata.log || []);
        setLearned(snap.userdata.learned || {});
        if (snap.meta.themeKey && THEMES[snap.meta.themeKey]) setThemeKey(snap.meta.themeKey);
        if (snap.meta.fontKey && FONT_PACKS[snap.meta.fontKey]) setFontKey(snap.meta.fontKey);
        if (storageOk.current) await saveAppSnapshot(snap);
        fireToast("Synced from your account");
      } else {
        await pushCloudSnapshot(buildSnapshot());
      }
    })();
  }, [cloudUserId, fireToast, buildSnapshot]);

  useEffect(() => {
    if (!cloudUserId) cloudSyncedFor.current = null;
  }, [cloudUserId]);

  useEffect(() => {
    if (!didLoad.current) return;
    if (!storageOk.current) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshot = buildSnapshot();
      const ok = await saveAppSnapshot(snapshot);
      setSaveStatus(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveStatus((cur) => (cur === "saved" ? "idle" : cur)), 1600);
      if (cloudUserId) pushCloudSnapshot(snapshot);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [progress, notes, refs, srs, log, learned, themeKey, fontKey, plans, activePlanId, cloudUserId, buildSnapshot]);

  useEffect(() => {
    if (!campaign) return;
    const allowed = scopesForPlan(campaign).map((x) => x.key);
    if (!allowed.includes(scope)) setScope("all");
    setPeriodIdx(0);
  }, [activePlanId]);

  const setRef = useCallback((dayId, payload) => {
    setRefs((prev) => {
      const next = { ...prev };
      if (payload) next[dayId] = payload;
      else delete next[dayId];
      return next;
    });
  }, []);

  const appendNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const cur = prev[dayId] || "";
      const joined = cur.trim() ? cur.trimEnd() + "\n\n" + text : text;
      return { ...prev, [dayId]: joined };
    });
  }, []);

  const setNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[dayId] = text;
      else delete next[dayId];
      return next;
    });
  }, []);

  const addLearned = useCallback((date, item) => {
    setLearned((prev) => {
      const list = prev[date] || [];
      return { ...prev, [date]: [item, ...list] };
    });
  }, []);

  const updateLearned = useCallback((date, item) => {
    setLearned((prev) => {
      const list = prev[date] || [];
      return {
        ...prev,
        [date]: list.map((x) => (x.id === item.id ? item : x)),
      };
    });
  }, []);

  const removeLearned = useCallback((date, id) => {
    setLearned((prev) => {
      const list = (prev[date] || []).filter((x) => x.id !== id);
      const next = { ...prev };
      if (list.length) next[date] = list;
      else delete next[date];
      return next;
    });
  }, []);

  const handleReset = useCallback(async () => {
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    setLearned({});
    await clearUserData();
    if (cloudUserId) {
      pushCloudSnapshot({
        meta: {
          schemaVersion: SCHEMA_VERSION,
          activePlanId,
          themeKey,
          fontKey,
          hiddenPlanIds: Object.values(plans)
            .filter((p) => p.hidden)
            .map((p) => p.id),
          updatedAt: Date.now(),
        },
        plans,
        userdata: { progress: {}, notes: {}, refs: {}, srs: {}, log: [], learned: {} },
      });
    }
    setConfirmReset(false);
    setSaveStatus("idle");
  }, [cloudUserId, activePlanId, themeKey, fontKey, plans]);

  const handleDeletePlan = useCallback((planId) => {
    const plan = plans[planId];
    if (!plan) return;
    if (plan.builtin) {
      setPlans((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], hidden: true },
      }));
      if (activePlanId === planId) {
        const next = Object.values(plans).find((p) => p.id !== planId && !p.hidden);
        setActivePlanId(next?.id || BUILTIN_365_ID);
      }
      setConfirmDeletePlanId(null);
      fireToast("Built-in plan hidden", "xp");
      return;
    }
    setPlans((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
    const purged = purgePlanUserData(
      { progress, notes, refs, srs, log, learned },
      planId,
    );
    setProgress(purged.progress);
    setNotes(purged.notes);
    setRefs(purged.refs);
    setSrs(purged.srs);
    setLog(purged.log);
    setLearned(purged.learned || {});
    if (activePlanId === planId) {
      const remaining = Object.values(plans).filter((p) => p.id !== planId && !p.hidden);
      setActivePlanId(remaining[0]?.id || BUILTIN_365_ID);
    }
    setConfirmDeletePlanId(null);
    fireToast("Plan deleted", "xp");
  }, [plans, activePlanId, progress, notes, refs, srs, log, learned, fireToast]);

  // "OPERATION LONGHAUL"/"OPERATION FASTBURN" are curated example curricula,
  // not auto-assigned to every account — offered as opt-in starting points.
  const examplePlans = useMemo(
    () => [
      {
        ...createBuiltin365(),
        blurb: "A full year of backend, infra, and systems depth — quarters, months, and weeks mapped out for you.",
      },
      {
        ...createBuiltin45(),
        blurb: "A 45-day sprint through modern AI/LLM engineering — model internals to a multimodal capstone.",
      },
    ],
    [],
  );

  const addExamplePlan = useCallback((planId) => {
    setPlans((prev) => {
      if (prev[planId]) return { ...prev, [planId]: { ...prev[planId], hidden: false } };
      const plan = planId === BUILTIN_45_ID ? createBuiltin45() : createBuiltin365();
      return { ...prev, [plan.id]: plan };
    });
    setActivePlanId(planId);
    setScope("all");
    setView("console");
    setPage("dashboard");
    fireToast("Plan added", "day");
  }, [fireToast, setPage]);

  const setTopicDone = useCallback((dayId, topicIdx, done) => {
    setProgress((prev) => {
      const cur = prev[dayId] || {};
      const next = { ...cur, [topicIdx]: done };
      return { ...prev, [dayId]: next };
    });
  }, []);

  const isDayComplete = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return false;
    return day.topics.every((_, i) => p[i]);
  }, [progress]);

  const topicsDoneCount = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return 0;
    return day.topics.filter((_, i) => p[i]).length;
  }, [progress]);

  const globalStats = useMemo(() => {
    let totalTopics = 0, doneTopics = 0, daysComplete = 0, totalDaysAll = 0;
    visiblePlans.forEach((c) => {
      c.days.forEach((d) => {
        totalDaysAll += 1;
        totalTopics += d.topics.length;
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
      });
    });
    const xp = doneTopics * XP_PER_TOPIC + daysComplete * XP_PER_DAY_BONUS;
    const { level, into, need } = levelFromXp(xp);
    return { totalTopics, doneTopics, daysComplete, totalDaysAll, xp, level, into, need, rank: rankForLevel(level) };
  }, [progress, visiblePlans]);

  const badgeStatuses = useMemo(
    () =>
      computeBadges({
        visiblePlans,
        progress,
        srs,
        log,
        learned,
        doneTopics: globalStats.doneTopics,
        daysComplete: globalStats.daysComplete,
      }),
    [visiblePlans, progress, srs, log, learned, globalStats.doneTopics, globalStats.daysComplete],
  );

  // Baseline is only established once the initial load (local or cloud) has
  // resolved, so pre-existing badges don't all fire "unlocked" toasts at once.
  const badgeBaselineRef = useRef(null);
  useEffect(() => {
    if (saveStatus === "loading") return;
    const unlockedIds = badgeStatuses.filter((s) => s.unlocked).map((s) => s.badge.id);
    if (badgeBaselineRef.current === null) {
      badgeBaselineRef.current = new Set(unlockedIds);
      return;
    }
    const newlyUnlocked = unlockedIds.filter((id) => !badgeBaselineRef.current.has(id));
    if (newlyUnlocked.length) {
      newlyUnlocked.forEach((id) => badgeBaselineRef.current.add(id));
      const badge = badgeStatuses.find((s) => s.badge.id === newlyUnlocked[0])?.badge;
      if (badge) fireToast(`Badge unlocked · ${badge.label}`, "day");
    }
  }, [badgeStatuses, saveStatus, fireToast]);

  const todayKey = useMemo(() => dateKey(), []);

  const onThisDayMemory = useMemo(
    () => findOnThisDayMemory({ log, learned, visiblePlans }),
    [log, learned, visiblePlans],
  );

  const [onThisDayDismissed, setOnThisDayDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setOnThisDayDismissed(window.sessionStorage.getItem(`dualtrack:otd-dismissed:${todayKey}`) === "1");
    } catch {
      /* ignore */
    }
  }, [todayKey]);
  const dismissOnThisDay = useCallback(() => {
    setOnThisDayDismissed(true);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(`dualtrack:otd-dismissed:${todayKey}`, "1");
    } catch {
      /* ignore */
    }
  }, [todayKey]);

  const campaignStats = useMemo(() => {
    const stats = {};
    visiblePlans.forEach((c) => {
      let doneTopics = 0, daysComplete = 0;
      const domainTally = {};
      const topicsPerDay = c.topicsPerDay || 2;
      c.days.forEach((d) => {
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
        d.domains.forEach((dom, i) => {
          if (!domainTally[dom]) domainTally[dom] = { total: 0, done: 0 };
          domainTally[dom].total += 1;
          if (p && p[i]) domainTally[dom].done += 1;
        });
      });
      let streak = 0;
      for (const d of c.days) {
        if (isDayComplete(d)) streak += 1;
        else break;
      }
      const activeDay = c.days.find((d) => !isDayComplete(d)) || c.days[c.days.length - 1];
      const totalTopics = c.days.length * topicsPerDay;
      stats[c.id] = {
        doneTopics,
        totalTopics,
        daysComplete,
        totalDays: c.days.length,
        pct: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
        domainTally,
        streak,
        activeDay,
      };
    });
    return stats;
  }, [progress, isDayComplete, visiblePlans]);

  const handleToggleTopic = useCallback((day, idx, campaignObj) => {
    const currentlyDone = !!(progress[day.id] && progress[day.id][idx]);
    const willBeDone = !currentlyDone;
    const now = Date.now();
    setTopicDone(day.id, idx, willBeDone);

    setLog((prev) =>
      willBeDone
        ? [...prev, { d: day.id, i: idx, at: now }]
        : prev.filter((e) => !(e.d === day.id && e.i === idx)),
    );

    const otherIdxAll = day.topics.map((_, i) => i).filter((i) => i !== idx);
    const othersDone = otherIdxAll.every((i) => !!(progress[day.id] && progress[day.id][i]));
    if (willBeDone && othersDone) {
      setSrs((prev) => (prev[day.id] ? prev : { ...prev, [day.id]: seedReview(now) }));
    }
    if (!willBeDone) {
      setSrs((prev) => {
        if (!prev[day.id]) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    }

    if (willBeDone) {
      fireToast(`+${XP_PER_TOPIC} XP · ${day.topics[idx]}`, "xp");
      const allOthersDone = day.topics.every((_, i) =>
        i === idx ? true : !!(progress[day.id] && progress[day.id][i]),
      );
      if (allOthersDone) {
        setTimeout(() => {
          setConfetti({ id: Math.random(), color: campaignObj.accent });
          fireToast(`DAY ${day.day} COMPLETE · +${XP_PER_DAY_BONUS} bonus XP`, "day");
          setTimeout(() => setConfetti(null), 1400);
        }, 250);
      }
    }
  }, [progress, setTopicDone, fireToast]);

  const gradeReview = useCallback((dayId, outcome) => {
    const now = Date.now();
    setSrs((prev) => ({ ...prev, [dayId]: nextReview(prev[dayId], outcome, now) }));
  }, []);

  const applyImport = useCallback((result) => {
    if (!result || typeof result !== "object") throw new Error("Not a Refrainly backup file");
    if (result.kind === "plan") {
      setPlans(result.plans);
      return;
    }
    if (result.kind === "full" && result.slice) {
      const s = result.slice;
      setPlans(s.plans);
      setProgress(s.progress);
      setNotes(s.notes);
      setRefs(s.refs);
      setSrs(s.srs);
      setLog(s.log);
      setLearned(s.learned || {});
      if (s.themeKey && THEMES[s.themeKey]) setThemeKey(s.themeKey);
      if (s.activePlanId) setActivePlanId(s.activePlanId);
      return;
    }
    throw new Error("Unrecognized import payload");
  }, []);

  const periods = useMemo(() => {
    if (!campaign) return null;
    const list = periodsForPlan(campaign, scope);
    if (!list) return null;
    return list.map((p) => {
      let total = 0, done = 0;
      for (const d of campaign.days) {
        if (d.day < p.start || d.day > p.end) continue;
        const pr = progress[d.id];
        total += d.topics.length;
        d.topics.forEach((_, i) => {
          if (pr && pr[i]) done += 1;
        });
      }
      return { ...p, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [campaign, scope, progress]);

  const activeDayNum = campaign && campaignStats[campaign.id]?.activeDay
    ? campaignStats[campaign.id].activeDay.day
    : 1;

  useEffect(() => {
    if (!campaign || scope === "all") return;
    const list = periodsForPlan(campaign, scope);
    if (!list) return;
    const idx = list.findIndex((p) => activeDayNum >= p.start && activeDayNum <= p.end);
    setPeriodIdx(idx >= 0 ? idx : 0);
  }, [scope, activePlanId]);

  const activePeriod = periods && periods[Math.min(periodIdx, periods.length - 1)];

  const filteredDays = useMemo(() => {
    if (!campaign) return [];
    let days = campaign.days;
    if (activePeriod) {
      days = days.filter((d) => d.day >= activePeriod.start && d.day <= activePeriod.end);
    }
    if (domainFilter) {
      days = days.filter((d) => d.domains.includes(domainFilter));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      days = days.filter(
        (d) =>
          d.topics.some((t) => t.toLowerCase().includes(q)) ||
          String(d.day).includes(q) ||
          (notes[d.id] || "").toLowerCase().includes(q),
      );
    }
    return days;
  }, [campaign, domainFilter, query, activePeriod, notes]);

  const relatedIndex = useMemo(
    () => buildRelatedIndex(campaign?.days || []),
    [campaign],
  );
  const getRelated = useCallback(
    (day) => relatedDaysFor(day, campaign?.days || [], relatedIndex, 3),
    [campaign, relatedIndex],
  );

  const reviewQueue = useMemo(() => {
    const all = visiblePlans.flatMap((p) => p.days);
    return dueList(srs, all, Date.now());
  }, [srs, visiblePlans]);

  const scheduledCount = useMemo(
    () => Object.values(srs).filter((e) => e && !e.graduated).length,
    [srs],
  );

  if (saveStatus === "loading") {
    return (
      <div className="app-root" style={rootStyle}>
        <div className="panel-loading">Loading…</div>
      </div>
    );
  }

  // Dashboard only exists once there's an active campaign to show — otherwise
  // always fall back to Home (e.g. stale "dashboard" page from before a reset).
  const onDashboard = page === "dashboard" && !!campaign;

  if (!onDashboard) {
    const homeSummary = campaign
      ? {
          name: campaign.name,
          streak: campaignStats[campaign.id]?.streak || 0,
          xp: globalStats.xp,
          level: globalStats.level,
          rank: globalStats.rank,
          daysComplete: globalStats.daysComplete,
          totalDays: globalStats.totalDaysAll,
        }
      : null;
    // Landing always uses Bloom so the marketing page reads as one bright
    // composition — dashboard keeps the user's chosen theme separately.
    const homeTheme = THEMES.bloom;
    const homeStyle = { ...themeVars(homeTheme), ...fontVars(fontPack) };
    return (
      <div
        className={classNames(
          "app-root",
          "landing-root",
          homeTheme.mode === "light" && "is-light",
          !homeTheme.effects && "no-fx",
        )}
        style={homeStyle}
      >
        <HomeView
          hasCampaign={!!campaign}
          summary={homeSummary}
          examples={examplePlans}
          onAddExample={addExamplePlan}
          onOpenBuilder={() => requireAuth(() => setModal({ kind: "builder" }))}
          onOpenAccount={() => setModal({ kind: "account" })}
          onOpenPricing={() => setModal({ kind: "pricing" })}
          accountLabel={session?.user?.email || null}
          onRequireAuth={requireAuth}
          onGoDashboard={() => setPage("dashboard")}
        />
        {modal && (
          <ModalHost
            modal={modal}
            onClose={() => setModal(null)}
            notes={notes}
            refs={refs}
            setRef={setRef}
            appendNote={appendNote}
            progress={progress}
            srs={srs}
            log={log}
            learned={learned}
            themeKey={themeKey}
            onImport={applyImport}
            fireToast={fireToast}
            plans={plans}
            activePlanId={activePlanId}
            onAccountAuthenticated={handleAccountAuthenticated}
            onAccountGuest={handleContinueAsGuest}
            onOpenAccount={() => setModal({ kind: "account" })}
            onOpenPricing={() => setModal({ kind: "pricing" })}
            onPlanCreated={(plan) => {
              setPlans((prev) => ({ ...prev, [plan.id]: plan }));
              setActivePlanId(plan.id);
              setScope("all");
              setView("console");
              setPage("dashboard");
              fireToast(`Plan ready · ${plan.totalDays} days`, "day");
            }}
          />
        )}
        <ToastLayer toast={toast} />
      </div>
    );
  }

  const stats = campaignStats[campaign.id];

  return (
    <ThemeCtx.Provider value={{ theme, domainColors }}>
      <div
        className={classNames(
          "app-root",
          theme.mode === "light" && "is-light",
          !theme.effects && "no-fx",
        )}
        style={rootStyle}
      >
        <BackgroundFX accent={campaign.accent} effects={theme.effects} />
        <TopBar
          stats={globalStats}
          onOpenData={() => setModal({ kind: "export" })}
          onOpenSettings={() => setModal({ kind: "settings" })}
          onOpenAccount={() => setModal({ kind: "account" })}
          accountLabel={session?.user?.email || null}
          onNewPlan={() => setModal({ kind: "builder" })}
          themeKey={themeKey}
          setThemeKey={setThemeKey}
          fontKey={fontKey}
          setFontKey={setFontKey}
          saveStatus={saveStatus}
          noteCount={Object.keys(notes).length}
          confirmReset={confirmReset}
          setConfirmReset={setConfirmReset}
          onReset={handleReset}
          onOpenBadges={() => setModal({ kind: "badges" })}
          badgeCount={badgeStatuses.filter((s) => s.unlocked).length}
          badgeTotal={badgeStatuses.length}
          onGoHome={() => setPage("home")}
          onOpenPricing={() => setModal({ kind: "pricing" })}
        />
        <PlanSwitcher
          active={activePlanId}
          setActive={setActivePlanId}
          campaignStats={campaignStats}
          campaigns={themedPlans}
          confirmDeletePlanId={confirmDeletePlanId}
          setConfirmDeletePlanId={setConfirmDeletePlanId}
          onDeletePlan={handleDeletePlan}
          onNewPlan={() => setModal({ kind: "builder" })}
        />
        <CampaignHero campaign={campaign} stats={stats} />

        {onThisDayMemory && !onThisDayDismissed && (
          <div className="today-widgets-row">
            <OnThisDayCard memory={onThisDayMemory} onDismiss={dismissOnThisDay} />
          </div>
        )}

        <ViewTabs view={view} setView={setView} dueCount={reviewQueue.length} />

        {(view === "console" || view === "grid") && (
          <PeriodNav
            scopes={scopesForPlan(campaign)}
            scope={scope}
            setScope={setScope}
            periods={periods}
            periodIdx={periodIdx}
            setPeriodIdx={setPeriodIdx}
            accent={campaign.accent}
            activeDayNum={activeDayNum}
          />
        )}

        {(view === "console" || view === "grid") && (
          <div className="controls-row">
            <div className="search-wrap">
              <Icon.Search size={15} />
              <input
                className="search-input"
                placeholder={`Search ${campaign.totalDays} days of topics…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <DomainLegend
              tally={stats.domainTally}
              active={domainFilter}
              setActive={setDomainFilter}
              accent={campaign.accent}
            />
          </div>
        )}

        {view === "console" && (
          <ConsoleView
            campaign={campaign}
            days={filteredDays}
            progress={progress}
            onToggle={handleToggleTopic}
            expandedDay={expandedDay}
            setExpandedDay={setExpandedDay}
            topicsDoneCount={topicsDoneCount}
            isDayComplete={isDayComplete}
            jumpTarget={stats.activeDay}
            notes={notes}
            setNote={setNote}
            getRelated={getRelated}
            refs={refs}
            setRef={setRef}
            onJumpDay={(d) => {
              setExpandedDay(d.id);
              setScope("all");
            }}
            onOpenTool={(kind, day) => setModal({ kind, day })}
            query={query}
          />
        )}
        {view === "grid" && (
          <GridView
            campaign={campaign}
            days={filteredDays}
            progress={progress}
            isDayComplete={isDayComplete}
            topicsDoneCount={topicsDoneCount}
            notes={notes}
            onOpenDay={(d) => {
              setExpandedDay(d.id);
              setView("console");
            }}
          />
        )}
        {view === "review" && (
          <ReviewView
            queue={reviewQueue}
            srs={srs}
            notes={notes}
            scheduledCount={scheduledCount}
            onGrade={gradeReview}
            onOpenDay={(d) => {
              const planId = String(d.id).split(":")[0];
              if (themedPlans[planId]) setActivePlanId(planId);
              setExpandedDay(d.id);
              setScope("all");
              setView("console");
            }}
          />
        )}
        {view === "weekly" && (
          <WeeklyView
            log={log}
            notes={notes}
            progress={progress}
            srs={srs}
            campaigns={themedPlans}
            activeCampaign={activePlanId}
            onOpenDay={(d) => {
              setExpandedDay(d.id);
              setScope("all");
              setView("console");
            }}
            onExport={() => setModal({ kind: "export" })}
          />
        )}
        {view === "learned" && (
          <LearnedView
            learned={learned}
            onAdd={addLearned}
            onUpdate={updateLearned}
            onRemove={removeLearned}
            accent={campaign.accent}
            fireToast={fireToast}
          />
        )}
        {view === "log" && (
          <LogView
            campaign={campaign}
            stats={stats}
            progress={progress}
            notes={notes}
          />
        )}

        {modal && (
          <ModalHost
            modal={modal}
            onClose={() => setModal(null)}
            notes={notes}
            refs={refs}
            setRef={setRef}
            appendNote={appendNote}
            progress={progress}
            srs={srs}
            log={log}
            learned={learned}
            themeKey={themeKey}
            onImport={applyImport}
            fireToast={fireToast}
            plans={plans}
            activePlanId={activePlanId}
            badgeStatuses={badgeStatuses}
            onOpenAccount={() => setModal({ kind: "account" })}
            onOpenPricing={() => setModal({ kind: "pricing" })}
            onPlanCreated={(plan) => {
              setPlans((prev) => ({ ...prev, [plan.id]: plan }));
              setActivePlanId(plan.id);
              setScope("all");
              setView("console");
              setPage("dashboard");
              fireToast(`Plan ready · ${plan.totalDays} days`, "day");
            }}
          />
        )}

        <ToastLayer toast={toast} />
        {confetti && <ConfettiBurst key={confetti.id} color={confetti.color} />}
        <Footer />
      </div>
    </ThemeCtx.Provider>
  );
}
