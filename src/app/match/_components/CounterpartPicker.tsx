"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { CreateProfileBody } from "@/lib/profiles/input";
import type { PersonOption } from "../_lib/to-person-option";
import { emptyDraft, toCounterpart, type Draft } from "../_lib/to-counterpart";
import { NewPersonForm } from "./NewPersonForm";
import { PersonList } from "./PersonList";

/**
 * 상대 선택값. "saved" 는 이미 있는 프로필 id 하나, "new" 는 즉석 입력 —
 * MatchForm 이 이 kind 로 submit 본문의 두 필드(counterpartProfileId | counterpart) 중
 * 정확히 하나만 채운다. name 은 두 갈래 모두에 둬서 RelationPicker 가 프로필을
 * 다시 조회하지 않고 라벨에 바로 쓸 수 있게 한다.
 */
export type CounterpartValue =
  | { kind: "saved"; profileId: string; name: string }
  | { kind: "new"; input: CreateProfileBody; name: string };

interface Props {
  /** 저장된 후보 전체 — self/other 둘 다. "나"로 고른 사람은 부모가 걸러서 넘긴다. */
  people: PersonOption[];
  /** 나로 선택된 프로필 id — 자기 자신을 상대로 고르지 못하게 목록에서 뺀다 */
  excludeId: string;
  value: CounterpartValue | null;
  onChange: (next: CounterpartValue | null) => void;
}

type Segment = "saved" | "new";

/**
 * 세그먼트 전환과 두 갈래(저장된 사람 목록 / 즉석 입력 폼)를 잇는 디스패처.
 *
 * "new" 쪽 draft 는 NewPersonForm 이 아니라 여기서 소유한다(NewPersonForm 은 controlled).
 * draft 를 자식에 두면 진실의 원천이 부모의 CounterpartValue 와 자식의 draft, 둘로
 * 갈라진다 — "저장된 사람" 으로 갔다 돌아왔을 때 화면(자식의 draft)과 실제 제출값
 * (부모가 마지막으로 들고 있던 값)이 다른 사람을 가리킬 수 있다. 하나로 합쳐서
 * 세그먼트를 넘나들 때마다 이 컴포넌트가 "지금 보이는 것"에서 다시 계산해 올린다.
 */
export function CounterpartPicker({ people, excludeId, value, onChange }: Props) {
  const candidates = people.filter((p) => p.id !== excludeId);
  const [segment, setSegment] = useState<Segment>(candidates.length > 0 ? "saved" : "new");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // 부모의 CounterpartValue 를 그대로 따라간다(별도 로컬 state 를 두지 않는다) —
  // "나"를 바꿔 이 사람이 후보에서 빠지는 경우에도 두 값이 어긋날 일이 없다.
  const selectedSavedId = value?.kind === "saved" ? value.profileId : null;

  function emitDraft(next: Draft) {
    const input = toCounterpart(next);
    onChange(input ? { kind: "new", input, name: input.name } : null);
  }

  function selectSegment(next: Segment) {
    setSegment(next);
    // 두 방향 모두 여기서 다시 계산해 올린다. 한쪽만(예: "new"→"saved") 다시 계산하면
    // 반대 방향("saved"→"new")에서는 화면에 남아 있는 draft 와 실제 제출값이 갈라진다 —
    // "새로 입력"에 B 를 채워 두고 "저장된 사람"에서 A 를 골랐다가 "새로 입력"으로
    // 돌아오면, 화면은 B 를 보여주면서 제출은 A 로 나가는 사고가 난다.
    if (next === "saved") {
      const person = candidates.find((p) => p.id === selectedSavedId);
      onChange(person ? { kind: "saved", profileId: person.id, name: person.name } : null);
    } else {
      emitDraft(draft);
    }
  }

  function selectSaved(person: PersonOption) {
    onChange({ kind: "saved", profileId: person.id, name: person.name });
  }

  function updateDraft(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    emitDraft(next);
  }

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-bold tracking-[-0.02em]">상대는 누구인가요?</h2>
      <p className="mb-3 text-[13px] text-gray-500">저장된 사람 중에서 고르거나 새로 입력해요</p>

      <SegmentedControl<Segment>
        options={[
          { value: "saved", label: "저장된 사람" },
          { value: "new", label: "새로 입력" },
        ]}
        value={segment}
        onChange={selectSegment}
        className="mb-3 max-w-[280px]"
      />

      {segment === "saved" ? (
        <PersonList
          people={candidates}
          selectedId={selectedSavedId}
          onSelect={selectSaved}
          emptyMessage="저장된 사람이 없어요. 새로 입력해 주세요."
        />
      ) : (
        <NewPersonForm draft={draft} onDraftChange={updateDraft} />
      )}
    </section>
  );
}
