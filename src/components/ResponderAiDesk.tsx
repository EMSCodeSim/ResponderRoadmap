"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-safety";
import { Button, TextArea } from "@/components/ui";

type Answer = {
  answer: string;
  links: Array<{ label: string; href: string }>;
  source: string;
};

type Session = { role: string | null };

const TIPS = [
  "Who needs my attention?",
  "How do I create a Task Book?",
  "Where are pending evaluations?",
  "What’s the difference between a Task Book and an Assignment?",
];

export function ResponderAiDesk() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; links?: Answer["links"] }>>([]);

  useEffect(() => {
    api<Session>("auth/me")
      .then((session) => setRole(session.role))
      .catch(() => setRole(null));
  }, []);

  if (!role || role === "MEMBER") return null;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: q }]);
    try {
      const result = await api<Answer>("ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: q, page: pathname }),
      });
      setMessages((current) => [...current, { role: "assistant", text: result.answer, links: result.links }]);
    } catch (err) {
      const message = err instanceof ApiError && (err.status === 503 || err.status === 502)
        ? AI_UNAVAILABLE_MESSAGE
        : err instanceof Error ? err.message : AI_UNAVAILABLE_MESSAGE;
      setError(message);
      setMessages((current) => [...current, { role: "assistant", text: message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white shadow-lg hover:bg-navy-800"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MessageCircle size={18} />
        Ask Responder AI
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-navy-950/40 p-3 md:p-6" role="presentation">
          <div role="dialog" aria-label="Ask Responder AI" className="flex h-[min(36rem,88vh)] w-full max-w-md flex-col rounded-lg border border-navy-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-navy-100 px-4 py-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-fire">Responder AI</div>
                <h2 className="display text-xl font-bold text-navy-900">Ask a Training Officer question</h2>
                <p className="mt-1 text-xs text-navy-500">AI assists. Humans decide. Official approvals never happen here.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-navy-500 hover:bg-navy-50" onClick={() => setOpen(false)} aria-label="Close Responder AI">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
              {messages.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-navy-600">Ask about department progress, evaluations, or how to use Responder Roadmap.</p>
                  <div className="flex flex-wrap gap-2">
                    {TIPS.map((tip) => (
                      <button key={tip} type="button" className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:border-fire" onClick={() => void ask(tip)}>
                        {tip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((item, index) => (
                <div key={`${item.role}-${index}`} className={item.role === "user" ? "ml-8 rounded-md bg-navy-900 px-3 py-2 text-sm text-white" : "mr-4 rounded-md bg-navy-50 px-3 py-2 text-sm text-navy-800"}>
                  <p className="whitespace-pre-line">{item.text}</p>
                  {item.links?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.links.map((link) => (
                        <Link key={link.href + link.label} href={link.href} onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center rounded-md bg-white px-3 text-xs font-semibold text-fire underline">
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {error && messages.length === 0 ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
            <form
              className="border-t border-navy-100 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(question);
              }}
            >
              <TextArea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder="Example: Who needs my attention?"
                aria-label="Question for Responder AI"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-navy-400">Uses your role and department records only.</p>
                <Button type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
