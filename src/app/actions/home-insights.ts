"use server";

import { createClient } from "@/lib/supabase/server";

type LocaleCode = "en" | "pt" | "es" | "fr";

type BriefingData = {
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
  news: Array<{ title: string; link: string; source: string }>;
  fact: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function monthRangeUTC(year: number, month1to12: number) {
  const start = `${year}-${String(month1to12).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  const end = `${year}-${String(month1to12).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { start, end };
}

function stripXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function getNewsConfig(locale: LocaleCode) {
  if (locale === "pt") return { hl: "pt-PT", gl: "PT", ceid: "PT:pt", q: "financas pessoais OR poupanca" };
  if (locale === "es") return { hl: "es-419", gl: "ES", ceid: "ES:es", q: "finanzas personales OR ahorro" };
  if (locale === "fr") return { hl: "fr", gl: "FR", ceid: "FR:fr", q: "finance personnelle OR epargne" };
  return { hl: "en-US", gl: "US", ceid: "US:en", q: "personal finance OR budgeting" };
}

async function fetchLocalizedNews(locale: LocaleCode): Promise<Array<{ title: string; link: string; source: string }>> {
  const { hl, gl, ceid, q } = getNewsConfig(locale);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, 3).map((item) => {
      const title = stripXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const link = stripXml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      const source = stripXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "Google News");
      return { title, link, source };
    }).filter((n) => n.title && n.link);
  } catch {
    return [];
  }
}

function factForLocale(locale: LocaleCode): string {
  const day = Math.floor((Date.now() / 86400000) % 10000);
  const facts: Record<LocaleCode, string[]> = {
    en: [
      "Compound interest grows most when you start early, even with small amounts.",
      "The 50/30/20 budgeting rule became popular because it is simple to keep long-term.",
      "Tracking expenses regularly is one of the strongest predictors of better savings habits.",
    ],
    pt: [
      "Os juros compostos funcionam melhor quando começa cedo, mesmo com valores pequenos.",
      "A regra 50/30/20 ficou popular por ser simples de manter no longo prazo.",
      "Registar despesas com frequência é um dos hábitos mais ligados a melhor poupança.",
    ],
    es: [
      "El interés compuesto funciona mejor cuando empiezas pronto, incluso con importes pequeños.",
      "La regla 50/30/20 se hizo popular por su simplicidad para mantenerla a largo plazo.",
      "Registrar gastos con frecuencia es uno de los hábitos más ligados al ahorro.",
    ],
    fr: [
      "Les intérêts composés sont plus efficaces quand on commence tôt, même avec de petits montants.",
      "La règle 50/30/20 est devenue populaire grâce à sa simplicité sur le long terme.",
      "Suivre ses dépenses régulièrement est fortement lié à de meilleures habitudes d'épargne.",
    ],
  };
  const list = facts[locale] ?? facts.en;
  return list[day % list.length];
}

