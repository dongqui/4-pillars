"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bubble } from "./Bubble";
import { TypingDots } from "./TypingDots";
import { Composer } from "./Composer";
import type { ChatTurn } from "../_lib/to-chat-view";

/** 상담사 말풍선을 하나씩 띄우는 간격. 사람이 연달아 말하는 리듬을 만든다 */
const BUBBLE_STAGGER_MS = 400;

interface Props {
  consultationId: string;
  initialTurns: ChatTurn[];
  initialRemaining: number;
  initialClosed: boolean;
}

export function ChatRoom({
  consultationId,
  initialTurns,
  initialRemaining,
  initialClosed,
}: Props) {
  const [turns, setTurns] = useState(initialTurns);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [closed, setClosed] = useState(initialClosed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending]);

  const last = turns[turns.length - 1];
  const suggestions = !pending && !closed ? (last?.suggestions ?? []) : [];

  async function send(text: string) {
    setError(null);
    setPending(true);
    // 낙관적으로 내 말풍선을 먼저 붙인다. 실패하면 되돌린다.
    const optimistic: ChatTurn = { key: `pending-${turns.length}`, role: "user", bubbles: [text] };
    setTurns((prev) => [...stripSuggestions(prev), optimistic]);

    try {
      const res = await fetch(`/api/consultations/${consultationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();

      if (!res.ok) {
        setTurns((prev) => prev.filter((t) => t.key !== optimistic.key));
        setError(typeof json.error === "string" ? json.error : "답변을 받지 못했어요");
        if (res.status === 409) setClosed(true);
        return;
      }

      setTurns((prev) => [
        ...prev,
        {
          key: `counselor-${prev.length}`,
          role: "counselor",
          bubbles: json.reply.bubbles,
          ...(json.reply.suggestions?.length ? { suggestions: json.reply.suggestions } : {}),
        },
      ]);
      setRemaining(json.consultation.turnLimit - json.consultation.turnsUsed);
      setClosed(json.consultation.status === "closed");
    } catch {
      setTurns((prev) => prev.filter((t) => t.key !== optimistic.key));
      setError("연결이 끊겼어요. 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link href="/consult" aria-label="상담 목록으로" className="text-slate-400">
          ←
        </Link>
        <span className="flex-1 text-[15px] font-bold tracking-[-0.02em]">상담사</span>
        <span className="text-[12.5px] font-bold text-slate-400">
          {closed ? "마무리됨" : `남은 대화 ${remaining}회`}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {turns.map((t) =>
          t.bubbles.map((text, i) => (
            <Bubble
              key={`${t.key}-${i}`}
              role={t.role}
              text={text}
              // 저장된 이력은 즉시, 방금 온 답만 순차로 띄운다.
              delay={t.role === "counselor" && t.key.startsWith("counselor-") ? i * BUBBLE_STAGGER_MS : 0}
            />
          )),
        )}
        {pending && <TypingDots />}
        {error && (
          <p role="alert" className="px-1 text-[13px] text-amber-700">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="flex gap-2 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="flex-1 rounded-[14px] border border-slate-200 px-3 py-2 text-left text-[13px] leading-[1.4] text-slate-600"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {closed ? (
        <div className="border-t border-slate-200 px-4 py-5 text-center">
          <p className="mb-3 text-[13.5px] text-gray-500">상담이 마무리됐어요.</p>
          <Link
            href="/consult"
            className="inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
          >
            새 상담 시작하기
          </Link>
        </div>
      ) : (
        <Composer disabled={pending} onSend={send} />
      )}
    </div>
  );
}

/**
 * 새 발화를 보내는 순간 지난 추천질문은 사라져야 한다.
 * `{ suggestions, ...rest } => rest` 로 쓰면 구조분해된 suggestions 가 안 쓰여
 * no-unused-vars 에 걸린다 — 그래서 남길 필드만 직접 골라 새 객체를 만든다.
 */
function stripSuggestions(turns: ChatTurn[]): ChatTurn[] {
  return turns.map((t) => ({ key: t.key, role: t.role, bubbles: t.bubbles }));
}
