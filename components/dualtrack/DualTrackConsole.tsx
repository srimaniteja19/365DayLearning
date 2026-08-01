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
import { usePathname, useRouter } from "next/navigation";
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
import { buildConstellationGraph, layoutConstellation } from "@/lib/constellation";
import { accentForPlan } from "@/lib/accents";
import { purgePlanUserData } from "@/lib/migration";
import { exportAll, serializeExport } from "@/lib/exportImport";
import { downloadText } from "@/lib/fileIo";
import {
  BUILTIN_365_ID,
  MAX_SNAPSHOT_CHARS,
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
  applyTopicResourcePair,
  collectPendingTopicSlots,
  enrichPlanResources,
  generateTopicResourcePair,
} from "@/lib/topicResources";
import { sanitizePlanDays } from "@/lib/planEdit";
import { findPlanByRouteSegment, planRouteSegment } from "@/lib/planRoute";

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
  ConstellationView,
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
import { FavoritesView } from "@/features/favorites/FavoritesView";
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

const DASHBOARD_VIEWS = ["console", "grid", "review", "weekly", "log", "constellation"];
const KIT_TABS = ["learned", "bookmarks", "favorites"];
const normalizeKitTab = (tab) => (KIT_TABS.includes(tab) ? tab : "learned");

function parseDashboardRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean).slice(1);
  if (parts[0] === "kit") {
    return { page: "kit", kitTab: normalizeKitTab(parts[1]) };
  }
  return {
    page: "dashboard",
    planSegment: parts[0] || null,
    view: DASHBOARD_VIEWS.includes(parts[1]) ? parts[1] : "console",
  };
}

