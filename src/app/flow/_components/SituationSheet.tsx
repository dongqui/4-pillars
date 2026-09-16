"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CAREER_OPTIONS,
  CONCERN_OPTIONS,
  RELATIONSHIP_OPTIONS,
  isContextComplete,
  type Career,
  type Concern,
  type ContextAnswer,
  type Relationship,
} from "@/lib/flows/context";
import type { YearOption } from "../_lib/to-confirm";
import type { StartFailure } from "../_lib/to-start-outcome";

/**
 * 결제를 확인한 뒤 지금 상황을 묻는 시트. 시안(Saju Yearly Report)의 두 번째 시트다.
 *
 * 셋 다 골라야 버튼이 열린다. 답하기 싫은 사람을 위해 건너뛰기를 두는 대신
 * "말하고 싶지 않아요" 를 선택지로 둔다 — 안 물어본 것과 답하지 않은 것은
 * 프롬프트가 다르게 다뤄야 하는 서로 다른 사실이다(src/lib/flows/context.ts).
 *
 * 요청이 여기서 나가므로 실패 문구도 이 자리에 뜬다.
 */
export function SituationSheet({
  name,
  option,
  busy,
  failure,
  onSubmit,
  onClose,
}: {
  name: string;
  option: YearOption;
  busy: boolean;
  failure: StartFailure | null;
  onSubmit: (answer: ContextAnswer) => void;
  onClose: () => void;
}) {
  const [career, setCareer] = useState<Career | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [mainConcern, setMainConcern] = useState<Concern | null>(null);
  const answer = { career, relationship, mainConcern };
  const ready = isContextComplete(answer) && !busy;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const subtitle =
    option.tag === "지난"
      ? "선택한 해가 시작될 무렵의 상황을 알려주세요. 기억이 정확하지 않아도 괜찮아요."
      : "지금의 상황을 기준으로 설명을 맞춰요. 그해 내내 같은 상황이라고 보진 않아요.";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="지금 상황 알려주기"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-none rounded-t-[22px] bg-white px-5 pb-6 pt-3.5 shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.35)] sm:max-w-[440px] sm:rounded-[22px] sm:px-6"
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-[38px] rounded-full bg-slate-200" />
        <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
          {name} · {option.year}년 흐름
        </div>
        <div className="text-[21px] font-bold leading-[1.25] tracking-[-0.04em]">
          지금 상황을 알려주세요
        </div>
        <div className="mt-1.5 text-[13.5px] leading-[1.5] text-gray-500 [text-wrap:pretty]">
          {subtitle}
        </div>

        <ChipGroup label="현재 직업" options={CAREER_OPTIONS} value={career} onPick={setCareer} />
        <ChipGroup label="연애 상태" options={RELATIONSHIP_OPTIONS} value={relationship} onPick={setRelationship} />
        <ChipGroup label="가장 궁금한 것" options={CONCERN_OPTIONS} value={mainConcern} onPick={setMainConcern} />

        <p className="mt-4 text-[12px] text-slate-400">
          답변은 이 리포트를 쓰는 데만 쓰이고, 리포트와 함께 저장돼요.
        </p>

        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (isContextComplete(answer)) onSubmit(answer);
          }}
          className={`mt-6 w-full rounded-[14px] py-[15px] text-[15px] font-bold text-white transition-colors ${
            ready ? "bg-accent" : "cursor-default bg-slate-300"
          }`}
        >
          {busy ? "준비하는 중…" : "리포트 만들기"}
        </button>

        {failure && (
          <p role="alert" className="mt-3 text-[13px] leading-[1.55] text-red-600">
            {failure.text}
            {failure.action && (
              <>
                {" "}
                <Link href={failure.action.href} className="font-semibold underline underline-offset-2">
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
          다음에 할게요
        </button>
      </div>
    </div>
  );
}

/**
 * 선택지 한 줄. 무엇을 고를 수 있는가는 여기가 아니라 src/lib/flows/context.ts 가
 * 정한다 — 화면이 목록을 따로 들면 스키마에 없는 선택지가 생기고, 그걸 고른
 * 사용자만 400 을 받는다.
 */
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2.5 text-[12.5px] font-bold text-slate-700">{label}</div>
      <div className="flex flex-wrap gap-[7px]">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(o.value)}
              className={`rounded-full border-[1.5px] px-3.5 py-[9px] text-[13.5px] font-semibold tracking-[-0.01em] transition-colors ${
                on
                  ? "border-accent bg-accent-50 text-accent"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
