"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

/**
 * Polling chat thread (no realtime socket — Vercel-friendly). Refetches every
 * few seconds and on window focus. The read/write API is transport-agnostic so a
 * push layer can replace polling later with no change here beyond the transport.
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
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setBody("");
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
    <div className="flex h-[70vh] flex-col rounded-lg border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUserId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {!mine ? <p className="mb-0.5 text-xs font-semibold opacity-80">{m.senderName}</p> : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachments.map((a) => (
                    <a
                      key={a.fileId}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block underline underline-offset-2"
                    >
                      📎 {a.name}
                    </a>
                  ))}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {m.editedAt ? <span>(edited)</span> : null}
                  {mine || canModerate ? (
                    <button type="button" onClick={() => remove(m.id)} className="hover:text-destructive">
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? <p className="px-4 text-sm text-destructive" role="alert">{error}</p> : null}

      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          aria-label="Message"
          maxLength={4000}
        />
        <Button type="submit" disabled={sending || body.trim().length === 0}>
          {sending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