export default function DualTrackConsole() {
  const [plans, setPlans] = useState({});
  const [activePlanId, setActivePlanId] = useState(BUILTIN_365_ID);
  const [progress, setProgress] = useState({});
  const [notes, setNotes] = useState({});
  const [learned, setLearned] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
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

  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const hydrateGen = useRef(0);
  /** Last server `updatedAt` we pulled/pushed — used for conflict detection. */
  const cloudBaseUpdatedAt = useRef(null);
  const warnedSnapshotSizeRef = useRef(false);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const route = useMemo(() => parseDashboardRoute(pathname || "/dashboard"), [pathname]);
  const cloudUserId = session?.user?.id || null;
  const pendingAuthAction = useRef(null);
  const [syncRetryToken, setSyncRetryToken] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState("free");

  const routePlan = useMemo(
    () => findPlanByRouteSegment(plans, route.planSegment),
    [plans, route.planSegment],
  );
  const page = route.page;
  const view = route.view || "console";
  const kitTab = route.kitTab || "learned";
  const selectedPlanId = routePlan?.id || activePlanId;

  const hrefFor = useCallback((next = {}) => {
    const nextPage = next.page || page;
    if (nextPage === "home") return "/";
    if (nextPage === "kit") {
      return `/dashboard/kit/${next.kitTab || kitTab}`;
    }
    const planId = next.planId || selectedPlanId;
    const plan = next.plan || plans[planId];
    const segment = plan ? encodeURIComponent(planRouteSegment(plan)) : encodeURIComponent(planId);
    const nextView = DASHBOARD_VIEWS.includes(next.view) ? next.view : view;
    return `/dashboard/${segment}/${nextView}`;
  }, [kitTab, page, plans, selectedPlanId, view]);

  const goTo = useCallback((next) => {
    const planId = next?.planId || next?.plan?.id;
    if (planId && planId !== activePlanId) setActivePlanId(planId);
    router.push(hrefFor(next), { scroll: false });
  }, [activePlanId, hrefFor, router]);

  const setView = useCallback(
    (nextView) => goTo({ page: "dashboard", view: nextView }),
    [goTo],
  );
  const setKitTab = useCallback((nextTab) => goTo({ page: "kit", kitTab: nextTab }), [goTo]);
  const selectPlan = useCallback(
    (planId) => goTo({ page: "dashboard", planId, view: "console" }),
    [goTo],
  );

  useEffect(() => {
    if (routePlan && routePlan.id !== activePlanId) setActivePlanId(routePlan.id);
  }, [routePlan, activePlanId]);

  useEffect(() => {
    if (!cloudUserId) {
      setCachedSubscriptionTier(null);
      setSubscriptionTier("free");
      return;
    }
    let cancelled = false;
    fetchSubscriptionStatus().then((res) => {
      if (cancelled || !res.ok) return;
      setCachedSubscriptionTier(res.usage.tier);
      setSubscriptionTier(res.usage.tier);
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

  /** When set, LearnedView/BookmarksView expand + scroll to this entry id (e.g. Constellation). */
  const [kitFocusEntryId, setKitFocusEntryId] = useState(null);
  const [kitFocusBookmarkId, setKitFocusBookmarkId] = useState(null);

  const openKit = useCallback(
    (tab = "learned", focusId = null) => {
      requireAuth(() => {
        const normalized = normalizeKitTab(tab);
        if (focusId) {
          if (normalized === "learned") setKitFocusEntryId(focusId);
          else if (normalized === "bookmarks") setKitFocusBookmarkId(focusId);
        }
        goTo({ page: "kit", kitTab: normalized });
      });
    },
    [goTo, requireAuth],
  );

  /** When set, LearnedView jumps Chrono to this YYYY-MM-DD (e.g. On This Day). */
  const [kitFocusDate, setKitFocusDate] = useState(null);
  const [kitQuery, setKitQuery] = useState("");
  const [kitSeed, setKitSeed] = useState(null);
  /**
   * Kit tabs stay mounted once visited (for instant, glitch-free re-switching),
   * but must NOT mount eagerly — Notes renders a link-preview embed per linked
   * slip on the whole board, so mounting it just because Bookmarks was opened
   * fires a burst of /api/bookmarks/preview requests nobody asked for.
   */
  const [visitedKitTabs, setVisitedKitTabs] = useState(() => new Set());
  useEffect(() => {
    if (page !== "kit") return;
    setVisitedKitTabs((prev) => (prev.has(kitTab) ? prev : new Set(prev).add(kitTab)));
  }, [page, kitTab]);
  const openKitToDate = useCallback(
    (dateStr) => {
      requireAuth(() => {
        setKitFocusDate(dateStr || null);
        goTo({ page: "kit", kitTab: "learned" });
      });
    },
    [goTo, requireAuth],
  );

  const resolvedThemeKey = resolveThemeKey(themeKey);
  const theme = THEMES[resolvedThemeKey] || THEMES[DEFAULT_THEME_KEY];
  const fontPack = FONT_PACKS[resolveFontKey(fontKey)] || FONT_PACKS[DEFAULT_FONT_KEY];
  const domainColors = DOMAIN_PALETTES[theme.palette];
  const isNeoTheme = resolvedThemeKey === "doodle";
  const rootStyle = {
    ...themeVars(theme),
    ...fontVars(fontPack),
    ...(isNeoTheme
      ? {
          "--sans": "var(--font-inter), sans-serif",
          "--display": "var(--font-space), sans-serif",
          "--mono": "var(--font-jetbrains), ui-monospace, monospace",
        }
      : {}),
  };

  const visiblePlans = useMemo(
    () => Object.values(plans).filter((p) => !p.hidden),
    [plans],
  );
  const subscription = tierDef(subscriptionTier);

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

  const requestNewPlan = useCallback(() => {
    requireAuth(() => {
      if (subscription.activeCampaignLimit != null && visiblePlans.length >= subscription.activeCampaignLimit) {
        fireToast(`${subscription.rankLabel} supports ${subscription.activeCampaignLimit} active campaign${subscription.activeCampaignLimit === 1 ? "" : "s"}. Upgrade to add another.`, "warn");
        return;
      }
      setModal({ kind: "builder" });
    });
  }, [fireToast, requireAuth, subscription, visiblePlans.length]);

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

  // A bare dashboard URL is the sole storage fallback. Every canonical route
  // is driven by the pathname, so browser history never fights component state.
  useEffect(() => {
    if (pathname !== "/dashboard" || !cloudReady) return;
    try {
      const storedPage = window.sessionStorage.getItem("dualtrack:page");
      const storedView = window.sessionStorage.getItem("dualtrack:view");
      const storedKitTab = window.sessionStorage.getItem("dualtrack:kit-tab");
      const storedPlanId = window.sessionStorage.getItem("dualtrack:plan");
      const page = storedPage === "kit" ? "kit" : "dashboard";
      router.replace(hrefFor({
        page,
        planId: storedPlanId && plans[storedPlanId] ? storedPlanId : selectedPlanId,
        view: DASHBOARD_VIEWS.includes(storedView) ? storedView : "console",
        kitTab: normalizeKitTab(storedKitTab),
      }), { scroll: false });
    } catch {
      // best-effort only
    }
  }, [cloudReady, hrefFor, pathname, plans, router, selectedPlanId]);

  useEffect(() => {
    if (pathname === "/dashboard") return;
    try {
      window.sessionStorage.setItem("dualtrack:page", page);
      window.sessionStorage.setItem("dualtrack:plan", selectedPlanId);
      window.sessionStorage.setItem("dualtrack:view", view);
      window.sessionStorage.setItem("dualtrack:kit-tab", kitTab);
    } catch {
      // best-effort only
    }
  }, [kitTab, page, pathname, selectedPlanId, view]);

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
    const nextPlans = {};
    for (const [id, plan] of Object.entries(snap.plans || {})) {
      nextPlans[id] = sanitizePlanDays(plan);
    }
    setPlans(nextPlans);
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
    return nextPlans;
  }, []);

  const enrichAbortRef = useRef(new Map());
  const enrichingRef = useRef(new Set());
  /** Plans we've already kicked off enrichment for this session (avoids conflict spirals). */
  const enrichAttemptedRef = useRef(new Set());
  const builderOpenRef = useRef(false);
  useEffect(() => {
    builderOpenRef.current = modal?.kind === "builder";
  }, [modal?.kind]);

  const [generatingTopicKey, setGeneratingTopicKey] = useState(null);

  const handleGenerateTopicResources = useCallback(
    async (day, topicIndex) => {
      const key = `${day.id}:${topicIndex}`;
      if (generatingTopicKey) return;
      const title = day.topics?.[topicIndex];
      if (!title) return;
      setGeneratingTopicKey(key);
      try {
        const pair = await generateTopicResourcePair({
          title,
          domain: day.domains?.[topicIndex],
        });
        setPlans((prev) => {
          const plan = prev[activePlanId];
          if (!plan) return prev;
          const dayIndex = plan.days.findIndex((d) => d.id === day.id);
          if (dayIndex < 0) return prev;
          return {
            ...prev,
            [plan.id]: applyTopicResourcePair(plan, dayIndex, topicIndex, pair),
          };
        });
        const found = !!(pair.article?.url || pair.video?.url);
        fireToast(
          found
            ? "Resources ready · article + video"
            : "No resources found for that topic",
          found ? "day" : "warn",
        );
      } catch (err) {
        console.warn("[topic-resources] generate failed", err);
        fireToast("Could not generate resources", "warn");
      } finally {
        setGeneratingTopicKey(null);
      }
    },
    [activePlanId, fireToast, generatingTopicKey],
  );

  const closeModal = useCallback(() => {
    pendingAuthAction.current = null;
    setModal(null);
  }, []);

  /** Progressive OpenRouter web_search fill for topic resource links (fail-soft). */
  const startResourceEnrichment = useCallback((plan, { force = false } = {}) => {
    if (!plan?.id || plan.hidden) return;
    if (!subscription.automaticResourceEnrichment) return;
    if (builderOpenRef.current && !force) return;
    if (enrichingRef.current.has(plan.id)) return;
    if (!force && enrichAttemptedRef.current.has(plan.id)) return;
    if (!collectPendingTopicSlots(plan).length) {
      enrichAttemptedRef.current.add(plan.id);
      return;
    }

    enrichAttemptedRef.current.add(plan.id);
    enrichingRef.current.add(plan.id);
    const prevAc = enrichAbortRef.current.get(plan.id);
    prevAc?.abort();
    const ac = new AbortController();
    enrichAbortRef.current.set(plan.id, ac);

    enrichPlanResources({
      plan,
      signal: ac.signal,
      onPlanUpdate: (next) => {
        setPlans((prev) => {
          const cur = prev[plan.id];
          if (!cur) return prev;
          const days = cur.days.map((day) => {
            const enriched = next.days.find((d) => d.id === day.id);
            if (!enriched?.resources) return day;
            return { ...day, resources: enriched.resources };
          });
          return { ...prev, [plan.id]: { ...cur, days } };
        });
      },
    })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[topic-resources] enrich failed", plan.id, err);
      })
      .finally(() => {
        enrichingRef.current.delete(plan.id);
        if (enrichAbortRef.current.get(plan.id) === ac) {
          enrichAbortRef.current.delete(plan.id);
        }
      });
  }, [subscription.automaticResourceEnrichment]);

  const enrichPlansMap = useCallback((plansMap, { force = false } = {}) => {
    if (builderOpenRef.current && !force) return;
    for (const plan of Object.values(plansMap || {})) {
      startResourceEnrichment(plan, { force });
    }
  }, [startResourceEnrichment]);

  const handlePlanCreated = useCallback(
    (plan) => {
      const cleaned = sanitizePlanDays(plan);
      setPlans((prev) => ({ ...prev, [cleaned.id]: cleaned }));
      setScope("all");
      goTo({ page: "dashboard", planId: cleaned.id, plan: cleaned, view: "console" });
      fireToast(`Plan ready · ${cleaned.totalDays} days`, "day");
      // Defer enrichment until after the page transition settles.
      window.setTimeout(() => startResourceEnrichment(cleaned), 1500);
    },
    [fireToast, goTo, startResourceEnrichment],
  );

  // Catch up resource enrichment after the builder closes (deferred while open).
  useEffect(() => {
    if (!cloudReady) return;
    if (modal?.kind === "builder") return;
    const t = window.setTimeout(() => enrichPlansMap(plans), 1200);
    return () => window.clearTimeout(t);
    // Intentionally omit `plans` / enrichPlansMap identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady, modal?.kind]);

  useEffect(() => {
    return () => {
      for (const ac of enrichAbortRef.current.values()) ac.abort();
      enrichAbortRef.current.clear();
      enrichingRef.current.clear();
    };
  }, []);

  // Unsigned users stay on the landing page — no guest dashboard/kit.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!cloudUserId) router.replace("/");
  }, [sessionStatus, cloudUserId, router]);

  // Neon is the source of truth — load/save account snapshots from Postgres only.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    const gen = ++hydrateGen.current;
    setCloudReady(false);

    if (!cloudUserId) {
      resetWorkspace();
      cloudBaseUpdatedAt.current = null;
      warnedSnapshotSizeRef.current = false;
      setSaveStatus("off");
      return;
    }

    let cancelled = false;
    (async () => {
      setSaveStatus("loading");
      resetWorkspace();
      cloudBaseUpdatedAt.current = null;
      warnedSnapshotSizeRef.current = false;
      const result = await pullCloudSnapshot();
      if (cancelled || gen !== hydrateGen.current) return;
      if (result.ok && result.snapshot) {
        const nextPlans = applyCloudSnapshot(result.snapshot);
        cloudBaseUpdatedAt.current = result.updatedAt;
        fireToast("Synced from your account");
        // Defer enrichment so the first cloud save / UI settle isn't raced.
        window.setTimeout(() => enrichPlansMap(nextPlans), 2500);
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
  }, [sessionStatus, cloudUserId, resetWorkspace, applyCloudSnapshot, enrichPlansMap, fireToast]);

  const flushCloudSnapshot = useCallback(
    async (opts) => {
      if (!cloudReady || !cloudUserId) return false;
      const localSnapshot = buildSnapshot();
      // log/learned/bookmarks are synced via their own per-record
      // endpoints now (see handleToggleTopic/addLearned/addBookmark
      // etc. below) — emptied here (not omitted) so AppSnapshot's type
      // stays unchanged everywhere, including localSnapshot itself,
      // which the conflict-recovery-stash export below still uses in
      // full.
      const syncPayload = {
        ...localSnapshot,
        userdata: { ...localSnapshot.userdata, log: [], learned: {}, bookmarks: [] },
      };
      const payloadSize = JSON.stringify(syncPayload).length;
      if (payloadSize >= MAX_SNAPSHOT_CHARS * 0.6 && !warnedSnapshotSizeRef.current) {
        warnedSnapshotSizeRef.current = true;
        fireToast(
          "Your account data is getting large — export a backup or trim old notes soon.",
          "warn",
        );
      }
      const result = await pushCloudSnapshot(
        syncPayload,
        cloudBaseUpdatedAt.current,
        opts,
      );
      if (result.ok) {
        cloudBaseUpdatedAt.current = result.updatedAt;
        return true;
      }
      if (result.conflict) {
        if (result.reason === "schema-version") {
          fireToast("App updated on another device — refreshing page...", "warn");
          window.setTimeout(() => window.location.reload(), 1200);
          return true;
        }
        if (result.snapshot) {
          const recoveryPayload = exportAll({
            plans: localSnapshot.plans,
            userdata: localSnapshot.userdata,
            themeKey: localSnapshot.meta.themeKey,
            activePlanId: localSnapshot.meta.activePlanId,
          });
          const recoveryJson = serializeExport(recoveryPayload);
          const recoveryFilename = `refrainly-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
          const downloaded = downloadText(recoveryFilename, recoveryJson, "application/json");
          if (!downloaded) {
            try {
              window.localStorage.setItem("refrainly:conflict-recovery", recoveryJson);
            } catch {
              /* best-effort; nothing more we can do if storage is unavailable */
            }
          }
          applyCloudSnapshot(result.snapshot);
          // Do not re-kick enrichment here — that races with in-flight saves.
          fireToast(
            downloaded
              ? "Your recent changes were saved to a recovery file."
              : "Your recent changes were saved locally for recovery.",
            "warn",
          );
        } else {
          fireToast(result.error || "Cloud data changed elsewhere — reloaded.", "warn");
        }
        cloudBaseUpdatedAt.current = result.updatedAt ?? cloudBaseUpdatedAt.current;
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
    if (cloudUserId) {
      fetch("/api/learned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: date, item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

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
    if (cloudUserId) {
      fetch("/api/learned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey: dest, item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

  const removeLearned = useCallback((date, id) => {
    setLearned((prev) => {
      const list = (prev[date] || []).filter((x) => x.id !== id);
      const next = { ...prev };
      if (list.length) next[date] = list;
      else delete next[date];
      return next;
    });
    if (cloudUserId) {
      fetch(`/api/learned?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    }
  }, [cloudUserId]);

  const addBookmark = useCallback((item) => {
    setBookmarks((prev) => [item, ...(prev || [])]);
    if (cloudUserId) {
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

  const updateBookmark = useCallback((item) => {
    setBookmarks((prev) => (prev || []).map((x) => (x.id === item.id ? item : x)));
    if (cloudUserId) {
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      }).catch(() => {});
    }
  }, [cloudUserId]);

  const removeBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev || []).filter((x) => x.id !== id));
    if (cloudUserId) {
      fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    }
  }, [cloudUserId]);

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
      goTo({ page: "kit", kitTab: "learned" });
      fireToast("Opened Field Kit · edit & pin", "day");
    },
    [notes, goTo, fireToast],
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
      void fetch("/api/log?all=true", { method: "DELETE" }).catch(() => {});
      void fetch("/api/learned?all=true", { method: "DELETE" }).catch(() => {});
      void fetch("/api/bookmarks?all=true", { method: "DELETE" }).catch(() => {});
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
        goTo({ page: "dashboard", planId: next?.id || BUILTIN_365_ID, plan: next, view: "console" });
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
    if (cloudUserId) {
      fetch(`/api/log?planId=${encodeURIComponent(planId)}`, { method: "DELETE" }).catch(() => {});
    }
    if (activePlanId === planId) {
      const remaining = Object.values(plans).filter((p) => p.id !== planId && !p.hidden);
      goTo({ page: "dashboard", planId: remaining[0]?.id || BUILTIN_365_ID, plan: remaining[0], view: "console" });
    }
    setConfirmDeletePlanId(null);
    fireToast("Plan deleted", "xp");
  }, [plans, activePlanId, progress, notes, refs, srs, log, learned, bookmarks, fireToast, cloudUserId, goTo]);

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
    const existing = plans[planId];
    const candidate = existing || createBuiltinById(planId);
    const wouldActivate = !existing || existing.hidden;
    if (!candidate) return;
    if (candidate.totalDays > subscription.maxCampaignDays) {
      fireToast(`${subscription.rankLabel} supports campaigns up to ${subscription.maxCampaignDays} days.`, "warn");
      return;
    }
    if (wouldActivate && subscription.activeCampaignLimit != null && visiblePlans.length >= subscription.activeCampaignLimit) {
      fireToast(`${subscription.rankLabel} supports ${subscription.activeCampaignLimit} active campaign${subscription.activeCampaignLimit === 1 ? "" : "s"}. Upgrade to add another.`, "warn");
      return;
    }
    let added = null;
    setPlans((prev) => {
      if (prev[planId]) {
        added = { ...prev[planId], hidden: false };
        return { ...prev, [planId]: added };
      }
      const plan = createBuiltinById(planId);
      if (!plan) return prev;
      added = plan;
      return { ...prev, [plan.id]: plan };
    });
    setScope("all");
    goTo({ page: "dashboard", planId, plan: added, view: "console" });
    fireToast("Plan added", "day");
    // Defer enrichment so the home→dashboard transition isn't fighting sync writes.
    if (added) {
      window.setTimeout(() => startResourceEnrichment(added), 1500);
    }
  }, [fireToast, goTo, plans, startResourceEnrichment, subscription, visiblePlans.length]);

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
    if (cloudUserId) {
      if (willBeDone) {
        fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day: day.id, topicIndex: idx }),
        }).catch(() => {});
      } else {
        fetch(`/api/log?day=${encodeURIComponent(day.id)}&topicIndex=${idx}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    }

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
  }, [progress, setTopicDone, fireToast, cloudUserId]);

  const gradeReview = useCallback((dayId, outcome) => {
    const now = Date.now();
    setSrs((prev) => ({ ...prev, [dayId]: nextReview(prev[dayId], outcome, now) }));
  }, []);

  const applyImport = useCallback((result) => {
    if (!result || typeof result !== "object") throw new Error("Not a Refrainly backup file");
    if (result.kind === "plan") {
      setPlans(result.plans);
      enrichPlansMap(result.plans);
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
      enrichPlansMap(s.plans);
      return;
    }
    throw new Error("Unrecognized import payload");
  }, [enrichPlansMap]);

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

  const constellationCompletedDays = useMemo(
    () => (campaign?.days || []).filter(isDayComplete),
    [campaign, isDayComplete],
  );
  const constellationGraph = useMemo(
    () => buildConstellationGraph({ completedDays: constellationCompletedDays, learned, bookmarks }),
    [constellationCompletedDays, learned, bookmarks],
  );
  const [constellationShuffleSeed, setConstellationShuffleSeed] = useState(0);
  const constellationNodes = useMemo(
    () => layoutConstellation(constellationGraph.nodes, constellationGraph.edges, constellationShuffleSeed),
    [constellationGraph, constellationShuffleSeed],
  );
  const handleShuffleConstellation = useCallback(() => setConstellationShuffleSeed((s) => s + 1), []);
  const handleOpenConstellationNode = useCallback(
    (node) => {
      if (node.type === "day") {
        if (!constellationCompletedDays.some((d) => d.id === node.refId)) return;
        goTo({ page: "dashboard", view: "console" });
        setExpandedDay(node.refId);
        setScope("all");
      } else if (node.type === "learned") {
        openKit("learned", node.refId);
      } else if (node.type === "bookmark") {
        openKit("bookmarks", node.refId);
      }
    },
    [constellationCompletedDays, goTo, openKit],
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

  const favoriteCount = useMemo(() => {
    const noteFavs = Object.values(learned || {}).reduce(
      (n, items) => n + (items || []).filter((it) => it.favorite).length,
      0,
    );
    const bookmarkFavs = (bookmarks || []).filter((b) => b.favorite).length;
    return noteFavs + bookmarkFavs;
  }, [learned, bookmarks]);

  if (saveStatus === "loading") {
    // Same hydrate shell until Neon snapshot (or signed-out landing) is ready.
    // after mount, so branching here would flash or rematch incorrectly.
    return (
      <div className={classNames("app-root", isNeoTheme && "theme-neo", theme.mode === "light" && "is-light")} style={rootStyle}>
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
    onNewPlan: requestNewPlan,
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
    onGoHome: () => router.push("/"),
    onOpenPricing: () => setModal({ kind: "pricing" }),
    kitTab: onKit ? kitTab : null,
    learnedCount,
    bookmarkCount,
    favoriteCount,
    onOpenKit: openKit,
    onOpenCampaign: campaign ? () => goTo({ page: "dashboard" }) : undefined,
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
    // Fixed neo marketing skin — same for every visitor; dashboard themes stay personal.
    const homeTheme = LANDING_THEME;
    const homeStyle = {
      ...themeVars(homeTheme),
      "--sans": "var(--font-inter), sans-serif",
      "--display": "var(--font-space), sans-serif",
      "--mono": "var(--font-jetbrains), ui-monospace, monospace",
    };
    return (
      <div
        className={classNames(
          "app-root",
          "landing-root",
          "theme-neo",
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
          onOpenBuilder={requestNewPlan}
          onOpenAccount={() => setModal({ kind: "account" })}
          onOpenPricing={() => setModal({ kind: "pricing" })}
          accountLabel={session?.user?.email || null}
          onRequireAuth={requireAuth}
          onStartWithAccount={startWithAccount}
          onGoDashboard={() => requireAuth(() => goTo({ page: "dashboard" }))}
          onOpenKit={openKit}
          learnedCount={learnedCount}
          bookmarkCount={bookmarkCount}
        />
        {modal && (
          <ModalHost
            modal={modal}
            onClose={closeModal}
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
            onPlanCreated={handlePlanCreated}
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
            isNeoTheme && "theme-neo",
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
            favoriteCount={favoriteCount}
            hasCampaign={!!campaign}
            onBackToCampaign={() => goTo({ page: "dashboard" })}
            accent={kitAccent}
            lensQuery={kitQuery}
            setLensQuery={setKitQuery}
          />
          {/* Once a tab has been opened it stays mounted and just toggles visibility,
              so re-switching to it is instant with no remount/reflow/entrance-animation
              blink. But it must NOT mount before that first visit — Notes renders a
              link-preview embed per linked slip on the whole board, so mounting it
              just because Bookmarks was opened fires a burst of unwanted
              /api/bookmarks/preview requests. */}
          {(kitTab === "learned" || visitedKitTabs.has("learned")) && (
            <div className={classNames("kit-panel", kitTab !== "learned" && "kit-panel-hidden")}>
              <LearnedView
                learned={learned}
                onAdd={addLearned}
                onUpdate={updateLearned}
                onRemove={removeLearned}
                accent={kitAccent}
                fireToast={fireToast}
                focusDate={kitFocusDate}
                onFocusDateConsumed={() => setKitFocusDate(null)}
                focusId={kitFocusEntryId}
                onFocusIdConsumed={() => setKitFocusEntryId(null)}
                onOpenBookmarks={() => setKitTab("bookmarks")}
                lensQuery={kitQuery}
                onLensQueryChange={setKitQuery}
                kitSeed={kitSeed}
                onKitSeedConsumed={() => setKitSeed(null)}
                onPinBookmark={pinBookmarkFromUrl}
              />
            </div>
          )}
          {(kitTab === "bookmarks" || visitedKitTabs.has("bookmarks")) && (
            <div className={classNames("kit-panel", kitTab !== "bookmarks" && "kit-panel-hidden")}>
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
                focusId={kitFocusBookmarkId}
                onFocusIdConsumed={() => setKitFocusBookmarkId(null)}
              />
            </div>
          )}
          {(kitTab === "favorites" || visitedKitTabs.has("favorites")) && (
            <div className={classNames("kit-panel", kitTab !== "favorites" && "kit-panel-hidden")}>
              <FavoritesView
                learned={learned}
                bookmarks={bookmarks}
                onUpdateLearned={updateLearned}
                onUpdateBookmark={updateBookmark}
                onJumpToDate={openKitToDate}
                accent={kitAccent}
                fireToast={fireToast}
                lensQuery={kitQuery}
                onLensQueryChange={setKitQuery}
              />
            </div>
          )}
          {modal && (
            <ModalHost
              modal={modal}
              onClose={closeModal}
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
              onPlanCreated={handlePlanCreated}
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
          isNeoTheme && "theme-neo",
          theme.mode === "light" && "is-light",
          !theme.effects && "no-fx",
        )}
        style={rootStyle}
      >
        <BackgroundFX accent={campaign.accent} effects={theme.effects} />
        <TopBar {...topBarShared} />
        <PlanSwitcher
          active={activePlanId}
          setActive={selectPlan}
          campaignStats={campaignStats}
          campaigns={themedPlans}
          confirmDeletePlanId={confirmDeletePlanId}
          setConfirmDeletePlanId={setConfirmDeletePlanId}
          onDeletePlan={handleDeletePlan}
          onNewPlan={requestNewPlan}
        />
        <CampaignHero
          campaign={campaign}
          stats={stats}
          progress={progress}
          onToggle={handleToggleTopic}
          onGenerateTopicResources={handleGenerateTopicResources}
          generatingTopicKey={generatingTopicKey}
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
            onGenerateTopicResources={handleGenerateTopicResources}
            generatingTopicKey={generatingTopicKey}
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
              goTo({ page: "dashboard", view: "console" });
              setExpandedDay(d.id);
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
              setExpandedDay(d.id);
              setScope("all");
              goTo({ page: "dashboard", planId: themedPlans[planId] ? planId : activePlanId, view: "console" });
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
              goTo({ page: "dashboard", view: "console" });
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
        {view === "constellation" && (
          <ConstellationView
            nodes={constellationNodes}
            edges={constellationGraph.edges}
            onOpenNode={handleOpenConstellationNode}
            onShuffle={handleShuffleConstellation}
          />
        )}

        {modal && (
          <ModalHost
            modal={modal}
            onClose={closeModal}
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
            onPlanCreated={handlePlanCreated}
          />
        )}

        <ToastLayer toast={toast} />
        {confetti && <ConfettiBurst key={confetti.id} color={confetti.color} />}
        <Footer />
      </div>
    </ThemeCtx.Provider>
  );
}
