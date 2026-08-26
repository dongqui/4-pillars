"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConfirmState } from "../_lib/to-confirm";
import { formatPeriod } from "../_lib/to-confirm";

export function FlowConfirm({ state }: { state: ConfirmState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (state.kind === "no_profile") {
    return (
      <p className="text-[13.5px] leading-[1.55] text-gray-500">
        먼저 사주 정보를 저장해주세요.
      </p>
    );
  }

  const period = formatPeriod(state.periodStart, state.periodEnd);

  if (state.kind === "owned") {
    return (
      <section className="mx-auto max-w-[520px] px-5 py-9">
        <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">지금의 흐름</h1>
        <p className="mb-5 text-[13.5px] text-gray-500">{state.profileName}님의 현재 흐름</p>
        <dl className="mb-5">
          <dt className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">적용 기간</dt>
          <dd className="text-[13.5px]">{period}</dd>
        </dl>
        <p className="mb-5 text-[13.5px] text-gray-500">
          이미 확인한 흐름이에요. 이용권을 추가로 사용하지 않습니다.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/flow/${state.flowId}`)}
          className="w-full rounded-[14px] bg-accent py-3 text-sm font-bold text-white"
        >
          이어서 보기
        </button>
      </section>
    );
  }

  // state 는 여기서 이미 "new" 로 좁혀져 있지만(no_profile·owned 는 위에서
  // return 했다), 그 좁힘은 아래에 새로 선언하는 함수(start) 안까지 이어지지
  // 않는다 — TS 는 클로저 내부에서 바깥 변수를 다시 원래 유니온으로 본다. 로컬
  // 상수에 한 번 더 담아 그 타입을 고정한다.
  const newState = state;

  async function start() {
    setBusy(true);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: newState.profileId }),
    });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/flow/${id}`);
  }

  return (
    <section className="mx-auto max-w-[520px] px-5 py-9">
      <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">지금의 흐름</h1>
      <p className="mb-5 text-[13.5px] text-gray-500">
        {state.profileName}님의 현재 흐름을 살펴볼게요.
      </p>
      <dl className="mb-5">
        <dt className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">적용 기간</dt>
        <dd className="text-[13.5px]">{period}</dd>
      </dl>
      <p className="mb-5 text-[13.5px] text-gray-500">이용권 1장을 사용합니다.</p>
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="w-full rounded-[14px] bg-accent py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {busy ? "준비하는 중…" : "지금의 흐름 보기"}
      </button>
    </section>
  );
}
