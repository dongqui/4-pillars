"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PersonOption } from "@/lib/profiles/option";
import { PersonPicker } from "@/components/PersonPicker";
import type { ContextAnswer } from "@/lib/flows/context";
import type { YearOption } from "../_lib/to-confirm";
import { toStartOutcome, type StartFailure } from "../_lib/to-start-outcome";
import { SituationSheet } from "./SituationSheet";

export interface FlowConfirmProps {
  people: PersonOption[];
  /** 프로필별 연도 칸. people 과 같은 순서(같은 인덱스가 같은 사람)다 */
  yearsByProfile: YearOption[][];
  /** 처음 열었을 때 고를 프로필의 인덱스 */
  initialProfile: number;
  /**
   * 보유 이용권 수. 모달의 "보유 N장" 에만 쓰는 스냅숏이다 — 0이어도 버튼을
   * 막지 않는다(다른 탭에서 충전했을 수 있고, 결제 판정은 서버가 한다).
   */
  tickets: number;
  /** 플래그가 켜져 있으면 결제 확인 뒤 SituationSheet 을 거쳐 v2 pending 을 만든다. */
  v2Enabled: boolean;
}

/**
 * 연도 선택 화면. 시안(Saju Yearly Report)이 확정한 구조:
 *
 * 칸을 "골라 두고 아래 CTA 로 확정" 하던 앞선 설계를 버리고 **칸이 곧 행동**이다 —
 * 보유한 해는 누르면 바로 열리고, 안 산 해는 결제 모달이 뜬다. 그래서 이 화면에는
 * 선택 상태(어느 해가 눌려 있는가)가 없다. 모달이 들고 있는 것은 "무엇을 사려고
 * 하는가" 하나다.
 */
