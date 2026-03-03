"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type NewsItem = { title: string; link: string; source: string };

type Props = {
  walletId: string;
  selectedPeriod: "auto" | "month_to_date" | "last_month" | "this_year" | "last_30_days";
  data: {
    anchorYear: number;
    anchorMonth: number;
    prevYear: number;
    prevMonth: number;
    hasAnyTransactions: boolean;
    monthIncome: number;
    monthExpenses: number;
    prevIncome: number;
    prevExpenses: number;
    busiestDay: { date: string; count: number } | null;
    topDays: Array<{ date: string; count: number }>;
    incomeChangePct: number | null;
    subscriptionsSharePct: number;
    diningOutPotentialSave: number;
    topCategory: { name: string; amount: number; sharePct: number } | null;
    subscriptionDetails: Array<{ label: string; amount: number }>;
    expenseTopCategories: Array<{ name: string; amount: number; sharePct: number }>;
    longestNoExpenseStreak: number;
    longestNoExpenseStreakToDate: number;
    savingsRatePct: number;
    monthDiningOut: number;
    prevDiningOut: number;
    diningChangePct: number | null;
    anchorDayCutoff: number;
    analysisPeriod: "month_to_date" | "last_month" | "this_year" | "last_30_days";
    periodStart: string;
    periodEnd: string;
    previousPeriodStart: string;
    previousPeriodEnd: string;
    periodDays: number;
    currentTxCount: number;
    previousTxCount: number;
    categoryEvolution: Array<{ name: string; current: number; previous: number; changePct: number | null }>;
    news: NewsItem[];
    fact: string;
  };
};

