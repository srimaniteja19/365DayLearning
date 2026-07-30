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
  purgeLocalAppData,
} from "@/lib/storage";
import { pullCloudSnapshot, pushCloudSnapshot } from "@/lib/cloudSync";
import {
  periodsForPlan,
  scopesForPlan,
  createBuiltin365,
  createBuiltin45,
  createBuiltin30Mind,
  createBuiltinById,
} from "@/data/builtinPlans";
import { DOMAIN_PALETTES, THEMES, LANDING_THEME, resolveThemeKey, DEFAULT_THEME_KEY, hexToRgba, themeVars } from "@/theme/themes";
import {
  DEFAULT_FONT_KEY,
  FONT_PACKS,
  fontVars,
  resolveFontKey,
} from "@/theme/fonts";
import { ThemeCtx } from "@/theme/ThemeContext";
import { Icon } from "@/components/Icon";
import { Tip } from "@/components/Tip";
import { AppHydrateSkeleton } from "@/components/Skeleton";
import { classNames } from "@/lib/classNames";
import { XP_PER_TOPIC, XP_PER_DAY_BONUS, levelFromXp, rankForLevel } from "@/lib/xp";
import { seedReview, nextReview, dueList } from "@/lib/srs";
import { buildRelatedIndex, relatedDaysFor } from "@/lib/related";
import { accentForPlan } from "@/lib/accents";
import { purgePlanUserData } from "@/lib/migration";
import {
  BUILTIN_365_ID,
  SCHEMA_VERSION,
} from "@/lib/types";
import { hydrateCredentialsFromStorage } from "@/lib/providers/credentials";
import {
  fetchSubscriptionStatus,
  setCachedSubscriptionTier,
  tierDef,
} from "@/lib/subscriptions";
import { computeBadges } from "@/lib/achievements";
import { findOnThisDayMemory } from "@/lib/onThisDay";
import { buildKitWeekDigest, countLearned, dateKey } from "@/lib/learned";

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
  FieldKitChrome,
  KitWeekDigestCard,
} from "@/features/ui/Views";
import { LearnedView } from "@/features/learned/LearnedView";
import { BookmarksView } from "@/features/bookmarks/BookmarksView";
import {
  applyPreviewToBookmark,
  createBookmarkId,
  defaultTitleForUrl,
  detectBookmarkKind,
  normalizeBookmarkUrl,
  sanitizeBookmarks,
  seedPreviewFromUrl,
} from "@/lib/bookmarks";

const emptyUserSnapshot = () => ({
  progress: {},
  notes: {},
  refs: {},
  srs: {},
  log: [],
  learned: {},
  bookmarks: [],
});

