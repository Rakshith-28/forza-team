"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Attachment {
  fileId: string;
  name: string;
  url: string;
}
interface ChatMessage {
  id: string;
  body: string;
  senderUserId: string;
  senderName: string;
  createdAt: string;
  editedAt: string | null;
  attachments: Attachment[];
}

const POLL_MS = 5000;

/** Up-to-two-letter initials from a display name, for the message avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** "Today" / "Yesterday" / a short date — for the day divider. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Polling chat thread (no realtime socket — Vercel-friendly). Refetches every
 * few seconds and on window focus. Messages are grouped by sender with day
 * dividers, avatars for other people, and an auto-growing composer (Enter sends,
 * Shift+Enter adds a newline). The read/write API is transport-agnostic so a push
 * layer can replace polling later with no change here beyond the transport.
 */
export function ChatThread({
  teamId,
  currentUserId,
  canModerate,
}: {
  teamId: string;
  currentUserId: string;
  canModerate: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "You don't have access to this chat." : "Couldn't load messages.");
        return;
      }
      const data = (await res.json()) as { messages: ChatMessage[] };
      setError(null);
      setMessages(data.messages);
    } catch {
      setError("Couldn't load messages.");
    } finally {
      setLoaded(true);
    }
  }, [teamId]);

  useEffect(() => {
    // Initial fetch + poll. load() updates state asynchronously (after fetch),
    // not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    // Keep the newest message visible by scrolling the message CONTAINER only —
    // never window.scrollIntoView, which walks up every scroll ancestor and
    // yanks the whole page down on load/poll.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setBody("");
        if (taRef.current) taRef.current.style.height = "auto";
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't send message.");
      }
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-secondary/20 p-4">
        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl">💬</span>
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">Be the first to say hello 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const mine = m.senderUserId === currentUserId;
            const showDay = i === 0 || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            const showHeader = showDay || prev.senderUserId !== m.senderUserId;
            return (
              <div key={m.id}>
                {showDay ? (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                ) : null}

                <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${showHeader ? "mt-2" : "mt-0.5"}`}>
                  {/* Avatar (others only); spacer keeps grouped messages aligned. */}
                  {!mine ? (
                    showHeader ? (
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary"
                      >
                        {initials(m.senderName)}
                      </span>
                    ) : (
                      <span className="size-7 shrink-0" aria-hidden />
                    )
                  ) : null}

                  <div className={`group flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {showHeader && !mine ? (
                      <span className="mb-0.5 ml-1 text-xs font-semibold text-foreground/70">{m.senderName}</span>
                    ) : null}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm shadow-xs ${
                        mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md bg-card text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
                      {m.attachments.map((a) => (
                        <a
                          key={a.fileId}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-1 flex items-center gap-1 text-xs underline underline-offset-2 ${
                            mine ? "text-primary-foreground/90" : "text-primary"
                          }`}
                        >
                          <Paperclip className="size-3" aria-hidden />
                          {a.name}
                        </a>
                      ))}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      <span>{clock(m.createdAt)}</span>
                      {m.editedAt ? <span>· edited</span> : null}
                      {mine || canModerate ? (
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          className="inline-flex items-center gap-0.5 hover:text-destructive"
                        >
                          <Trash2 className="size-3" aria-hidden /> Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? (
        <p className="border-t bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={send} className="flex items-end gap-2 border-t bg-card p-3">
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          rows={1}
          placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
          aria-label="Message"
          maxLength={4000}
          className="max-h-35 min-h-9 flex-1 resize-none rounded-2xl border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || body.trim().length === 0}
          aria-label="Send message"
          className="size-9 shrink-0 rounded-full"
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
