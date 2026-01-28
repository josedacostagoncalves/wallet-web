"use client";

import { createClient } from "@/lib/supabase/client";
import { getWalletMembers } from "@/app/actions/wallets";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Wallet {
  id: string;
  name: string;
  is_shared: boolean;
  is_active: boolean;
}

interface WalletMember {
  user_id: string;
  role: string;
  email?: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());
  const [walletMembers, setWalletMembers] = useState<Record<string, WalletMember[]>>({});
  const [membersError, setMembersError] = useState<Record<string, string>>({});
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWallets() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Get wallets where user is a member
      const { data: list } = await supabase
        .from("wallet_members")
        .select("wallet_id, wallets(id, name, is_shared, is_active)")
        .eq("user_id", user.id);

      const walletsList = (list ?? [])
        .map((m) => {
          const raw = m.wallets as Wallet | Wallet[] | null;
          return Array.isArray(raw) ? raw[0] : raw;
        })
        .filter((w): w is Wallet => w != null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setWallets(walletsList);
      setLoading(false);
    }
    loadWallets();
  }, []);

  async function loadWalletMembers(walletId: string) {
    if (loadingMembers.has(walletId)) return;
    if (walletMembers[walletId] && !membersError[walletId]) return;

    setLoadingMembers((prev) => new Set(prev).add(walletId));
    setMembersError((prev) => ({ ...prev, [walletId]: "" }));

    try {
      const result = await getWalletMembers(walletId);

      if (result.error) {
        setMembersError((prev) => ({ ...prev, [walletId]: result.error! }));
        setWalletMembers((prev) => ({ ...prev, [walletId]: [] }));
        return;
      }

      setWalletMembers((prev) => ({ ...prev, [walletId]: result.members ?? [] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load members";
      setMembersError((prev) => ({ ...prev, [walletId]: msg }));
      setWalletMembers((prev) => ({ ...prev, [walletId]: [] }));
    } finally {
      setLoadingMembers((prev) => {
        const next = new Set(prev);
        next.delete(walletId);
        return next;
      });
    }
  }

  function toggleExpand(walletId: string) {
    setExpandedWallets((prev) => {
      const next = new Set(prev);
      if (next.has(walletId)) {
        next.delete(walletId);
      } else {
        next.add(walletId);
        loadWalletMembers(walletId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <div className="flex gap-3">
          <Link
            href="/wallets/join"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Join wallet
          </Link>
          <Link
            href="/wallets/new"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
          >
            Create wallet
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {wallets.length === 0 ? (
          <div className="p-6 text-slate-500">
            No wallets.{" "}
            <Link href="/wallets/new" className="underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-3 font-medium text-slate-600">Name</th>
                <th className="text-left p-3 font-medium text-slate-600">Type</th>
                <th className="text-left p-3 font-medium text-slate-600">Status</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => {
                const isExpanded = expandedWallets.has(w.id);
                const members = walletMembers[w.id] ?? [];
                const isLoadingMembers = loadingMembers.has(w.id);
                const error = membersError[w.id];
                
                return (
                  <>
                    <tr
                      key={w.id}
                      className={`border-b border-slate-100 ${
                        !w.is_active ? "opacity-60" : ""
                      } ${w.is_shared ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      onClick={() => w.is_shared && toggleExpand(w.id)}
                    >
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          {w.is_shared && (
                            <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                              ▶
                            </span>
                          )}
                          {w.name}
                        </div>
                      </td>
                      <td className="p-3">{w.is_shared ? "Shared" : "Personal"}</td>
                      <td className="p-3">
                        {w.is_active ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-slate-500">Inactive</span>
                        )}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/wallets/${w.id}/edit`}
                          className="text-slate-600 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && w.is_shared && (
                      <tr key={`${w.id}-members`} className="bg-slate-50">
                        <td colSpan={4} className="p-4">
                          <div className="space-y-2">
                            <h3 className="font-medium text-xs mb-2">Members</h3>
                            {isLoadingMembers ? (
                              <p className="text-xs text-slate-500">Loading members…</p>
                            ) : error ? (
                              <p className="text-xs text-red-600">{error}</p>
                            ) : members.length === 0 ? (
                              <p className="text-xs text-slate-500">No members found</p>
                            ) : (
                              <div className="space-y-1">
                                {members.map((member) => (
                                  <div
                                    key={member.user_id}
                                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white"
                                  >
                                    <div>
                                      <span className="font-medium">
                                        {member.email || member.user_id}
                                      </span>
                                      <span className="ml-2 text-slate-500 text-xs">
                                        ({member.role})
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
