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
  /** 머리글에 서는 상담 제목. 첫 턴이 실패해 아직 제목이 없으면 "새 상담" 이다 */
  title: string;
  /** 대화 위에 한 번 서는 날짜 칩 — "오늘" · "어제" · "8월 12일" */
  dayLabel: string;
  initialTurns: ChatTurn[];
  initialRemaining: number;
  initialClosed: boolean;
}

export function ChatRoom({
  consultationId,
  title,
  dayLabel,
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
    // 사용자 말풍선은 애니메이션 대상이 아니므로 isNew 는 항상 false 다.
    const optimistic: ChatTurn = {
      key: `pending-${turns.length}`,
      role: "user",
      bubbles: [text],
      isNew: false,
    };
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
          // 방금 API 에서 온 답만 진입 애니메이션을 태운다.
          isNew: true,
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* sticky 가 아니라 flex-none 이다 — 스크롤하는 것은 페이지가 아니라 가운데
          대화 영역뿐이라, 머리글과 입력창은 가만히 있어도 제자리에 남는다. */}
      <header className="flex flex-none items-center gap-2.5 border-b border-slate-100 bg-white/[0.92] px-[clamp(16px,4vw,22px)] py-3.5 backdrop-blur-[12px] min-[900px]:px-6 min-[900px]:py-4">
        <Link
          href="/consult"
          aria-label="상담 목록으로"
          className="-ml-1.5 flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[18px] text-slate-700 hover:bg-slate-100"
        >
          <span aria-hidden>‹</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15.5px] font-bold tracking-[-0.025em]">{title}</h1>
          {/* 열려 있는 동안에는 아무 말도 하지 않는다. 예전에는 여기 "남은 대화 9회"가
              제목 바로 아래 상시로 서 있어서, 고민을 말하는 내내 남은 횟수가 같이
              읽혔다 — 상담이 아니라 계량기를 보는 화면이 된다(대화 설계 §20.2). 남은
              횟수는 입력창 위로 내려갔고, 여기에는 끝났다는 사실만 남는다. */}
          {closed && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-slate-300"
              />
              <span className="text-[12.5px] text-slate-400">상담 마무리</span>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[clamp(16px,4vw,28px)] pb-2 pt-[22px]">
        <div className="mx-auto flex max-w-[640px] flex-col gap-3.5">
          <div className="mb-0.5 self-center rounded-full bg-slate-100 px-[11px] py-1 text-[12px] text-slate-400">
            {dayLabel}
          </div>

          {turns.map((t) =>
            t.bubbles.map((text, i) => (
              <Bubble
                key={`${t.key}-${i}`}
                role={t.role}
                text={text}
                // 저장된 이력은 즉시, 방금 온 답만 순차로 띄운다. "태울지"(animate)와
                // "얼마나 늦게"(delay)는 다른 질문이다 — 첫 말풍선(i===0)도 새 답이면
                // 반드시 애니메이션이 걸려야 하므로 delay===0 을 애니메이션 여부로
                // 겸용하지 않는다.
                animate={t.isNew}
                delay={i * BUBBLE_STAGGER_MS}
              />
            )),
          )}
          {pending && <TypingDots />}
          {error && (
            <p role="alert" className="px-1 text-[13px] text-amber-700">
              {error}
            </p>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex-none px-[clamp(16px,4vw,28px)] pb-2">
          {/* 개수가 고정이 아니다 — 갈래가 없는 턴에는 아예 안 오고, 한 개만 오기도
              한다(대화 설계 §18). flex-1 로 두면 한 개일 때 통짜 버튼이 되어 "이걸 누르라"는
              말처럼 보이므로, 폭은 글자만큼만 준다. */}
          <div className="mx-auto flex max-w-[640px] flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="max-w-full rounded-[14px] border border-slate-200 px-3 py-2.5 text-left text-[13px] leading-[1.4] text-slate-500 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {closed ? (
        <div className="flex-none border-t border-slate-100 px-[clamp(16px,4vw,28px)] py-5 text-center">
          <p className="mb-3 text-[13.5px] text-slate-500">상담이 마무리됐어요.</p>
          <Link
            href="/consult"
            className="inline-flex h-12 items-center rounded-[14px] bg-accent px-6 text-[15px] font-bold tracking-[-0.02em] text-white hover:bg-accent-700"
          >
            새 상담 시작하기
          </Link>
        </div>
      ) : (
        <>
          {/* 입력창 옆의 작은 상태 표시. 필요할 때 눈에 들어오되, 대화를 읽는 동안에는
              배경으로 남는 자리다. */}
          <div className="flex-none px-[clamp(16px,4vw,28px)]">
            <p className="mx-auto max-w-[640px] text-right text-[11.5px] text-slate-300">
              {remaining}회 남음
            </p>
          </div>
          <Composer disabled={pending} onSend={send} />
        </>
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
  return turns.map((t) => ({ key: t.key, role: t.role, bubbles: t.bubbles, isNew: t.isNew }));
}
