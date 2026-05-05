"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CategoryFlatRow } from "@/app/actions/transactions";

type SearchPick = {
  parentCategoryId: string;
  subcategoryId: string;
  label: string;
  sortKey: string;
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildSearchOptions(flat: CategoryFlatRow[], query: string): SearchPick[] {
  const q = norm(query);
  if (!q || flat.length === 0) return [];

  const parents = flat.filter((c) => !c.parent_id);
  const parentById = new Map(parents.map((p) => [p.id, p]));

  const raw: SearchPick[] = [];

  for (const p of parents) {
    if (norm(p.name).includes(q)) {
      raw.push({
        parentCategoryId: p.id,
        subcategoryId: "",
        label: p.name,
        sortKey: p.name,
      });
    }
  }

  for (const row of flat) {
    if (!row.parent_id) continue;
    const parent = parentById.get(row.parent_id);
    if (!parent) continue;
    if (norm(row.name).includes(q) || norm(parent.name).includes(q)) {
      raw.push({
        parentCategoryId: parent.id,
        subcategoryId: row.id,
        label: `${parent.name} › ${row.name}`,
        sortKey: `${parent.name} ${row.name}`,
      });
    }
  }

  const seen = new Set<string>();
  const deduped: SearchPick[] = [];
  for (const o of raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey))) {
    const k = `${o.parentCategoryId}|${o.subcategoryId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(o);
  }
  return deduped.slice(0, 80);
}

type Props = {
  flat: CategoryFlatRow[];
  onPick: (parentCategoryId: string, subcategoryId: string) => void;
  disabled?: boolean;
  inputClassName?: string;
  /** Defaults to compact label to match transaction modals. */
  labelClassName?: string;
};

export function CategorySubcategorySearchField({
  flat,
  onPick,
  disabled,
  inputClassName,
  labelClassName,
}: Props) {
  const t = useTranslations("transactions.form.fields");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const options = useMemo(() => buildSearchOptions(flat, query), [flat, query]);
  const showPanel = open && norm(query).length > 0;

  useEffect(() => {
    if (!open || options.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((prev) => {
      if (prev >= 0 && prev < options.length) return prev;
      return 0;
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!showPanel) return;
    if (highlightedIndex < 0 || highlightedIndex >= options.length) return;
    const el = optionRefs.current[highlightedIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, options.length, showPanel]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const apply = useCallback(
    (pick: SearchPick) => {
      onPick(pick.parentCategoryId, pick.subcategoryId);
      setQuery("");
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onPick]
  );

  const defaultInputClass =
    "w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800";
  const inputClass = inputClassName ?? defaultInputClass;
  const labelClass =
    labelClassName ?? "block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400";

  return (
    <div ref={rootRef} className="relative">
      <label className={labelClass}>
        {t("searchCategory")}
      </label>
      <input
        type="search"
        autoComplete="off"
        value={query}
        disabled={disabled || flat.length === 0}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlightedIndex(options.length > 0 ? 0 : -1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setHighlightedIndex(-1);
            return;
          }
          if (!showPanel || options.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, options.length - 1)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < 0 ? 0 : Math.max(prev - 1, 0)));
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
            const pick = options[idx];
            if (!pick) return;
            e.preventDefault();
            apply(pick);
          }
        }}
        placeholder={t("searchCategoryPlaceholder")}
        className={inputClass}
      />
      {showPanel && (
        <ul className="absolute z-[60] mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-left text-xs shadow-lg dark:border-slate-600 dark:bg-slate-900">
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-slate-500 dark:text-slate-400">{t("searchCategoryNoMatches")}</li>
          ) : (
            options.map((o, idx) => (
              <li key={`${o.parentCategoryId}|${o.subcategoryId}`}>
                <button
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  className={`w-full px-2 py-1.5 text-left text-slate-800 dark:text-slate-200 ${
                    highlightedIndex === idx
                      ? "bg-slate-100 dark:bg-slate-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(o)}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
