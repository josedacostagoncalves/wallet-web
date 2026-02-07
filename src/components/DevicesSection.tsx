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

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: "Unknown device", browser: "Unknown browser" };

  let device = "Desktop";
  if (/Android/i.test(ua)) device = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) device = "iOS";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) device = "macOS";
  else if (/Linux/i.test(ua)) device = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  return { device, browser };
}

function DeviceIcon({ ua }: { ua: string | null }) {
  const isMobile = ua ? /Android|iPhone|iPad|iPod|Mobile/i.test(ua) : false;
  if (isMobile) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0" aria-hidden>
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0" aria-hidden>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("pt-PT");
}

export function DevicesSection() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

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
      showToast("Session revoked.", "success");
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
      showToast(`${res.revoked} session${res.revoked === 1 ? "" : "s"} revoked.`, "success");
      await load();
    }
  }

  const otherSessions = sessions.filter((s) => s.session_id !== currentSessionId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Active sessions</h2>
        {otherSessions.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmRevokeAll(true)}
            disabled={revokingAll}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {revokingAll ? "Revoking…" : "Log out all other devices"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-500">No active sessions found.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            const { device, browser } = parseUserAgent(s.user_agent);
            return (
              <div
                key={s.session_id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isCurrent
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <DeviceIcon ua={s.user_agent} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {device} · {browser}
                    {isCurrent && (
                      <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 rounded px-1.5 py-0.5">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.ip && <span>{s.ip} · </span>}
                    Last active {timeAgo(s.updated_at)} · Started{" "}
                    {new Date(s.created_at).toLocaleDateString("pt-PT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(s.session_id)}
                    disabled={revokingId === s.session_id}
                    className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {revokingId === s.session_id ? "Revoking…" : "Log out"}
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
        title="Log out device"
        message="This will end the session on that device. They will need to sign in again."
        confirmLabel="Log out"
        variant="cancel"
      />
      <ConfirmDialog
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={handleRevokeAll}
        title="Log out all other devices"
        message="This will end all sessions except the current one. Other devices will need to sign in again."
        confirmLabel="Log out all"
        variant="cancel"
      />
    </div>
  );
}
