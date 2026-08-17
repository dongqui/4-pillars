"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { CreateProfileBody } from "@/lib/profiles/input";
import type { PersonOption } from "../_lib/to-person-option";
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
 * 세그먼트 전환과 두 갈래(저장된 사람 목록 / 즉석 입력 폼)를 잇는 얇은 디스패처.
 * 각 갈래의 실제 상태·검증은 NewPersonForm(_lib/to-counterpart)과 PersonList 가 갖는다.
 */
export function CounterpartPicker({ people, excludeId, value, onChange }: Props) {
  const candidates = people.filter((p) => p.id !== excludeId);
  const [segment, setSegment] = useState<Segment>(candidates.length > 0 ? "saved" : "new");
  // 부모의 CounterpartValue 를 그대로 따라간다(별도 로컬 state 를 두지 않는다) —
  // "나"를 바꿔 이 사람이 후보에서 빠지는 경우에도 두 값이 어긋날 일이 없다.
  const selectedSavedId = value?.kind === "saved" ? value.profileId : null;

  function selectSegment(next: Segment) {
    setSegment(next);
    // "new" 로 돌아갈 땐 다시 계산하지 않는다 — NewPersonForm 은 계속 마운트돼 있고
    // 자기 draft 가 바뀔 때만 onChange 를 부르므로, 감췄다 보여주는 것만으로 충분하다.
    if (next === "saved") {
      const person = candidates.find((p) => p.id === selectedSavedId);
      onChange(person ? { kind: "saved", profileId: person.id, name: person.name } : null);
    }
  }

  function selectSaved(person: PersonOption) {
    onChange({ kind: "saved", profileId: person.id, name: person.name });
  }

  function handleNewChange(input: CreateProfileBody | null) {
    onChange(input ? { kind: "new", input, name: input.name } : null);
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

      <div className={segment === "saved" ? "" : "hidden"}>
        <PersonList
          people={candidates}
          selectedId={selectedSavedId}
          onSelect={selectSaved}
          emptyMessage="저장된 사람이 없어요. 새로 입력해 주세요."
        />
      </div>

      <NewPersonForm onChange={handleNewChange} hidden={segment !== "new"} />
    </section>
  );
}
