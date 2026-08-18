"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isRelationComplete, type RelationInput } from "@/lib/matches/relation-types";
import type { PersonOption } from "../_lib/to-person-option";
import {
  counterpartAfterSubjectChange,
  type CounterpartValue,
} from "../_lib/resync-counterpart";
import { CounterpartPicker } from "./CounterpartPicker";
import { PersonList } from "./PersonList";
import { RelationPicker } from "./RelationPicker";

/**
 * people 에는 "나"로 고를 수 없는 사람(kind='other')도 섞여 있을 수 있다 — page.tsx 가
 * 이미 people.some(kind==='self') 를 확인한 뒤에만 이 컴포넌트를 렌더하므로, subjects 는
 * 항상 하나 이상이라고 가정한다.
 */
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
  // 관계까지 봐야 한다 — 여기서 빠뜨리면 '기타' 의 빈 역할 칸이 400 으로만 드러난다.
  const canSubmit = !pending && subjectId !== "" && counterpart !== null && isRelationComplete(relation);

  /**
   * "나" 를 바꾸면 상대도 다시 본다. 상대로 골라 둔 사람을 "나" 로 고르면 그 사람은
   * 상대 후보에서 빠지는데, 선택값을 그대로 두면 아무 카드도 강조되지 않은 채
   * 제출이 열려 서버가 "다른 사람을 선택해 주세요" 로 되돌린다.
   */
  function selectSubject(person: PersonOption) {
    setSubjectId(person.id);
    setCounterpart((prev) => counterpartAfterSubjectChange(prev, person.id));
  }

  async function submit() {
    // 버튼이 이미 막혀 있지만 한 번 더 본다 — 조건이 한 곳(canSubmit)에서만 나오게 둔다.
    if (!canSubmit || !counterpart) return;
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
    // 402 는 잔액 부족이다. 이 폼이 실제로 잔액이 모자란 흔한 경로다(canCreateMatch 가
    // 여기서 먼저 걸러 낸다 — /match/[id] 의 MatchOutOfTickets 는 그 사이 다른 탭에서
    // 다 썼거나 링크를 직접 연 드문 경우에만 닿는다). report 의 use-unlock.ts 와 같은
    // 모양으로, 메시지를 보여주는 대신 충전 뒤 돌아올 자리를 실어 보낸다.
    if (res.status === 402) {
      router.push(`/checkout?next=${encodeURIComponent("/match")}`);
      return;
    }
    const body = (await res.json()) as { matchId?: string; error?: string };
    if (!res.ok || !body.matchId) {
      setPending(false);
      setError(body.error ?? "궁합을 만들지 못했어요");
      return;
    }
    // 즉석 입력이었으면 결과 화면이 저장 모달을 띄운다 (Task 13).
    router.push(`/match/${body.matchId}${counterpart.kind === "new" ? "?new=1" : ""}`);
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-8 px-5 py-8 md:px-8">
      <h1 className="text-[22px] font-bold tracking-[-0.025em]">궁합 보기</h1>

      <section>
        <h2 className="mb-1 text-[15px] font-bold tracking-[-0.02em]">나는 누구인가요?</h2>
        <p className="mb-3 text-[13px] text-gray-500">저장된 내 사주 중에서 골라주세요</p>
        <PersonList people={subjects} selectedId={subjectId} onSelect={selectSubject} />
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
        disabled={!canSubmit}
        className="w-full rounded-[14px] bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {pending ? "만드는 중..." : "궁합 보기"}
      </button>
    </div>
  );
}