export async function getHomeBriefing(walletId: string, locale: LocaleCode): Promise<BriefingData> {
  const supabase = await createClient();
  const { data: latestTx } = await supabase
    .from("transactions")
    .select("date")
    .eq("wallet_id", walletId)
    .eq("status", "confirmed")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = latestTx?.date ? new Date(`${latestTx.date}T00:00:00Z`) : null;
  const now = latestDate ?? new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const currentRange = monthRangeUTC(year, month);
  const previousRange = monthRangeUTC(prevYear, prevMonth);
  const hasAnyTransactions = !!latestDate;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("wallet_id", walletId);
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  if (!hasAnyTransactions) {
    const news = await fetchLocalizedNews(locale);
    const fact = factForLocale(locale);
    return {
      anchorYear: year,
      anchorMonth: month,
      prevYear,
      prevMonth,
      hasAnyTransactions: false,
      monthIncome: 0,
      monthExpenses: 0,
      prevIncome: 0,
      prevExpenses: 0,
      busiestDay: null,
      topDays: [],
      incomeChangePct: null,
      subscriptionsSharePct: 0,
      diningOutPotentialSave: 0,
      topCategory: null,
      subscriptionDetails: [],
      expenseTopCategories: [],
      longestNoExpenseStreak: 0,
      savingsRatePct: 0,
      news,
      fact,
    };
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("date, type, amount, description, category_id")
    .eq("wallet_id", walletId)
    .eq("status", "confirmed")
    .gte("date", previousRange.start)
    .lte("date", currentRange.end);

  const rows = (tx ?? []) as Array<{
    date: string;
    type: "income" | "expense" | "transfer";
    amount: number;
    description: string | null;
    category_id: string | null;
  }>;

  let monthIncome = 0;
  let monthExpenses = 0;
  let prevIncome = 0;
  let prevExpenses = 0;
  const dayCount = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();
  const subscriptionsByLabel = new Map<string, number>();
  const expenseDays = new Set<string>();
  let subscriptionsAmount = 0;
  let diningOutAmount = 0;

  const subscriptionKeywords = ["subscription", "streaming", "netflix", "spotify", "subscricao", "suscripcion", "abonnement"];
  const diningKeywords = ["restaurant", "dining", "comer fora", "restaurante", "cafeteria", "bar"];

  for (const row of rows) {
    const amount = Number(row.amount);
    const inCurrent = row.date >= currentRange.start && row.date <= currentRange.end;
    const inPrevious = row.date >= previousRange.start && row.date <= previousRange.end;

    if (inCurrent) {
      dayCount.set(row.date, (dayCount.get(row.date) ?? 0) + 1);
      if (row.type === "income") monthIncome += amount;
      if (row.type === "expense") {
        monthExpenses += amount;
        expenseDays.add(row.date);

        const cat = row.category_id ? categoryById.get(row.category_id) : null;
        const root = cat?.parent_id ? categoryById.get(cat.parent_id) ?? cat : cat;
        const rootName = root?.name ?? "Other";
        expenseByCategory.set(rootName, (expenseByCategory.get(rootName) ?? 0) + amount);

        const sourceText = `${row.description ?? ""} ${cat?.name ?? ""} ${root?.name ?? ""}`;
        const normalized = normalizeText(sourceText);
        if (subscriptionKeywords.some((k) => normalized.includes(k))) subscriptionsAmount += amount;
        if (subscriptionKeywords.some((k) => normalized.includes(k))) {
          const label = row.description?.trim() || rootName;
          subscriptionsByLabel.set(label, (subscriptionsByLabel.get(label) ?? 0) + amount);
        }
        if (diningKeywords.some((k) => normalized.includes(k))) diningOutAmount += amount;
      }
    }

    if (inPrevious) {
      if (row.type === "income") prevIncome += amount;
      if (row.type === "expense") prevExpenses += amount;
    }
  }

  let busiestDay: { date: string; count: number } | null = null;
  dayCount.forEach((count, date) => {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count };
  });
  const topDays = Array.from(dayCount.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (b.count - a.count) || a.date.localeCompare(b.date))
    .slice(0, 7);

  const incomeChangePct = prevIncome > 0 && monthIncome > 0
    ? ((monthIncome - prevIncome) / prevIncome) * 100
    : null;
  const subscriptionsSharePct = monthExpenses > 0 ? (subscriptionsAmount / monthExpenses) * 100 : 0;
  const diningOutPotentialSave = diningOutAmount * 0.1;

  let topCategory: { name: string; amount: number; sharePct: number } | null = null;
  expenseByCategory.forEach((amount, name) => {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = {
        name,
        amount,
        sharePct: monthExpenses > 0 ? (amount / monthExpenses) * 100 : 0,
      };
    }
  });
  const expenseTopCategories = Array.from(expenseByCategory.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      sharePct: monthExpenses > 0 ? (amount / monthExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
  const subscriptionDetails = Array.from(subscriptionsByLabel.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let longestNoExpenseStreak = 0;
  let currentStreak = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (expenseDays.has(dayKey)) {
      currentStreak = 0;
    } else {
      currentStreak += 1;
      if (currentStreak > longestNoExpenseStreak) longestNoExpenseStreak = currentStreak;
    }
  }

  const savingsRatePct = monthIncome > 0 ? Math.max(0, ((monthIncome - monthExpenses) / monthIncome) * 100) : 0;
  const news = await fetchLocalizedNews(locale);
  const fact = factForLocale(locale);

  return {
    anchorYear: year,
    anchorMonth: month,
    prevYear,
    prevMonth,
    hasAnyTransactions,
    monthIncome,
    monthExpenses,
    prevIncome,
    prevExpenses,
    busiestDay,
    topDays,
    incomeChangePct,
    subscriptionsSharePct,
    diningOutPotentialSave,
    topCategory,
    subscriptionDetails,
    expenseTopCategories,
    longestNoExpenseStreak,
    savingsRatePct,
    news,
    fact,
  };
}
