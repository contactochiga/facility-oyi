"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import messagesService from "@/services/messagesService";
import { MessageSquare, ShieldAlert, Send, Search } from "lucide-react";

function nameOf(peer: any) {
  return peer?.full_name || peer?.username || "Resident";
}

function when(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function FacilityMessagesPage() {
  const [tab, setTab] = useState<"inbox" | "moderation">("inbox");

  const [threads, setThreads] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [compose, setCompose] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [moderating, setModerating] = useState(false);

  async function loadInbox() {
    const [inbox, people] = await Promise.all([
      messagesService.listInbox(),
      messagesService.listResidents(),
    ]);
    setThreads(Array.isArray(inbox) ? inbox : []);
    setResidents(Array.isArray(people) ? people : []);
    if (!activeThread && inbox?.[0]?.id) setActiveThread(inbox[0]);
  }

  async function loadThreadMessages(thread: any) {
    if (!thread?.id) return setMessages([]);
    const list = await messagesService.listMessages(String(thread.id));
    setMessages(Array.isArray(list) ? list : []);
    await messagesService.markRead(String(thread.id));
  }

  async function loadReports() {
    const list: any = await messagesService.listReports("open", 50);
    if (Array.isArray(list)) setReports(list);
  }

  async function boot() {
    setLoading(true);
    setErr(null);
    try {
      await Promise.all([loadInbox(), loadReports()]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load messaging module");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
    const t = window.setInterval(() => {
      loadInbox();
      loadReports();
      if (activeThread?.id) loadThreadMessages(activeThread);
    }, 12000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThread?.id) return;
    loadThreadMessages(activeThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id]);

  async function startDirect(peerId: string) {
    if (!peerId) return;
    const res: any = await messagesService.openDirect(peerId);
    if (res?.error) return setErr(String(res.error));
    await loadInbox();
    const list = await messagesService.listInbox();
    setThreads(list);
    const found = (list || []).find((t: any) => String(t.id) === String(res?.thread?.id));
    if (found) setActiveThread(found);
  }

  async function send() {
    if (!activeThread?.id || !compose.trim()) return;
    const text = compose.trim();
    setCompose("");
    const res: any = await messagesService.sendMessage(String(activeThread.id), text);
    if (res?.error) {
      setErr(String(res.error));
      setCompose(text);
      return;
    }
    await loadThreadMessages(activeThread);
    await loadInbox();
  }

  async function moderate(reportId: string, action: "dismiss" | "hide_message" | "mute_sender") {
    setModerating(true);
    setErr(null);
    const note = window.prompt("Moderator note (optional)", "") || "";
    const res: any = await messagesService.resolveReport(reportId, {
      action,
      note,
      mute_hours: action === "mute_sender" ? 24 : undefined,
    });
    setModerating(false);
    if (res?.error) return setErr(String(res.error));
    await loadReports();
  }

  const filteredResidents = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return residents;
    return residents.filter((r) => `${r.full_name || ""} ${r.username || ""}`.toLowerCase().includes(s));
  }, [q, residents]);

  return (
    <div className="space-y-6">
      <Topbar
        title="Messaging"
        subtitle="Operator inbox + moderation queue"
        rightSlot={
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              className={`px-3 py-1.5 rounded-lg text-xs ${tab === "inbox" ? "bg-white/15 text-white" : "text-zinc-400"}`}
              onClick={() => setTab("inbox")}
            >
              Inbox
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs ${tab === "moderation" ? "bg-white/15 text-white" : "text-zinc-400"}`}
              onClick={() => setTab("moderation")}
            >
              Moderation
            </button>
          </div>
        }
      />

      {err ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      {tab === "inbox" ? (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <div className="glass border border-white/10 rounded-2xl p-3 space-y-3">
            <div className="text-sm text-white/85 font-semibold inline-flex items-center gap-2">
              <MessageSquare size={16} />
              Start New Message
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search size={14} className="text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search residents..."
                className="flex-1 bg-transparent outline-none text-sm text-white"
              />
            </div>
            <div className="max-h-56 overflow-auto space-y-1">
              {filteredResidents.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startDirect(String(r.id))}
                  className="w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-white/10 px-3 py-2"
                >
                  <div className="text-sm text-white">{nameOf(r)}</div>
                  <div className="text-[11px] text-zinc-500">{r.role || "resident"}</div>
                </button>
              ))}
              {!filteredResidents.length ? <div className="text-xs text-zinc-500 px-2 py-1">No residents</div> : null}
            </div>

            <div className="pt-2 border-t border-white/10 text-xs text-zinc-400">
              Existing Threads
            </div>
            <div className="max-h-72 overflow-auto space-y-1">
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveThread(t)}
                  className={`w-full text-left rounded-xl border px-3 py-2 ${
                    activeThread?.id === t.id
                      ? "border-blue-500/30 bg-blue-500/10"
                      : "border-white/10 bg-black/20 hover:bg-white/10"
                  }`}
                >
                  <div className="text-sm text-white">{nameOf(t.peer)}</div>
                  <div className="text-[11px] text-zinc-400 line-clamp-1">{t.last_message?.body || "No messages yet"}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{when(t.last_message_at)}</div>
                </button>
              ))}
              {!threads.length && !loading ? <div className="text-xs text-zinc-500 px-2 py-1">No threads yet</div> : null}
            </div>
          </div>

          <div className="glass border border-white/10 rounded-2xl p-3 flex flex-col min-h-[560px]">
            <div className="pb-2 border-b border-white/10">
              <div className="text-sm font-semibold text-white">{activeThread ? nameOf(activeThread.peer) : "Conversation"}</div>
            </div>

            <div className="flex-1 overflow-auto space-y-2 py-3">
              {!activeThread ? (
                <div className="text-sm text-zinc-500">Pick a thread or start a new message.</div>
              ) : !messages.length ? (
                <div className="text-sm text-zinc-500">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-sm text-white">{m.body}</div>
                    <div className="text-[10px] text-zinc-500 mt-1">{when(m.created_at)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <input
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={activeThread ? "Send message..." : "Select a thread first"}
                disabled={!activeThread}
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none disabled:opacity-50"
              />
              <Button onClick={send} disabled={!activeThread || !compose.trim()}>
                <span className="inline-flex items-center gap-2"><Send size={14} />Send</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <ShieldAlert size={16} />
            Moderation Queue
          </div>
          <div className="mt-1 text-xs text-zinc-400">Resident reports that require operator action.</div>

          <div className="mt-3 space-y-2 max-h-[65vh] overflow-auto">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm text-white">{r.reason}</div>
                <div className="text-xs text-zinc-500 mt-1">Report ID: {r.id}</div>
                <div className="text-xs text-zinc-500">{when(r.created_at)}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button variant="ghost" onClick={() => moderate(String(r.id), "dismiss")} disabled={moderating}>
                    Dismiss
                  </Button>
                  <Button onClick={() => moderate(String(r.id), "hide_message")} disabled={moderating}>
                    Hide Message
                  </Button>
                  <Button onClick={() => moderate(String(r.id), "mute_sender")} disabled={moderating}>
                    Mute 24h
                  </Button>
                </div>
              </div>
            ))}
            {!reports.length ? <div className="text-sm text-zinc-500 py-4">No open reports.</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}