export function FlowConfirm(props: FlowConfirmProps) {
  const router = useRouter();
  const [active, setActive] = useState(props.initialProfile);
  // 결제 모달이 겨눈 해. null 이면 닫혀 있다.
  const [payYear, setPayYear] = useState<YearOption | null>(null);
  // 결제를 확인한 뒤 상황을 묻는 시트가 겨눈 해(v2 플래그 켜졌을 때만). 결제
  // 시트와 동시에 뜨지 않는다.
  const [ctxYear, setCtxYear] = useState<YearOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<StartFailure | null>(null);

  if (props.people.length === 0) {
    return (
      <section className="mx-auto max-w-[720px] px-5 py-9">
        <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">한 해의 흐름</h1>
        <p className="mb-5 text-[13.5px] leading-[1.55] text-gray-500">
          먼저 사주 정보를 저장해주세요.
        </p>
        <Link
          href="/funnel?step=name"
          className="block w-full rounded-[14px] bg-accent py-3 text-center text-sm font-bold text-white"
        >
          사주 추가하기
        </Link>
      </section>
    );
  }

  const me = props.people[active];
  const years = props.yearsByProfile[active];
  const ownedCount = years.filter((y) => y.owned).length;

  function openPay(y: YearOption) {
    setFailure(null);
    setPayYear(y);
  }

  function closePay() {
    if (busy) return; // 결제 요청이 나간 뒤에는 결과를 보고 닫는다
    setPayYear(null);
    setFailure(null);
  }

  /**
   * 결제 시트 → 상황 시트(v2). 여기서는 아직 아무것도 만들지 않는다 — 요청은
   * 상황 시트의 "리포트 만들기" 에서 한 번만 나간다.
   */
  function openContext(y: YearOption) {
    setPayYear(null);
    setFailure(null);
    setCtxYear(y);
  }

  function closeContext() {
    if (busy) return; // 요청이 나간 뒤에는 결과를 보고 닫는다
    setCtxYear(null);
    setFailure(null);
  }

  async function start(year: number, context?: ContextAnswer) {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          context === undefined ? { profileId: me.id, year } : { profileId: me.id, year, context },
        ),
      });
      if (!res.ok) {
        // 402·429·401 모두 실제로 닿는 상태다 — 버튼만 다시 눌리게 두면
        // 사용자는 왜 아무 일도 안 일어나는지 알 방법이 없다.
        setFailure(toStartOutcome(res.status));
        setBusy(false);
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/flow/${id}`);
    } catch {
      setFailure(toStartOutcome(0));
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[720px] px-5 py-9">
      <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
        한 해의 흐름
      </div>
      <h1 className="text-[clamp(22px,5vw,28px)] font-bold leading-[1.22] tracking-[-0.04em]">
        어떤 해를 살펴볼까요?
      </h1>
      <p className="mt-2 max-w-[520px] text-[13.5px] leading-[1.55] text-gray-500">
        사주와 연도를 고르면 그 해의 기운, 조심할 시기, 잘 흐를 시기를 정리해 드려요.
      </p>

      {/* 1 · 프로필 */}
      <div className="relative z-20 mt-7">
        <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
          누구의 흐름인가요?
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <PersonPicker
              people={props.people}
              selectedId={me.id}
              onPick={(id) => {
                const i = props.people.findIndex((p) => p.id === id);
                if (i >= 0) setActive(i);
              }}
              trailing={Object.fromEntries(
                props.people.map((p, i) => {
                  const n = props.yearsByProfile[i].filter((y) => y.owned).length;
                  return [p.id, n > 0 ? `${n}개 보유` : ""];
                }),
              )}
            />
          </div>
          <Link
            href="/funnel?step=name"
            className="flex h-[52px] flex-none items-center gap-1.5 whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-accent hover:text-accent"
          >
            <span aria-hidden className="text-[17px] font-normal leading-none">
              +
            </span>
            <span className="hidden sm:inline">사주 추가</span>
            <span className="sm:hidden">추가</span>
          </Link>
        </div>
      </div>

      {/* 2 · 연도 */}
      <div className="mt-7">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
            어떤 해인가요?
          </div>
          <span className="text-xs text-slate-400">
            {ownedCount > 0 ? `구매한 해 ${ownedCount}개` : "구매한 해 없음"}
          </span>
        </div>

        {/* 칸의 구간 표기(2.4 시작)가 왜 1.1 이 아닌지를 먼저 말해 둔다(§18) */}
        <div className="mb-3 flex items-center gap-2.5 rounded-[13px] border border-accent/25 bg-accent-50 px-3.5 py-3">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-none">
            <path
              d="M12 21c-3.2-2.1-5-4.7-5-7.6C7 10.4 9 8.4 12 3c3 5.4 5 7.4 5 10.4 0 2.9-1.8 5.5-5 7.6z"
              className="fill-accent/15 stroke-accent"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M12 21v-6.5" className="stroke-accent" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="text-[13px] leading-[1.5] text-accent [text-wrap:pretty]">
            <b className="font-bold">사주의 한 해는 입춘부터 시작해요.</b> 1월 1일이 아니라 2월
            초부터 다음 해 2월 초까지의 흐름입니다.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {years.map((y) => (
            <button
              key={y.year}
              type="button"
              onClick={() =>
                y.owned && y.flowId ? router.push(`/flow/${y.flowId}`) : openPay(y)
              }
              className={`relative flex flex-col gap-0.5 rounded-2xl border-[1.5px] px-[15px] pb-[15px] pt-[13px] text-left transition-colors ${
                y.owned
                  ? "border-slate-900 bg-slate-900 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.6)]"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10.5px] font-bold tracking-[0.06em] ${
                    y.owned ? "text-white/45" : y.tag === "올해" ? "text-accent" : "text-slate-300"
                  }`}
                >
                  {y.tag === "올해" ? "올해" : `${y.tag} 해`}
                </span>
                <span
                  className={`flex flex-none items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-[3px] text-[10.5px] font-bold ${
                    y.owned ? "bg-white text-slate-900" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {y.owned && (
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {y.owned ? "보유" : "이용권 1장"}
                </span>
              </span>
              <span
                className={`mt-1.5 text-[clamp(20px,4.5vw,23px)] font-bold leading-[1.1] tracking-[-0.04em] tabular-nums ${
                  y.owned ? "text-white" : "text-slate-900"
                }`}
              >
                {y.year}
              </span>
              <span
                className={`text-[11.5px] tabular-nums ${
                  y.owned ? "text-white/70" : "text-slate-500"
                }`}
              >
                {y.range}
              </span>
              <span className={`text-[11.5px] ${y.owned ? "text-white/40" : "text-slate-300"}`}>
                만 {y.age}세
              </span>
            </button>
          ))}
        </div>
      </div>

      {payYear && (
        <PayModal
          name={me.name}
          option={payYear}
          tickets={props.tickets}
          busy={busy}
          failure={failure}
          onConfirm={props.v2Enabled ? () => openContext(payYear) : () => void start(payYear.year)}
          onClose={closePay}
        />
      )}

      {ctxYear && (
        <SituationSheet
          key={`${me.id}-${ctxYear.year}`}
          name={me.name}
          option={ctxYear}
          busy={busy}
          failure={failure}
          onSubmit={(answer) => void start(ctxYear.year, answer)}
          onClose={closeContext}
        />
      )}
    </section>
  );
}

