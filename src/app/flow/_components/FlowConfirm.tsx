"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PersonOption } from "@/lib/profiles/option";
import { PersonPicker } from "@/components/PersonPicker";
import type { YearOption } from "../_lib/to-confirm";
import { toStartOutcome, type StartFailure } from "../_lib/to-start-outcome";

export interface FlowConfirmProps {
  people: PersonOption[];
  /** 프로필별 연도 칸. people 과 같은 순서(같은 인덱스가 같은 사람)다 */
  yearsByProfile: YearOption[][];
  /** 처음 열었을 때 고를 프로필의 인덱스 */
  initialProfile: number;
  /** 지금의 명리 연도 — 기본 선택값이자, 프로필을 바꿔 고른 해가 사라졌을 때 물러서는 값 */
  currentYear: number;
  ticketPriceLabel: string;
}

export function FlowConfirm(props: FlowConfirmProps) {
  const router = useRouter();
  const [active, setActive] = useState(props.initialProfile);
  const [year, setYear] = useState(props.currentYear);
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
  // 프로필을 바꾸면 고른 해가 그 사람의 범위 밖일 수 있다(태어나기 전이라 칸 자체가
  // 없다). 그 사람의 마지막(가장 먼 미래) 칸이 아니라 "올해" 로 되돌린다 — 처음
  // 열었을 때의 기본 선택과 같은 자리라, 프로필만 바꿨을 뿐인데 결제 버튼 위 연도가
  // 낯선 미래로 튀는 일이 없다. currentYear 는 모든 프로필의 칸에 항상 있다: 이미
  // 저장된 사람은 태어난 시점이 지금보다 앞이라 명리 출생 연도가 currentYear 를
  // 넘을 수 없다 — 그래도 만에 하나를 대비해 마지막 칸을 최종 안전망으로 둔다.
  const selected =
    years.find((y) => y.year === year) ??
    years.find((y) => y.year === props.currentYear) ??
    years[years.length - 1];

  const ownedCount = years.filter((y) => y.owned).length;

  async function start() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: me.id, year: selected.year }),
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
        사주와 연도를 고르면 그 해의 큰 흐름부터 달마다 달라지는 변화까지 정리해 드려요.
      </p>

      {/* 1 · 프로필 */}
      <div className="relative z-20 mt-7">
        <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
          누구의 흐름인가요?
        </div>
        <PersonPicker
          people={props.people}
          selectedId={me.id}
          onPick={(id) => {
            const i = props.people.findIndex((p) => p.id === id);
            if (i >= 0) setActive(i);
          }}
        />
      </div>

      {/* 2 · 연도 */}
      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
            어떤 해인가요?
          </div>
          <span className="text-xs text-slate-400">
            {ownedCount > 0 ? `구매한 해 ${ownedCount}개` : "구매한 해 없음"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {years.map((y) => {
            const on = y.year === selected.year;
            return (
              <button
                key={y.year}
                type="button"
                aria-pressed={on}
                onClick={() => setYear(y.year)}
                className={`relative flex flex-col gap-0.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-colors ${
                  on
                    ? y.owned
                      ? "border-slate-900 bg-slate-900"
                      : "border-accent bg-slate-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span
                  className={`mb-0.5 text-[10.5px] font-bold tracking-[0.07em] ${
                    on && y.owned ? "text-white/50" : y.tag === "올해" ? "text-accent" : "text-slate-300"
                  }`}
                >
                  {y.tag}
                </span>
                <span
                  className={`text-[21px] font-bold leading-[1.1] tracking-[-0.04em] tabular-nums ${
                    on && y.owned ? "text-white" : "text-slate-900"
                  }`}
                >
                  {y.year}
                </span>
                <span className={`text-xs ${on && y.owned ? "text-white/60" : "text-slate-400"}`}>
                  만 {y.age}세
                </span>
                {y.owned && (
                  <span
                    aria-label="이미 구매한 해"
                    className={`absolute right-2.5 top-2.5 flex size-[17px] items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      on ? "bg-white/30" : "bg-slate-900"
                    }`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          ✓ 이미 구매한 해 · 결제 없이 다시 볼 수 있어요
        </p>
      </div>

      {/* 3 · CTA */}
      <div className="mt-7 flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-400">
            {me.name} · {selected.year}년
          </div>
          <div className="text-[17px] font-bold tracking-[-0.03em]">
            {selected.owned
              ? `${selected.year}년 흐름 다시 보기`
              : `${selected.year}년 흐름 살펴보기`}
          </div>
          <div className="mt-1 text-[13px] text-gray-500">
            {selected.owned
              ? "이미 구매한 해예요. 결제 없이 열립니다."
              : `이용권 1장 또는 ${props.ticketPriceLabel}`}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            selected.owned && selected.flowId
              ? router.push(`/flow/${selected.flowId}`)
              : void start()
          }
          className={`flex-none rounded-[14px] px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-60 ${
            selected.owned ? "bg-slate-900" : "bg-accent"
          }`}
        >
          {busy ? "준비하는 중…" : selected.owned ? "바로 열기" : "흐름 보기"}
        </button>
      </div>

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
    </section>
  );
}
