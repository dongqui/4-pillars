"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RelationInput } from "@/lib/matches/relation-types";
import type { PersonOption } from "../_lib/to-person-option";
import { CounterpartPicker, type CounterpartValue } from "./CounterpartPicker";
import { RelationPicker } from "./RelationPicker";

const PERSON_BTN =
  "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors";
const PERSON_BTN_ON = "border-accent bg-accent-50";
const PERSON_BTN_OFF = "border-slate-200 bg-white hover:border-slate-300";

export function MatchForm({ people }: { people: PersonOption[] }) {
  const router = useRouter();
  // "나"는 내 사주(kind='self')에서만 고른다 — 궁합 상대로 저장된 사람(kind='other')을
  // 나로 쓰면 상대의 생년월일이 내 사주 행세를 하게 된다.
  const subjects = people.filter((p) => p.kind === "self");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [counterpart, setCounterpart] = useState<CounterpartValue | null>(null);
  const [relation, setRelation] = useState<RelationInput>({
    type: null, subjectRole: null, counterpartRole: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subject = subjects.find((p) => p.id === subjectId) ?? null;

  async function submit() {
    if (!subjectId || !counterpart) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subjectProfileId: subjectId,
        ...(counterpart.kind === "saved"
          ? { counterpartProfileId: counterpart.profileId }
          : { counterpart: counterpart.input }),
        relation,
      }),
    });
    const body = (await res.json()) as { matchId?: string; error?: string };
    if (!res.ok || !body.matchId) {
      setPending(false);
      setError(body.error ?? "궁합을 만들지 못했어요");
      return;
    }
    // 즉석 입력이었으면 결과 화면이 저장 모달을 띄운다 (Task 13).
    router.push(`/match/${body.matchId}${counterpart.kind === "new" ? "?new=1" : ""}`);
  }

  // 내 사주가 하나도 없으면 고를 것이 없다 — 퍼널로 먼저 보낸다.
  if (subjects.length === 0) {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-16 text-center md:px-8">
        <p className="mb-2 text-[19px] font-bold tracking-[-0.025em]">먼저 내 사주를 저장해 주세요</p>
        <p className="mb-7 text-[14.5px] text-slate-400 [text-wrap:pretty]">
          궁합은 내 사주와 상대의 사주를 함께 봐요.
        </p>
        <Link
          href="/funnel?step=name"
          className="inline-block rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.9)] hover:bg-accent-700"
        >
          내 사주 저장하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-8 px-5 py-8 md:px-8">
      <h1 className="text-[22px] font-bold tracking-[-0.025em]">궁합 보기</h1>

      <section>
        <h2 className="mb-1 text-[15px] font-bold tracking-[-0.02em]">나는 누구인가요?</h2>
        <p className="mb-3 text-[13px] text-gray-500">저장된 내 사주 중에서 골라주세요</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {subjects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSubjectId(p.id)}
              aria-pressed={subjectId === p.id}
              className={`${PERSON_BTN} ${subjectId === p.id ? PERSON_BTN_ON : PERSON_BTN_OFF}`}
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-[13.5px] font-bold text-slate-500">
                {p.initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-slate-900">
                  {p.name}
                </span>
                <span className="block text-[12.5px] text-slate-400">{p.birthLabel}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <CounterpartPicker
        people={people}
        excludeId={subjectId}
        value={counterpart}
        onChange={setCounterpart}
      />

      <RelationPicker
        value={relation}
        onChange={setRelation}
        subjectName={subject?.name || "나"}
        counterpartName={counterpart?.name || "상대"}
      />

      {error && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-700">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !subjectId || !counterpart}
        className="w-full rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {pending ? "만드는 중..." : "궁합 보기"}
      </button>
    </div>
  );
}