/**
 * 안 산 해를 눌렀을 때의 결제 시트. 모바일에선 바닥에 붙고 sm 부터 가운데 카드다.
 *
 * "이용권으로 열기" 는 잔액 0이어도 누를 수 있다 — 잔액은 화면이 뜬 시점의
 * 스냅숏이라 낡았을 수 있고, 진짜 판정은 서버가 한다. 402 로 돌아오면 충전 링크가
 * 이 자리(failure)에 뜬다. 잔액이 0으로 보일 땐 흐리게만 그린다(시안의 opacity
 * 처리 그대로).
 */
function PayModal({
  name,
  option,
  tickets,
  busy,
  failure,
  onConfirm,
  onClose,
}: {
  name: string;
  option: YearOption;
  tickets: number;
  busy: boolean;
  failure: StartFailure | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${option.year}년 흐름 열기`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-none rounded-t-[22px] bg-white px-5 pb-6 pt-3.5 shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.35)] sm:max-w-[420px] sm:rounded-[22px] sm:px-6"
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-[38px] rounded-full bg-slate-200" />
        <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
          {name} · 한 해의 흐름
        </div>
        <div className="text-[21px] font-bold leading-[1.25] tracking-[-0.04em]">
          {option.year}년, 아직 열지 않은 해예요
        </div>
        <div className="mt-1.5 text-[13.5px] text-gray-500">{option.range} · 입춘 기준</div>

        <button
          ref={confirmRef}
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`mt-5 flex w-full items-center justify-between gap-3 rounded-[15px] border-[1.5px] px-4 py-[15px] text-left transition-colors disabled:opacity-60 ${
            tickets > 0
              ? "border-slate-900 bg-slate-50 hover:border-slate-700"
              : "border-slate-200 bg-white opacity-45"
          }`}
        >
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              {busy ? "준비하는 중…" : "이용권으로 열기"}
            </span>
            <span className="text-[12.5px] text-slate-400">
              {tickets > 0 ? `보유 ${tickets}장` : "보유한 이용권이 없어요"}
            </span>
          </span>
          <span className="whitespace-nowrap text-sm font-bold text-slate-900">1장</span>
        </button>

        {failure && (
          <p role="alert" className="mt-3 text-[13px] leading-[1.55] text-red-600">
            {failure.text}
            {failure.action && (
              <>
                {" "}
                <Link
                  href={failure.action.href}
                  className="font-semibold underline underline-offset-2"
                >
                  {failure.action.label}
                </Link>
              </>
            )}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full pb-0.5 pt-3 text-center text-sm font-semibold text-slate-400 transition-colors hover:text-slate-500"
        >
          다음에 볼게요
        </button>
      </div>
    </div>
  );
}