function formatMoney(value: number, locale: string) {
  return value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function seededShuffle<T>(items: T[], seed: number) {
  const arr = [...items];
  let s = (seed || 1) >>> 0;
  const rand = () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (ts: number) => {
      const p = Math.min(1, (ts - start) / duration);
      setDisplay(value * p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{display.toFixed(decimals)}{suffix}</span>;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-emerald-500 transition-all duration-700"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          <CountUp value={pct} decimals={1} suffix="%" />
        </p>
      </div>
    </div>
  );
}

function MiniCompareBars({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const max = Math.max(1, a, b);
  const aPct = (a / max) * 100;
  const bPct = (b / max) * 100;
  return (
    <div className="space-y-1.5">
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
          <span>{aLabel}</span>
          <span>{a.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${aPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
          <span>{bLabel}</span>
          <span>{b.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-rose-500" style={{ width: `${bPct}%` }} />
        </div>
      </div>
    </div>
  );
}

type CardModel = {
  id: string;
  pinKey?: string;
  score?: number;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
  className?: string;
  detailsTitle: string;
  detailsBody: React.ReactNode;
};

function hashToUnit(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function HomeSmartBriefing({ walletId, selectedPeriod, data }: Props) {
  const t = useTranslations("home.smart");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [openCard, setOpenCard] = useState<CardModel | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [recentNonPinnedBuckets, setRecentNonPinnedBuckets] = useState<string[][]>([]);
  const cardsScrollRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(() => `j-wallet-home-pinned:${walletId}`, [walletId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setPinnedIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPinnedIds([]);
    }
  }, [storageKey]);

  const persistPinned = (next: string[]) => {
    setPinnedIds(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(Date.UTC(data.anchorYear, data.anchorMonth - 1, 1))
    );
  }, [data.anchorYear, data.anchorMonth, locale]);

  const prevMonthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(Date.UTC(data.prevYear, data.prevMonth - 1, 1))
    );
  }, [data.prevYear, data.prevMonth, locale]);

  const busiestDayLabel = useMemo<string>(() => {
    if (!data.busiestDay) return "—";
    return new Date(`${data.busiestDay.date}T00:00:00`).toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
    });
  }, [data.busiestDay, locale]);

  const periodLabel = useMemo(() => {
    if (data.analysisPeriod === "last_30_days") {
      const from = new Date(`${data.periodStart}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
      const to = new Date(`${data.periodEnd}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
      return `${from} - ${to}`;
    }
    return monthLabel;
  }, [data.analysisPeriod, data.periodStart, data.periodEnd, locale, monthLabel]);

  const previousPeriodLabel = useMemo(() => {
    if (data.analysisPeriod === "last_30_days") {
      const from = new Date(`${data.previousPeriodStart}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
      const to = new Date(`${data.previousPeriodEnd}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
      return `${from} - ${to}`;
    }
    return prevMonthLabel;
  }, [data.analysisPeriod, data.previousPeriodStart, data.previousPeriodEnd, locale, prevMonthLabel]);

  const periodModeLabel = useMemo(() => {
    if (data.analysisPeriod === "last_30_days") return t("periods.last30Days");
    if (data.analysisPeriod === "last_month") return t("periods.lastMonth");
    if (data.analysisPeriod === "this_year") return t("periods.thisYear");
    return t("periods.monthToDate");
  }, [data.analysisPeriod, t]);

  const handlePeriodChange = (period: "auto" | "month_to_date" | "last_month" | "this_year" | "last_30_days") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (period === "auto") {
      params.delete("insightPeriod");
    } else {
      params.set("insightPeriod", period);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const cards = useMemo<CardModel[]>(() => {
    const list: CardModel[] = [];
    const currentDayNote =
      data.analysisPeriod === "last_30_days"
        ? t("cards.lastNDays", { days: data.periodDays })
        : t("cards.dayOfMonth", { day: data.anchorDayCutoff, month: monthLabel });
    const incomeVsExpensePct = data.monthIncome > 0 ? (data.monthExpenses / data.monthIncome) * 100 : 0;

    list.push({
      id: "incomeAmount",
      pinKey: "incomeAmount",
      score: 2,
      title: t("labels.income"),
      value: <>{formatMoney(data.monthIncome, locale)} €</>,
      subtitle: currentDayNote,
      tone: "success",
      detailsTitle: t("labels.income"),
      detailsBody: <p className="text-sm"><strong>{formatMoney(data.monthIncome, locale)} €</strong></p>,
    });

    list.push({
      id: "expenseAmount",
      pinKey: "expenseAmount",
      score: 2,
      title: t("labels.expenses"),
      value: <>{formatMoney(data.monthExpenses, locale)} €</>,
      subtitle: currentDayNote,
      tone: "danger",
      detailsTitle: t("labels.expenses"),
      detailsBody: <p className="text-sm"><strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>,
    });

    const baseNet = data.monthIncome - data.monthExpenses;
    list.push({
      id: "netFlowBase",
      pinKey: "netFlowBase",
      score: Math.min(10, Math.abs(baseNet) / 50 + 2),
      title: t("stories.netFlow"),
      value: <>{formatMoney(baseNet, locale)} €</>,
      subtitle: t("stories.incomeVsExpenses"),
      tone: baseNet >= 0 ? "success" : "danger",
      detailsTitle: t("stories.netFlow"),
      detailsBody: (
        <div className="space-y-2 text-sm">
          <p>{t("labels.income")}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>
          <p>{t("labels.expenses")}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>
        </div>
      ),
    });

    if (data.incomeChangePct != null) {
      const positive = data.incomeChangePct >= 0;
      list.push({
        id: "incomeTrend",
        pinKey: "incomeTrend",
        title: t("cards.incomeTrend"),
        value: (
          <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {positive ? "+" : ""}<CountUp value={data.incomeChangePct} decimals={1} suffix="%" />
          </span>
        ),
        subtitle: positive ? `${t("cards.vsLastMonth")} 🎉` : t("cards.vsLastMonth"),
        score: Math.min(20, Math.abs(data.incomeChangePct) / 3 + (positive ? 3 : 1)),
        tone: positive ? "success" : "danger",
        detailsTitle: t("cards.incomeTrend"),
        detailsBody: (
          <div className="space-y-3 text-sm">
            <p>{currentDayNote}</p>
            <p>{periodLabel}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>
            <p>{previousPeriodLabel}: <strong>{formatMoney(data.prevIncome, locale)} €</strong></p>
          </div>
        ),
      });
    }

    if (data.diningChangePct != null) {
      const lessSpending = data.diningChangePct < 0;
      list.push({
        id: "diningTrend",
        pinKey: "diningTrend",
        title: t("cards.diningTrend"),
        value: (
          <span className={lessSpending ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {lessSpending ? "-" : "+"}<CountUp value={Math.abs(data.diningChangePct)} decimals={1} suffix="%" />
          </span>
        ),
        subtitle: lessSpending ? t("cards.diningLessVsLastMonth") : t("cards.diningMoreVsLastMonth"),
        score: Math.min(18, Math.abs(data.diningChangePct) / 3 + (lessSpending ? 3 : 2)),
        tone: lessSpending ? "success" : "danger",
        detailsTitle: t("cards.diningTrend"),
        detailsBody: (
          <div className="space-y-2 text-sm">
            <p>{currentDayNote}</p>
            <p>{periodLabel}: <strong>{formatMoney(data.monthDiningOut, locale)} €</strong></p>
            <p>{previousPeriodLabel}: <strong>{formatMoney(data.prevDiningOut, locale)} €</strong></p>
          </div>
        ),
      });
    }

    if (data.monthExpenses > 0 && data.subscriptionsSharePct > 0) {
      list.push({
        id: "subscriptions",
        pinKey: "subscriptions",
        title: t("cards.subscriptionsWeight"),
        value: <CountUp value={data.subscriptionsSharePct} decimals={1} suffix="%" />,
        subtitle: `${t("cards.ofExpenses")} · ${currentDayNote}`,
        score: Math.min(16, data.subscriptionsSharePct / 2 + 2),
        tone: "danger",
        detailsTitle: t("cards.subscriptionsWeight"),
        detailsBody: (
          <div className="space-y-2 text-sm">
            <p>{t("labels.totalExpenses")}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>
            <p>{t("cards.subscriptionsAmount")}: <strong>{formatMoney((data.subscriptionsSharePct * data.monthExpenses) / 100, locale)} €</strong></p>
          </div>
        ),
      });
    }

    if (data.busiestDay && data.topDays.length > 0) {
      list.push({
        id: "busiestDay",
        pinKey: "busiestDay",
        title: t("cards.busiestDay"),
        value: <CountUp value={data.busiestDay.count} />,
        subtitle: `${t("cards.busiestDayValue", { date: busiestDayLabel })} · ${currentDayNote}`,
        score: Math.min(14, data.busiestDay.count + 2),
        tone: "info",
        detailsTitle: t("cards.busiestDay"),
        detailsBody: (
          <ul className="space-y-2">
            {data.topDays.slice(0, 5).map((d) => (
              <li key={d.date} className="flex items-center justify-between text-sm">
                <span>{new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { month: "long", day: "numeric" })}</span>
                <span className="font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    list.push({
      id: "savingsRateFocus",
      pinKey: "savingsRateFocus",
      title: t("cards.savingsFocus"),
      value: (
        <div className="space-y-1">
          <p><CountUp value={data.savingsRatePct} decimals={1} suffix="%" /></p>
          <MiniCompareBars
            a={Math.max(0, 100 - incomeVsExpensePct)}
            b={Math.min(100, incomeVsExpensePct)}
            aLabel={t("cards.savedShort")}
            bLabel={t("cards.spentShort")}
          />
        </div>
      ),
      subtitle: data.savingsRatePct >= 20 ? t("cards.savingsGreatPace") : t("cards.savingsPushUp"),
      score: Math.min(18, Math.abs(data.savingsRatePct - 20) / 2 + 3),
      tone: data.savingsRatePct >= 20 ? "success" : "warning",
      detailsTitle: t("cards.savingsFocus"),
      detailsBody: <ProgressRing value={data.savingsRatePct} label={currentDayNote} />,
    });

    list.push({
      id: "expenseFreeStreak",
      pinKey: "expenseFreeStreak",
      title: t("cards.noExpenseStreakToDate"),
      value: <><CountUp value={data.longestNoExpenseStreakToDate} /> {t("stories.days")}</>,
      subtitle: currentDayNote,
      score: Math.min(12, data.longestNoExpenseStreakToDate + 2),
      tone: "success",
      detailsTitle: t("cards.noExpenseStreakToDate"),
      detailsBody: <p className="text-sm">{t("cards.bestStreakToDate", { count: data.longestNoExpenseStreakToDate, days: t("stories.days") })}</p>,
    });

    if (data.monthIncome > 0) {
      list.push({
        id: "expensePressureVsIncome",
        pinKey: "expensePressureVsIncome",
        title: t("cards.expensePressure"),
        value: <><CountUp value={incomeVsExpensePct} decimals={1} suffix="%" /></>,
        subtitle: t("cards.expenseShareOfIncome"),
        score: Math.min(18, Math.abs(incomeVsExpensePct - 70) / 2 + 2),
        tone: incomeVsExpensePct <= 75 ? "success" : "danger",
        detailsTitle: t("cards.expensePressure"),
        detailsBody: (
          <div className="space-y-2 text-sm">
            <p>{currentDayNote}</p>
            <p>{t("labels.income")}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>
            <p>{t("labels.expenses")}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>
          </div>
        ),
      });
    }

    if (data.topCategory) {
      list.push({
        id: "topExpensePressure",
        pinKey: "topExpensePressure",
        title: t("cards.topExpensePressure"),
        value: <>{data.topCategory.name}</>,
        subtitle: `${formatMoney(data.topCategory.amount, locale)} € · ${data.topCategory.sharePct.toFixed(1)}%`,
        score: Math.min(18, data.topCategory.sharePct / 3 + 2),
        tone: "danger",
        detailsTitle: t("cards.topExpensePressure"),
        detailsBody: (
          <ul className="space-y-1.5">
            {data.expenseTopCategories.slice(0, 5).map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="font-semibold">{formatMoney(c.amount, locale)} €</span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (data.currentTxCount > 0) {
      list.push({
        id: "activityVolume",
        pinKey: "activityVolume",
        title: t("cards.activityVolume"),
        value: <><CountUp value={data.currentTxCount} /></>,
        subtitle: currentDayNote,
        score: Math.min(14, Math.abs(data.currentTxCount - data.previousTxCount) + 2),
        tone: "info",
        detailsTitle: t("cards.activityVolume"),
        detailsBody: (
          <div className="space-y-2 text-sm">
            <p>{t("cards.currentPeriodCount", { count: data.currentTxCount })}</p>
            <p>{t("cards.previousPeriodCount", { count: data.previousTxCount })}</p>
          </div>
        ),
      });
    }

    if (data.categoryEvolution.length > 0) {
      const improving = data.categoryEvolution.filter((c) => c.changePct != null && c.changePct < 0).length;
      list.push({
        id: "categoryEvolution",
        pinKey: "categoryEvolution",
        title: t("cards.categoryEvolution"),
        value: <><CountUp value={improving} /></>,
        subtitle: t("cards.categoriesImproved"),
        score: Math.min(16, improving * 2 + 2),
        tone: improving > 0 ? "success" : "warning",
        detailsTitle: t("cards.categoryEvolution"),
        detailsBody: (
          <ul className="space-y-1.5">
            {data.categoryEvolution.slice(0, 6).map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className={c.changePct != null && c.changePct <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                  {c.changePct == null ? "—" : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (data.topCategory) {
      list.push({
        id: "topCategoryShare",
        pinKey: "topCategoryShare",
        title: t("cards.topCategoryShare"),
        value: <><CountUp value={data.topCategory.sharePct} decimals={1} suffix="%" /></>,
        subtitle: data.topCategory.name,
        score: Math.min(16, data.topCategory.sharePct / 3 + 1),
        tone: "danger",
        detailsTitle: t("cards.topCategoryShare"),
        detailsBody: (
          <p className="text-sm">
            {data.topCategory.name}: <strong>{formatMoney(data.topCategory.amount, locale)} €</strong>
          </p>
        ),
      });
    }

    const strongestShift = data.categoryEvolution
      .filter((c) => c.changePct != null)
      .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))[0];
    if (strongestShift) {
      list.push({
        id: "strongestCategoryShift",
        pinKey: "strongestCategoryShift",
        score: Math.min(20, Math.abs(strongestShift.changePct ?? 0) / 2 + 2),
        title: t("cards.categoryEvolution"),
        value: <>{`${strongestShift.changePct! > 0 ? "+" : ""}${strongestShift.changePct!.toFixed(1)}%`}</>,
        subtitle: strongestShift.name,
        tone: strongestShift.changePct! <= 0 ? "success" : "danger",
        detailsTitle: t("cards.categoryEvolution"),
        detailsBody: (
          <p className="text-sm">
            {strongestShift.name}: {formatMoney(strongestShift.current, locale)} € / {formatMoney(strongestShift.previous, locale)} €
          </p>
        ),
      });
    }

    return list;
  }, [data, t, locale, busiestDayLabel, monthLabel, periodLabel, previousPeriodLabel]);

  const shownCards = useMemo<Array<{ uid: string; card: CardModel }>>(() => {
    const targetCount = Math.min(10, Math.max(4, cards.length));
    const recentAvoidSet = new Set(recentNonPinnedBuckets.flat());
    const availableById = new Map(cards.map((c) => [c.pinKey ?? c.id, c]));
    const pinned = pinnedIds
      .map((id) => availableById.get(id))
      .filter((c): c is CardModel => !!c)
      .slice(0, targetCount);

    const remaining = cards.filter((c) => !pinned.some((p) => (p.pinKey ?? p.id) === (c.pinKey ?? c.id)));
    const freshFirst = remaining.filter((c) => !recentAvoidSet.has(c.pinKey ?? c.id));
    const pool = freshFirst.length > 0 ? freshFirst : remaining;
    const rotatedRemaining = seededShuffle(pool, refreshSeed + cards.length * 37 + pinned.length * 11)
      .map((card) => {
        const pinId = card.pinKey ?? card.id;
        const jitter = hashToUnit(`${pinId}:${refreshSeed}`) * 3;
        return { card, rank: (card.score ?? 1) + jitter };
      })
      .sort((a, b) => b.rank - a.rank)
      .map((x) => x.card);

    const ordered = [...pinned, ...rotatedRemaining].slice(0, targetCount);
    if (ordered.length === 0) return [];

    const out: Array<{ uid: string; card: CardModel }> = ordered.map((card, i) => ({
      uid: `${card.id}__${i}`,
      card,
    }));

    return out;
  }, [cards, refreshSeed, pinnedIds, recentNonPinnedBuckets]);

  const toneClass = (tone?: CardModel["tone"]) => {
    if (tone === "success") return "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800";
    if (tone === "danger") return "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800";
    if (tone === "warning") return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800";
    if (tone === "info") return "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800";
    return "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700";
  };

  const scrollCards = (direction: "left" | "right") => {
    const el = cardsScrollRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleRefresh = () => {
    const currentNonPinnedIds = shownCards
      .map(({ card }) => card.pinKey ?? card.id)
      .filter((id) => !pinnedIds.includes(id));

    setRecentNonPinnedBuckets((prev) => [currentNonPinnedIds, ...prev].slice(0, 3));
    setRefreshSeed((s) => s + 1);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="home-period" className="text-xs text-slate-600 dark:text-slate-300">
            {t("periods.label")}
          </label>
          <select
            id="home-period"
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value as "auto" | "month_to_date" | "last_month" | "this_year" | "last_30_days")}
            className="px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <option value="auto">{t("periods.auto")}</option>
            <option value="month_to_date">{t("periods.monthToDate")}</option>
            <option value="last_month">{t("periods.lastMonth")}</option>
            <option value="this_year">{t("periods.thisYear")}</option>
            <option value="last_30_days">{t("periods.last30Days")}</option>
          </select>
          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {periodModeLabel}: {periodLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollCards("left")}
            title={t("scrollLeft")}
            aria-label={t("scrollLeft")}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollCards("right")}
            title={t("scrollRight")}
            aria-label={t("scrollRight")}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            title={t("refresh")}
            aria-label={t("refresh")}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={cardsScrollRef}
        className="hide-scrollbar overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="grid grid-flow-col auto-cols-[85%] md:auto-cols-[48%] xl:auto-cols-[calc((100%-2.25rem)/4)] gap-3">
        {shownCards.map(({ uid, card }) => {
          const pinId = card.pinKey ?? card.id;
          const isPinned = pinnedIds.includes(pinId);
          return (
            <div
              key={uid}
              role="button"
              tabIndex={0}
              onClick={() => setOpenCard(card)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenCard(card);
                }
              }}
              className={`snap-start text-left rounded-xl border p-4 transition-transform hover:-translate-y-0.5 cursor-pointer min-h-[220px] ${toneClass(card.tone)} ${card.className ?? ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{card.title}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = isPinned
                      ? pinnedIds.filter((id) => id !== pinId)
                      : [...pinnedIds, pinId];
                    persistPinned(next);
                  }}
                  className={`p-1.5 rounded border ${isPinned
                    ? "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                    : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  title={isPinned ? t("unpin") : t("pin")}
                  aria-label={isPinned ? t("unpin") : t("pin")}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M8 3h8l-1.6 5.5 3.2 2.8v1.2H6.4v-1.2l3.2-2.8L8 3Z" />
                    <path d="M12 12.5V21" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{card.subtitle}</p>
            </div>
          );
        })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        <h3 className="text-sm font-semibold mb-3">{t("stories.title")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <article className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("stories.savingsRate")} · {periodLabel}</p>
            <div className="mt-2">
              <ProgressRing value={data.savingsRatePct} label={t("stories.thisMonth")} />
            </div>
          </article>
          <article className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("cards.categoryEvolution")} · {periodLabel}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("cards.categoryEvolutionHelp")}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" />{t("cards.currentPeriodLabel")}</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-slate-400" />{t("cards.previousPeriodLabel")}</span>
            </div>
            <div className="mt-2 space-y-2">
              {data.categoryEvolution.slice(0, 4).map((c) => {
                const max = Math.max(c.current, c.previous, 1);
                const currW = (c.current / max) * 100;
                const prevW = (c.previous / max) * 100;
                return (
                  <div key={c.name} className="space-y-1">
                    <p className="text-xs text-slate-700 dark:text-slate-200 truncate">{c.name}</p>
                    <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${currW}%` }} />
                    </div>
                    <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-slate-400" style={{ width: `${prevW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
          <h3 className="text-sm font-semibold mb-2">{t("news.title")}</h3>
          {data.news.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("news.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {data.news.map((item) => (
                <li key={`${item.link}-${item.title}`} className="text-xs">
                  <a href={item.link} target="_blank" rel="noreferrer" className="hover:underline text-slate-700 dark:text-slate-200">
                    {item.title}
                  </a>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.source}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="text-sm font-semibold mb-2">{t("fact.title")}</h3>
          <p className="text-sm text-slate-700 dark:text-slate-200">{data.fact}</p>
        </div>
      </div>
      {openCard && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenCard(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">{openCard.detailsTitle}</h4>
              <button
                type="button"
                onClick={() => setOpenCard(null)}
                className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
              >
                {t("close")}
              </button>
            </div>
            <div className="space-y-3">
              <div>{openCard.detailsBody}</div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                <p><strong>{t("cards.currentPeriodLabel")}:</strong> {periodLabel}</p>
                <p><strong>{t("cards.previousPeriodLabel")}:</strong> {previousPeriodLabel}</p>
                <p>{t("cards.periodTxCompare", { current: data.currentTxCount, previous: data.previousTxCount })}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
