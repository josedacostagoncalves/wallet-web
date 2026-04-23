"use client";

import {
  listMySessions,
  revokeSession,
  revokeAllOtherSessions,
  type SessionRow,
} from "@/app/actions/sessions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

function DeviceIcon({ ua }: { ua: string | null }) {
  const isMobile = ua ? /Android|iPhone|iPad|iPod|Mobile/i.test(ua) : false;
  if (isMobile) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-400 shrink-0" aria-hidden>
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-400 shrink-0" aria-hidden>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

export function DevicesSection() {
  const { showToast } = useToast();
  const t = useTranslations("settings");
  const locale = useLocale();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const deviceLabels = {
    unknown: t("sessions.devices.unknown"),
    desktop: t("sessions.devices.desktop"),
    android: t("sessions.devices.android"),
    ios: t("sessions.devices.ios"),
    windows: t("sessions.devices.windows"),
    macos: t("sessions.devices.macos"),
    linux: t("sessions.devices.linux"),
  };

  const browserLabels = {
    unknown: t("sessions.browsers.unknown"),
    edge: t("sessions.browsers.edge"),
    opera: t("sessions.browsers.opera"),
    chrome: t("sessions.browsers.chrome"),
    firefox: t("sessions.browsers.firefox"),
    safari: t("sessions.browsers.safari"),
  };

  function parseUserAgent(ua: string | null): { device: string; browser: string } {
    if (!ua) return { device: deviceLabels.unknown, browser: browserLabels.unknown };

    let device = deviceLabels.desktop;
    if (/Android/i.test(ua)) device = deviceLabels.android;
    else if (/iPhone|iPad|iPod/i.test(ua)) device = deviceLabels.ios;
    else if (/Windows/i.test(ua)) device = deviceLabels.windows;
    else if (/Macintosh|Mac OS/i.test(ua)) device = deviceLabels.macos;
    else if (/Linux/i.test(ua)) device = deviceLabels.linux;

    let browser = browserLabels.unknown;
    if (/Edg\//i.test(ua)) browser = browserLabels.edge;
    else if (/OPR|Opera/i.test(ua)) browser = browserLabels.opera;
    else if (/Chrome/i.test(ua)) browser = browserLabels.chrome;
    else if (/Firefox/i.test(ua)) browser = browserLabels.firefox;
    else if (/Safari/i.test(ua)) browser = browserLabels.safari;

    return { device, browser };
  }

  function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t("sessions.timeAgo.justNow");
    if (mins < 60) return t("sessions.timeAgo.minutes", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("sessions.timeAgo.hours", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t("sessions.timeAgo.days", { count: days });
    return d.toLocaleDateString(locale);
  }

  async function load() {
    setLoading(true);
    const res = await listMySessions();
    if (!res.error) {
      setSessions(res.sessions);
      setCurrentSessionId(res.currentSessionId);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    setConfirmRevokeId(null);
    const res = await revokeSession(sessionId);
    setRevokingId(null);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(t("sessions.revokeSuccess"), "success");
      await load();
    }
  }

  async function handleRevokeAll() {
    setRevokingAll(true);
    setConfirmRevokeAll(false);
    const res = await revokeAllOtherSessions();
    setRevokingAll(false);
    if (res.error) {
      showToast(res.error, "error");
    } else {
      showToast(t("sessions.revokeAllSuccess", { count: res.revoked }), "success");
      await load();
    }
  }

  const otherSessions = sessions.filter((s) => s.session_id !== currentSessionId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t("sessions.title")}</h2>
        {otherSessions.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmRevokeAll(true)}
            disabled={revokingAll}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 disabled:opacity-50"
          >
            {revokingAll ? t("sessions.revokingAll") : t("sessions.revokeAll")}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("sessions.loading")}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("sessions.empty")}</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            const { device, browser } = parseUserAgent(s.user_agent);
            const formattedDate = new Date(s.created_at).toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={s.session_id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${isCurrent
                    ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0f0f0f]"
                  }`}
              >
                <DeviceIcon ua={s.user_agent} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {device} · {browser}
                    {isCurrent && (
                      <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 rounded px-1.5 py-0.5 dark:text-green-300 dark:bg-green-900/40">
                        {t("sessions.thisDevice")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {s.ip && <span>{t("sessions.ip", { ip: s.ip })} · </span>}
                    {t("sessions.lastActive", { time: timeAgo(s.updated_at) })} · {t("sessions.started", { date: formattedDate })}
                  </p>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(s.session_id)}
                    disabled={revokingId === s.session_id}
                    className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                  >
                    {revokingId === s.session_id ? t("sessions.revoking") : t("sessions.logout")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRevokeId}
        onClose={() => setConfirmRevokeId(null)}
        onConfirm={() => { if (confirmRevokeId) return handleRevoke(confirmRevokeId); }}
        title={t("sessions.confirmSingleTitle")}
        message={t("sessions.confirmSingleMessage")}
        confirmLabel={t("sessions.confirmSingleConfirm")}
        variant="cancel"
      />
      <ConfirmDialog
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={handleRevokeAll}
        title={t("sessions.confirmAllTitle")}
        message={t("sessions.confirmAllMessage")}
        confirmLabel={t("sessions.confirmAllConfirm")}
        variant="cancel"
      />
    </div>
  );
}