export default function DualTrackConsole() {
  const [plans, setPlans] = useState({});
  const [activePlanId, setActivePlanId] = useState(BUILTIN_365_ID);
  const [progress, setProgress] = useState({});
  const [notes, setNotes] = useState({});
  const [learned, setLearned] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
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
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME_KEY);
  const [fontKey, setFontKey] = useState(DEFAULT_FONT_KEY);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState(null);
  /** True after Neon hydrate finishes for the signed-in user (gates cloud autosave). */
  const [cloudReady, setCloudReady] = useState(false);
  /** Top-level page (Home / Dashboard / Field Kit). Session-only — Neon holds learning data. */
  const [page, setPage] = useState("home");
  /** Field Kit tab — notes vs bookmarks. */
  const [kitTab, setKitTab] = useState("learned");

  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const hydrateGen = useRef(0);
  /** Last server `updatedAt` we pulled/pushed — used for conflict detection. */
  const cloudBaseUpdatedAt = useRef(null);
  const { data: session, status: sessionStatus } = useSession();
  const cloudUserId = session?.user?.id || null;
  const pendingAuthAction = useRef(null);
  const [syncRetryToken, setSyncRetryToken] = useState(0);

  useEffect(() => {
    if (!cloudUserId) {
      setCachedSubscriptionTier(null);
      return;
    }
    let cancelled = false;
    fetchSubscriptionStatus().then((res) => {
      if (cancelled || !res.ok) return;
      setCachedSubscriptionTier(res.usage.tier);
    });
    return () => {
      cancelled = true;
    };
  }, [cloudUserId]);

  /** Gate plan/kit/dashboard actions behind sign-in. */
  const requireAuth = useCallback(
    (action) => {
      if (cloudUserId) {
        action();
        return;
      }
      pendingAuthAction.current = action;
      setModal({ kind: "account", gated: true });
    },
    [cloudUserId],
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

  /** Landing CTA — require account, then continue (plan picker / builder). */
  const startWithAccount = useCallback(
    (next) => {
      requireAuth(() => {
        if (typeof next === "function") next();
      });
    },
    [requireAuth],
  );

  const openKit = useCallback(
    (tab = "learned") => {
      requireAuth(() => {
        setKitTab(tab === "bookmarks" ? "bookmarks" : "learned");
        setPage("kit");
      });
    },
    [setKitTab, setPage, requireAuth],
  );

  /** When set, LearnedView jumps Chrono to this YYYY-MM-DD (e.g. On This Day). */
  const [kitFocusDate, setKitFocusDate] = useState(null);
  const [kitQuery, setKitQuery] = useState("");
  const [kitSeed, setKitSeed] = useState(null);
  const openKitToDate = useCallback(
    (dateStr) => {
      requireAuth(() => {
        setKitFocusDate(dateStr || null);
        setKitTab("learned");
        setPage("kit");
      });
    },
    [setKitTab, setPage, requireAuth],
  );

  const theme = THEMES[resolveThemeKey(themeKey)] || THEMES[DEFAULT_THEME_KEY];
  const fontPack = FONT_PACKS[resolveFontKey(fontKey)] || FONT_PACKS[DEFAULT_FONT_KEY];
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
      userdata: { progress, notes, refs, srs, log, learned, bookmarks },
    }),
    [activePlanId, themeKey, fontKey, plans, progress, notes, refs, srs, log, learned, bookmarks],
  );

  const fireToast = useCallback((msg, kind) => {
    setToast({ msg, kind, id: Math.random() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /** Handle Stripe Checkout / Portal return (`?billing=success|cancelled|portal`). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (!billing) return;

    // success/portal need a session to refetch tier — wait for auth hydrate.
    if ((billing === "success" || billing === "portal") && !cloudUserId) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("billing");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    if (billing === "cancelled") {
      fireToast("Checkout cancelled — no charge made.", "warn");
      setModal({ kind: "pricing", refreshToken: Date.now() });
      return;
    }

    if (billing === "portal") {
      fireToast("Billing updated.", "ok");
      fetchSubscriptionStatus().then((res) => {
        if (res.ok) setCachedSubscriptionTier(res.usage.tier);
      });
      setModal({ kind: "pricing", refreshToken: Date.now() });
      return;
    }

    if (billing !== "success") return;

    fireToast("Payment received — unlocking your plan…", "ok");
    setModal({ kind: "pricing", refreshToken: Date.now() });

    let cancelled = false;
    (async () => {
      for (let i = 0; i < 6; i++) {
        if (cancelled) return;
        const res = await fetchSubscriptionStatus();
        if (cancelled) return;
        if (res.ok && res.usage.tier !== "free") {
          setCachedSubscriptionTier(res.usage.tier);
          setModal({ kind: "pricing", refreshToken: Date.now() });
          fireToast(`You're on ${tierDef(res.usage.tier).rankLabel}.`, "ok");
          return;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) {
        fireToast("Payment received. Open Plans if your tier hasn’t updated yet.", "ok");
        setModal({ kind: "pricing", refreshToken: Date.now() });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudUserId, fireToast]);

  useEffect(() => {
    hydrateCredentialsFromStorage();
  }, []);

  // Clear legacy guest-mode flag if present.
  useEffect(() => {
    try {
      window.localStorage.removeItem("dualtrack:guest");
      window.localStorage.removeItem("dualtrack:page");
      window.localStorage.removeItem("dualtrack:kit-tab");
    } catch {
      // best-effort only
    }
  }, []);

  const resetWorkspace = useCallback(() => {
    setPlans({});
    setActivePlanId(BUILTIN_365_ID);
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    setLearned({});
    setBookmarks([]);
    setThemeKey(DEFAULT_THEME_KEY);
    setFontKey(DEFAULT_FONT_KEY);
  }, []);

  const applyCloudSnapshot = useCallback((snap) => {
    setPlans(snap.plans || {});
    setActivePlanId(snap.meta?.activePlanId || BUILTIN_365_ID);
    setProgress(snap.userdata?.progress || {});
    setNotes(snap.userdata?.notes || {});
    setRefs(snap.userdata?.refs || {});
    setSrs(snap.userdata?.srs || {});
    setLog(snap.userdata?.log || []);
    setLearned(snap.userdata?.learned || {});
    setBookmarks(sanitizeBookmarks(snap.userdata?.bookmarks));
    if (snap.meta?.themeKey) setThemeKey(resolveThemeKey(snap.meta.themeKey));
    if (snap.meta?.fontKey) setFontKey(resolveFontKey(snap.meta.fontKey));
  }, []);

  // Unsigned users stay on the landing page — no guest dashboard/kit.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!cloudUserId && (page === "dashboard" || page === "kit")) {
      setPage("home");
    }
  }, [sessionStatus, cloudUserId, page]);

  // Migrate legacy in-dashboard Learned/Bookmarks tabs → Field Kit page.
  useEffect(() => {
    if (view !== "learned" && view !== "bookmarks") return;
    const tab = view;
    setView("console");
    openKit(tab);
  }, [view, openKit]);

  // Neon is the source of truth — load/save account snapshots from Postgres only.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    const gen = ++hydrateGen.current;
    setCloudReady(false);

    if (!cloudUserId) {
      resetWorkspace();
      cloudBaseUpdatedAt.current = null;
      setSaveStatus("off");
      return;
    }

    let cancelled = false;
    (async () => {
      setSaveStatus("loading");
      resetWorkspace();
      cloudBaseUpdatedAt.current = null;
      const result = await pullCloudSnapshot();
      if (cancelled || gen !== hydrateGen.current) return;
      if (result.ok && result.snapshot) {
        applyCloudSnapshot(result.snapshot);
        cloudBaseUpdatedAt.current = result.updatedAt;
        fireToast("Synced from your account");
      } else if (result.ok) {
        cloudBaseUpdatedAt.current = result.updatedAt;
      } else if (!result.ok) {
        setSaveStatus("error");
        return;
      }
      setCloudReady(true);
      setSaveStatus("idle");
      purgeLocalAppData().catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, cloudUserId, resetWorkspace, applyCloudSnapshot, fireToast]);

  const flushCloudSnapshot = useCallback(
    async (opts) => {
      if (!cloudReady || !cloudUserId) return false;
      const result = await pushCloudSnapshot(
        buildSnapshot(),
        cloudBaseUpdatedAt.current,
        opts,
      );
      if (result.ok) {
        cloudBaseUpdatedAt.current = result.updatedAt;
        return true;
      }
      if (result.conflict) {
        if (result.snapshot) applyCloudSnapshot(result.snapshot);
        cloudBaseUpdatedAt.current = result.updatedAt ?? cloudBaseUpdatedAt.current;
        fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn");
        return true;
      }
      return false;
    },
    [cloudReady, cloudUserId, buildSnapshot, applyCloudSnapshot, fireToast],
  );

  useEffect(() => {
    if (!cloudReady || !cloudUserId) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await flushCloudSnapshot();
      setSaveStatus(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveStatus((cur) => (cur === "saved" ? "idle" : cur)), 1600);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    progress,
    notes,
    refs,
    srs,
    log,
    learned,
    bookmarks,
    themeKey,
    fontKey,
    plans,
    activePlanId,
    cloudUserId,
    cloudReady,
    flushCloudSnapshot,
    syncRetryToken,
  ]);

  /** Best-effort flush when the tab closes (keepalive; large snapshots may not fit). */
  useEffect(() => {
    if (!cloudReady || !cloudUserId) return;
    const onLeave = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flushCloudSnapshot({ keepalive: true });
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [cloudReady, cloudUserId, flushCloudSnapshot]);

  const retryCloudSync = useCallback(() => {
    if (!cloudReady || !cloudUserId) return;
    setSyncRetryToken((n) => n + 1);
  }, [cloudReady, cloudUserId]);

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

  const updateLearned = useCallback((fromDate, item, toDate) => {
    const dest = toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : fromDate;
    setLearned((prev) => {
      if (dest === fromDate) {
        const list = prev[fromDate] || [];
        return {
          ...prev,
          [fromDate]: list.map((x) => (x.id === item.id ? item : x)),
        };
      }
      const next = { ...prev };
      const remaining = (prev[fromDate] || []).filter((x) => x.id !== item.id);
      if (remaining.length) next[fromDate] = remaining;
      else delete next[fromDate];
      const destList = (prev[dest] || []).filter((x) => x.id !== item.id);
      next[dest] = [item, ...destList];
      return next;
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

  const addBookmark = useCallback((item) => {
    setBookmarks((prev) => [item, ...(prev || [])]);
  }, []);

  const updateBookmark = useCallback((item) => {
    setBookmarks((prev) => (prev || []).map((x) => (x.id === item.id ? item : x)));
  }, []);

  const removeBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev || []).filter((x) => x.id !== id));
  }, []);

  const pinBookmarkFromUrl = useCallback(
    async (url, meta = {}) => {
      const normalized = normalizeBookmarkUrl(url);
      if (!normalized) {
        fireToast("Invalid URL", "xp");
        return;
      }
      const existing = (bookmarks || []).find((b) => b.url === normalized);
      if (existing) {
        fireToast("Already in Bookmarks", "xp");
        openKit("bookmarks");
        return;
      }
      const kind = detectBookmarkKind(normalized);
      const item = {
        id: createBookmarkId(),
        url: normalized,
        kind,
        title: meta.title || defaultTitleForUrl(normalized),
        note: meta.note || undefined,
        preview: seedPreviewFromUrl(normalized),
        createdAt: Date.now(),
      };
      addBookmark(item);
      fireToast("Pinned to Bookmarks", "day");
      try {
        const res = await fetch("/api/bookmarks/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.preview) {
          updateBookmark(
            applyPreviewToBookmark(item, data.preview, { overwriteTitle: !meta.title }),
          );
        }
      } catch {
        /* keep seed */
      }
    },
    [bookmarks, addBookmark, updateBookmark, fireToast, openKit],
  );

  const captureDayToKit = useCallback(
    (day) => {
      if (!day) return;
      const dayNote = (notes[day.id] || "").trim();
      const topicLine = (day.topics || []).slice(0, 4).join(" · ");
      const body = [
        dayNote || null,
        topicLine ? `From Day ${day.day}: ${topicLine}` : `From Day ${day.day}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const firstTopic = String(day.topics?.[0] || "").trim();
      setKitSeed({
        title: firstTopic
          ? `Day ${day.day} · ${firstTopic.slice(0, 72)}`
          : `Day ${day.day} rabbit hole`,
        body,
        date: dateKey(),
        tags: ["tip"],
      });
      setKitTab("learned");
      setPage("kit");
      fireToast("Opened Field Kit · edit & pin", "day");
    },
    [notes, setKitTab, setPage, fireToast],
  );

  const handleReset = useCallback(async () => {
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    setLearned({});
    setBookmarks([]);
    if (cloudUserId) {
      void pushCloudSnapshot(
        {
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
          userdata: emptyUserSnapshot(),
        },
        cloudBaseUpdatedAt.current,
      ).then((result) => {
        if (result.ok) cloudBaseUpdatedAt.current = result.updatedAt;
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
      { progress, notes, refs, srs, log, learned, bookmarks },
      planId,
    );
    setProgress(purged.progress);
    setNotes(purged.notes);
    setRefs(purged.refs);
    setSrs(purged.srs);
    setLog(purged.log);
    setLearned(purged.learned || {});
    setBookmarks(purged.bookmarks || []);
    if (activePlanId === planId) {
      const remaining = Object.values(plans).filter((p) => p.id !== planId && !p.hidden);
      setActivePlanId(remaining[0]?.id || BUILTIN_365_ID);
    }
    setConfirmDeletePlanId(null);
    fireToast("Plan deleted", "xp");
  }, [plans, activePlanId, progress, notes, refs, srs, log, learned, bookmarks, fireToast]);

  // Curated example curricula — opt-in starters (tech + non-tech), not auto-assigned.
  const examplePlans = useMemo(
    () => [
      {
        ...createBuiltin30Mind(),
        blurb: "A 30-day sprint through habits, bias, learning science, and decision-making — any learner, not just engineers.",
      },
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
      const plan = createBuiltinById(planId);
      if (!plan) return prev;
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
      setBookmarks(sanitizeBookmarks(s.bookmarks));
      if (s.themeKey) setThemeKey(resolveThemeKey(s.themeKey));
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

  const kitWeekDigest = useMemo(
    () => buildKitWeekDigest(learned, bookmarks),
    [learned, bookmarks],
  );

  if (saveStatus === "loading") {
    // Same hydrate shell until Neon snapshot (or signed-out landing) is ready.
    // after mount, so branching here would flash or rematch incorrectly.
    return (
      <div className="app-root" style={rootStyle}>
        <AppHydrateSkeleton />
      </div>
    );
  }

  // Dashboard needs a campaign; Field Kit does not (off-plan side channel).
  const onDashboard = page === "dashboard" && !!campaign;
  const onKit = page === "kit";
  const learnedCount = countLearned(learned);
  const bookmarkCount = Array.isArray(bookmarks) ? bookmarks.length : 0;
  const kitAccent = campaign?.accent || theme.accents?.main || "var(--accent)";

  const topBarShared = {
    stats: globalStats,
    onOpenData: () => setModal({ kind: "export" }),
    onOpenSettings: () => setModal({ kind: "settings" }),
    onOpenAccount: () => setModal({ kind: "account" }),
    accountLabel: session?.user?.email || null,
    onNewPlan: () => setModal({ kind: "builder" }),
    themeKey,
    setThemeKey,
    fontKey,
    setFontKey,
    saveStatus,
    onRetrySync: retryCloudSync,
    noteCount: Object.keys(notes).length,
    confirmReset,
    setConfirmReset,
    onReset: handleReset,
    onOpenBadges: () => setModal({ kind: "badges" }),
    badgeCount: badgeStatuses.filter((s) => s.unlocked).length,
    badgeTotal: badgeStatuses.length,
    onGoHome: () => setPage("home"),
    onOpenPricing: () => setModal({ kind: "pricing" }),
    kitTab: onKit ? kitTab : null,
    learnedCount,
    bookmarkCount,
    onOpenKit: openKit,
    onOpenCampaign: campaign ? () => setPage("dashboard") : undefined,
  };

  if (!onDashboard && !onKit) {
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
    // Fixed Briefing skin — same for every visitor; dashboard themes stay personal.
    const homeTheme = LANDING_THEME;
    const homeFont = FONT_PACKS.archivo;
    const homeStyle = { ...themeVars(homeTheme), ...fontVars(homeFont) };
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
          onOpenBuilder={() => setModal({ kind: "builder" })}
          onOpenAccount={() => setModal({ kind: "account" })}
          onOpenPricing={() => setModal({ kind: "pricing" })}
          accountLabel={session?.user?.email || null}
          onRequireAuth={requireAuth}
          onStartWithAccount={startWithAccount}
          onGoDashboard={() => requireAuth(() => setPage("dashboard"))}
          onOpenKit={openKit}
          learnedCount={learnedCount}
          bookmarkCount={bookmarkCount}
        />
        {modal && (
          <ModalHost
            modal={modal}
            onClose={() => {
              pendingAuthAction.current = null;
              setModal(null);
            }}
            notes={notes}
            refs={refs}
            setRef={setRef}
            appendNote={appendNote}
            progress={progress}
            srs={srs}
            log={log}
            learned={learned}
            bookmarks={bookmarks}
            themeKey={themeKey}
            onImport={applyImport}
            fireToast={fireToast}
            plans={plans}
            activePlanId={activePlanId}
            onAccountAuthenticated={handleAccountAuthenticated}
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

  if (onKit) {
    return (
      <ThemeCtx.Provider value={{ theme, domainColors }}>
        <div
          className={classNames(
            "app-root",
            "kit-root",
            theme.mode === "light" && "is-light",
            !theme.effects && "no-fx",
          )}
          style={rootStyle}
        >
          <BackgroundFX accent={kitAccent} effects={theme.effects} />
          <TopBar {...topBarShared} />
          <FieldKitChrome
            tab={kitTab}
            setTab={setKitTab}
            learnedCount={learnedCount}
            bookmarkCount={bookmarkCount}
            hasCampaign={!!campaign}
            onBackToCampaign={() => setPage("dashboard")}
            accent={kitAccent}
            lensQuery={kitQuery}
            setLensQuery={setKitQuery}
          />
          {kitTab === "learned" ? (
            <LearnedView
              learned={learned}
              onAdd={addLearned}
              onUpdate={updateLearned}
              onRemove={removeLearned}
              accent={kitAccent}
              fireToast={fireToast}
              focusDate={kitFocusDate}
              onFocusDateConsumed={() => setKitFocusDate(null)}
              onOpenBookmarks={() => setKitTab("bookmarks")}
              lensQuery={kitQuery}
              onLensQueryChange={setKitQuery}
              kitSeed={kitSeed}
              onKitSeedConsumed={() => setKitSeed(null)}
              onPinBookmark={pinBookmarkFromUrl}
            />
          ) : (
            <BookmarksView
              bookmarks={bookmarks}
              onAdd={addBookmark}
              onUpdate={updateBookmark}
              onRemove={removeBookmark}
              accent={kitAccent}
              fireToast={fireToast}
              onOpenNotes={() => setKitTab("learned")}
              lensQuery={kitQuery}
              onLensQueryChange={setKitQuery}
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
              bookmarks={bookmarks}
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
          <Footer />
        </div>
      </ThemeCtx.Provider>
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
        <TopBar {...topBarShared} />
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
        <CampaignHero
          campaign={campaign}
          stats={stats}
          progress={progress}
          onToggle={handleToggleTopic}
        />

        {(onThisDayMemory && !onThisDayDismissed) ||
        kitWeekDigest.slipCount > 0 ||
        kitWeekDigest.bookmarkCount > 0 ? (
          <div className="today-widgets-row">
            {onThisDayMemory && !onThisDayDismissed && (
              <OnThisDayCard
                memory={onThisDayMemory}
                onDismiss={dismissOnThisDay}
                onOpen={(memory) => {
                  if (memory?.kind === "journal" && memory.date) {
                    openKitToDate(memory.date);
                  }
                }}
              />
            )}
            {(kitWeekDigest.slipCount > 0 || kitWeekDigest.bookmarkCount > 0) && (
              <KitWeekDigestCard
                digest={kitWeekDigest}
                onOpenKit={() => openKit("learned")}
                onOpenSlip={(date) => openKitToDate(date)}
              />
            )}
          </div>
        ) : null}

        <ViewTabs view={view} setView={setView} dueCount={reviewQueue.length} />

        {(view === "console" || view === "grid") && (
          <section className="field-ops" aria-label="Field ops filters">
            <div className="field-ops-mast">
              <span className="field-ops-title">Field ops</span>
              <span className="field-ops-sub">Slice time · scan topics · filter sectors</span>
            </div>
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
            <div className="controls-row">
              <div className="ops-search-col">
                <div className="ops-search-head" aria-hidden="true">
                  <span className="field-ops-kicker">
                    <span className="field-ops-kicker-mark" />
                    <span>Query</span>
                  </span>
                </div>
                <label className="ops-search">
                  <Tip content="Filter days by topic text or notes. Cleared when you leave." stamp="FIND" tone="sky" side="bottom">
                    <span className="ops-search-label">Find</span>
                  </Tip>
                  <Icon.Search size={14} />
                  <input
                    className="ops-search-input"
                    placeholder={`Search ${campaign.totalDays} days of topics…`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query.trim() && (
                    <Tip content="Clear the search filter" stamp="CLR" tone="coral" side="bottom">
                      <button
                        type="button"
                        className="ops-search-clear"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <Icon.X size={14} />
                      </button>
                    </Tip>
                  )}
                </label>
              </div>
              <DomainLegend
                tally={stats.domainTally}
                active={domainFilter}
                setActive={setDomainFilter}
              />
            </div>
          </section>
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
            onCaptureToKit={captureDayToKit}
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
            bookmarks={bookmarks}
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
