"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

type NewsItem = { title: string; link: string; source: string };

type Props = {
  walletId: string;
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
    savingsRatePct: number;
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

type CardModel = {
  id: string;
  pinKey?: string;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
  className?: string;
  detailsTitle: string;
  detailsBody: React.ReactNode;
};

export function HomeSmartBriefing({ walletId, data }: Props) {
  const t = useTranslations("home.smart");
  const locale = useLocale();
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

  const cards = useMemo<CardModel[]>(() => {
    const list: CardModel[] = [];

    if (data.busiestDay && data.topDays.length > 0) {
      list.push({
        id: "busiestDay",
        pinKey: "busiestDay",
        title: t("cards.busiestDay"),
        value: <CountUp value={data.busiestDay.count} />,
        subtitle: t("cards.busiestDayValue", { date: busiestDayLabel }),
        tone: "info",
        detailsTitle: t("cards.busiestDay"),
        detailsBody: (
          <ul className="space-y-2">
            {data.topDays.map((d) => (
              <li key={d.date} className="flex items-center justify-between text-sm">
                <span>{new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { month: "long", day: "numeric" })}</span>
                <span className="font-semibold">{d.count}</span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (data.incomeChangePct != null) {
      const incomeDeltaClass =
        data.incomeChangePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
      list.push({
        id: "incomeTrend",
        pinKey: "incomeTrend",
        title: t("cards.incomeTrend"),
        value: (
          <span className={incomeDeltaClass}>
            {data.incomeChangePct >= 0 ? "+" : ""}<CountUp value={data.incomeChangePct} decimals={1} suffix="%" />
          </span>
        ),
        subtitle: t("cards.vsLastMonth"),
        tone: data.incomeChangePct >= 0 ? "success" : "danger",
        detailsTitle: t("cards.incomeTrend"),
        detailsBody: (
          <div className="space-y-2 text-sm">
            <p>{monthLabel}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>
            <p>{prevMonthLabel}: <strong>{formatMoney(data.prevIncome, locale)} €</strong></p>
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
        subtitle: t("cards.ofExpenses"),
        tone: "danger",
        detailsTitle: t("cards.subscriptionsWeight"),
        detailsBody: (
          <div className="space-y-2">
            <p className="text-sm">{t("labels.totalExpenses")}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>
            {data.subscriptionDetails.length === 0 ? (
              <p className="text-sm text-slate-500">{t("news.empty")}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.subscriptionDetails.map((s) => (
                  <li key={s.label} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[240px]">{s.label}</span>
                    <span className="font-semibold">{formatMoney(s.amount, locale)} €</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
      });
    }

    if (data.diningOutPotentialSave > 0) {
      list.push({
        id: "diningSave",
        pinKey: "diningSave",
        title: t("cards.potentialSave"),
        value: <><CountUp value={data.diningOutPotentialSave} decimals={2} /> €</>,
        subtitle: t("cards.byReducingDining"),
        tone: "warning",
        detailsTitle: t("cards.potentialSave"),
        detailsBody: (
          <p className="text-sm">
            {t("labels.estimatedSave")}: <strong>{formatMoney(data.diningOutPotentialSave, locale)} €</strong>
          </p>
        ),
      });
    }

    if (data.topCategory) {
      list.push({
        id: "topCategory",
        pinKey: "topCategory",
        title: t("stories.topCategory"),
        value: <>{data.topCategory.name}</>,
        subtitle: `${formatMoney(data.topCategory.amount, locale)} €`,
        tone: "danger",
        detailsTitle: t("stories.topCategory"),
        detailsBody: (
          <ul className="space-y-1.5">
            {data.expenseTopCategories.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="font-semibold">{formatMoney(c.amount, locale)} €</span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (data.longestNoExpenseStreak > 0) {
      list.push({
        id: "streak",
        pinKey: "streak",
        title: t("stories.noSpendStreak"),
        value: <><CountUp value={data.longestNoExpenseStreak} /> {t("stories.days")}</>,
        subtitle: monthLabel,
        tone: "success",
        detailsTitle: t("stories.noSpendStreak"),
        detailsBody: <p className="text-sm">{data.longestNoExpenseStreak} {t("stories.days")}.</p>,
      });
    }

    if (data.monthIncome > 0 || data.monthExpenses > 0) {
      list.push({
        id: "netFlow",
        pinKey: "netFlow",
        title: t("stories.netFlow"),
        value: <>{formatMoney(data.monthIncome - data.monthExpenses, locale)} €</>,
        subtitle: t("stories.incomeVsExpenses"),
        tone: data.monthIncome >= data.monthExpenses ? "success" : "danger",
        detailsTitle: t("stories.netFlow"),
        detailsBody: (
          <div className="space-y-1.5 text-sm">
            <p>{t("labels.income")}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>
            <p>{t("labels.expenses")}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>
          </div>
        ),
      });
    }

    list.push({
      id: "savingsRate",
      pinKey: "savingsRate",
      title: t("stories.savingsRate"),
      value: <><CountUp value={data.savingsRatePct} decimals={1} suffix="%" /></>,
      subtitle: t("stories.thisMonth"),
      tone: data.savingsRatePct >= 0 ? "success" : "danger",
      detailsTitle: t("stories.savingsRate"),
      detailsBody: <ProgressRing value={data.savingsRatePct} label={monthLabel} />,
    });

    list.push(
      {
        id: "incomeMonth",
        pinKey: "incomeMonth",
        title: t("labels.income"),
        value: <>{formatMoney(data.monthIncome, locale)} €</>,
        subtitle: monthLabel,
        tone: "success",
        detailsTitle: t("labels.income"),
        detailsBody: <p className="text-sm">{monthLabel}: <strong>{formatMoney(data.monthIncome, locale)} €</strong></p>,
      },
      {
        id: "expensesMonth",
        pinKey: "expensesMonth",
        title: t("labels.expenses"),
        value: <>{formatMoney(data.monthExpenses, locale)} €</>,
        subtitle: monthLabel,
        tone: "danger",
        detailsTitle: t("labels.expenses"),
        detailsBody: <p className="text-sm">{monthLabel}: <strong>{formatMoney(data.monthExpenses, locale)} €</strong></p>,
      },
      {
        id: "incomePrev",
        pinKey: "incomePrev",
        title: t("labels.income"),
        value: <>{formatMoney(data.prevIncome, locale)} €</>,
        subtitle: prevMonthLabel,
        tone: "success",
        detailsTitle: t("labels.income"),
        detailsBody: <p className="text-sm">{prevMonthLabel}: <strong>{formatMoney(data.prevIncome, locale)} €</strong></p>,
      },
      {
        id: "expensesPrev",
        pinKey: "expensesPrev",
        title: t("labels.expenses"),
        value: <>{formatMoney(data.prevExpenses, locale)} €</>,
        subtitle: prevMonthLabel,
        tone: "danger",
        detailsTitle: t("labels.expenses"),
        detailsBody: <p className="text-sm">{prevMonthLabel}: <strong>{formatMoney(data.prevExpenses, locale)} €</strong></p>,
      },
      {
        id: "curiosity",
        pinKey: "curiosity",
        title: t("fact.title"),
        value: <>Fact</>,
        subtitle: data.fact.slice(0, 70),
        tone: "warning",
        detailsTitle: t("fact.title"),
        detailsBody: <p className="text-sm">{data.fact}</p>,
      }
    );

    data.topDays.slice(0, 5).forEach((d, idx) => {
      const dateLabel = new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { month: "long", day: "numeric" });
      list.push({
        id: `topDay-${d.date}`,
        pinKey: `topDay-${d.date}`,
        title: `${t("cards.busiestDay")} #${idx + 1}`,
        value: <><CountUp value={d.count} /></>,
        subtitle: dateLabel,
        tone: "info",
        detailsTitle: t("cards.busiestDay"),
        detailsBody: <p className="text-sm">{dateLabel}: <strong>{d.count}</strong></p>,
      });
    });

    data.expenseTopCategories.slice(0, 6).forEach((c) => {
      list.push({
        id: `expenseCat-${c.name}`,
        pinKey: `expenseCat-${c.name}`,
        title: c.name,
        value: <>{formatMoney(c.amount, locale)} €</>,
        subtitle: `${c.sharePct.toFixed(1)}% ${t("cards.ofExpenses")}`,
        tone: "danger",
        detailsTitle: c.name,
        detailsBody: <p className="text-sm"><strong>{formatMoney(c.amount, locale)} €</strong> ({c.sharePct.toFixed(1)}%)</p>,
      });
    });

    data.subscriptionDetails.slice(0, 5).forEach((s) => {
      list.push({
        id: `subscription-${s.label}`,
        pinKey: `subscription-${s.label}`,
        title: s.label,
        value: <>{formatMoney(s.amount, locale)} €</>,
        subtitle: t("cards.subscriptionsWeight"),
        tone: "warning",
        detailsTitle: s.label,
        detailsBody: <p className="text-sm"><strong>{formatMoney(s.amount, locale)} €</strong></p>,
      });
    });

    data.news.slice(0, 4).forEach((n, idx) => {
      list.push({
        id: `news-${idx}`,
        pinKey: `news-${idx}`,
        title: t("news.title"),
        value: <>News</>,
        subtitle: n.title.slice(0, 72),
        tone: "info",
        detailsTitle: t("news.title"),
        detailsBody: (
          <a href={n.link} target="_blank" rel="noreferrer" className="text-sm underline">
            {n.title}
          </a>
        ),
      });
    });

    return list;
  }, [data, t, locale, busiestDayLabel, monthLabel, prevMonthLabel]);

  const shownCards = useMemo<Array<{ uid: string; card: CardModel }>>(() => {
    const targetCount = 20;
    const recentAvoidSet = new Set(recentNonPinnedBuckets.flat());
    const availableById = new Map(cards.map((c) => [c.pinKey ?? c.id, c]));
    const pinned = pinnedIds
      .map((id) => availableById.get(id))
      .filter((c): c is CardModel => !!c)
      .slice(0, targetCount);

    const remaining = cards.filter((c) => !pinned.some((p) => (p.pinKey ?? p.id) === (c.pinKey ?? c.id)));
    const freshFirst = remaining.filter((c) => !recentAvoidSet.has(c.pinKey ?? c.id));
    const pool = freshFirst.length > 0 ? freshFirst : remaining;
    const rotatedRemaining = seededShuffle(pool, refreshSeed + cards.length * 37 + pinned.length * 11);

    const ordered = [...pinned, ...rotatedRemaining];
    if (ordered.length === 0) return [];

    const out: Array<{ uid: string; card: CardModel }> = ordered.map((card, i) => ({
      uid: `${card.id}__${i}`,
      card,
    }));

    let cloneIndex = 0;
    while (out.length < targetCount) {
      const card = ordered[cloneIndex % ordered.length];
      out.push({ uid: `${card.id}__clone_${cloneIndex}`, card });
      cloneIndex += 1;
    }
    return out.slice(0, targetCount);
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
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("basedOnMonth", { month: monthLabel })}</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollCards("left")}
            title="Scroll left"
            aria-label="Scroll left"
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollCards("right")}
            title="Scroll right"
            aria-label="Scroll right"
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
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{card.subtitle}</p>
            </div>
          );
        })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        <h3 className="text-sm font-semibold mb-3">{t("stories.title")}</h3>
        <div className="flex gap-3 overflow-x-auto snap-x pb-2">
          <article className="snap-start shrink-0 w-[260px] rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("stories.savingsRate")}</p>
            <div className="mt-2">
              <ProgressRing value={data.savingsRatePct} label={t("stories.thisMonth")} />
            </div>
          </article>

          <article className="snap-start shrink-0 w-[260px] rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("stories.topCategory")}</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{data.topCategory?.name ?? "—"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.topCategory ? `${formatMoney(data.topCategory.amount, locale)} €` : "—"}
            </p>
          </article>

          <article className="snap-start shrink-0 w-[260px] rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("stories.noSpendStreak")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              <CountUp value={data.longestNoExpenseStreak} />
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("stories.days")}</p>
          </article>

          <article className="snap-start shrink-0 w-[260px] rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("stories.netFlow")}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatMoney(data.monthIncome - data.monthExpenses, locale)} €
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("stories.incomeVsExpenses")}
            </p>
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
            <div>{openCard.detailsBody}</div>
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
