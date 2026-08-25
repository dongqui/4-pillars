"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isRelationComplete, type RelationInput } from "@/lib/matches/relation-types";
import { personOptionFromInput, type PersonOption } from "../_lib/to-person-option";
import { emptyDraft, toCounterpart, type Draft } from "../_lib/to-counterpart";
import {
  counterpartAfterSubjectChange,
  newCounterpartOption,
  type CounterpartValue,
} from "../_lib/counterpart-value";
import { NewPersonForm } from "./NewPersonForm";
import { PersonSelect } from "./PersonSelect";
import { RelationPicker } from "./RelationPicker";

/** 지금 열려 있는 것 — 목록이든 폼이든 한 번에 하나다. 두 칸이 동시에 펼쳐지면
 *  화면이 길어져 아래의 관계·제출 버튼이 스크롤 밖으로 밀린다. */
type Slot = "me" | "other";

/**
 * people 은 저장한 사람 전부다. page.tsx 가 people.length > 0 을 확인한 뒤에만 이
 * 컴포넌트를 렌더하므로 목록은 항상 하나 이상이라고 가정한다.
 */
export function MatchForm({
  people: initialPeople,
  defaultSubjectId,
  defaultOpen,
  children,
}: {
  people: PersonOption[];
  /**
   * 계정의 "나"(users.primary_profile_id). 정해지지 않았으면 null — 첫 줄로 물러선다.
   * 고정된 값이 아니다 — 홈 셀렉터에서 마지막으로 고른 사람으로 움직인다. 이 화면에서
   * "나" 칸을 바꿔도(`selectSubject`) 그 선택은 여기서만 산다 — users.primary_profile_id
   * 에 다시 쓰지 않는다(스펙의 "승격하지 않는 것").
   */
  defaultSubjectId: string | null;
  /**
   * 입력부를 펼친 채로 시작할지. 이미 본 궁합이 없으면 펼친다 — 이 화면에서 할 수
   * 있는 일이 그것 하나뿐인데 접어 두면 빈 화면처럼 보인다. 있으면 접는다:
   * 다시 보러 온 사람에게는 목록이 본문이다.
   */
  defaultOpen: boolean;
  /** 입력부 아래에 붙는 것 — 이미 본 궁합 목록. 이 컴포넌트가 페이지의 가로폭
   *  컨테이너를 갖고 있어서, 같은 폭에 맞추려면 여기로 들어와야 한다. */
  children?: ReactNode;
}) {
  const router = useRouter();
  // 서버가 준 목록에 이 화면에서 만든 내 사주가 더해진다 — 만들자마자 고를 수
  // 있어야 하는데 router.refresh() 를 기다리면 폼이 닫힌 채 빈 칸이 남는다.
  const [people, setPeople] = useState(initialPeople);
  // 나 칸과 상대 칸이 같은 목록을 쓴다. 예전에는 "나" 를 kind='self' 로 좁혔는데,
  // 그러면 똑같은 사람이 궁합에서 저장됐으면 나로 못 서고 홈에서 입력됐으면 설 수
  // 있었다 — 들어온 문 말고는 두 사람을 가르는 것이 없었다.
  const subjects = people;
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "");
  const [counterpart, setCounterpart] = useState<CounterpartValue | null>(null);
  const [relation, setRelation] = useState<RelationInput>({
    type: null, subjectRole: null, counterpartRole: null,
  });

  const [open, setOpen] = useState(defaultOpen);
  const [openPanel, setOpenPanel] = useState<Slot | null>(null);
  const [formFor, setFormFor] = useState<Slot | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formPending, setFormPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subject = people.find((p) => p.id === subjectId) ?? null;
  // 자기 자신을 상대로 고르지 못하게 목록에서 뺀다.
  const candidates = people.filter((p) => p.id !== subjectId);
  // 즉석 입력한 상대는 행이 없어 candidates 에 없다 — 목록 끝에 한 줄로 끼워
  // 저장된 사람과 같은 모양으로 보여준다(시안).
  const newRow =
    counterpart?.kind === "new"
      ? newCounterpartOption(counterpart.input, counterpart.save)
      : null;
  const counterpartRows = newRow ? [...candidates, newRow] : candidates;
  const selectedCounterpart =
    counterpart === null
      ? null
      : counterpart.kind === "new"
        ? newRow
        : (candidates.find((p) => p.id === counterpart.profileId) ?? null);

  // 관계까지 봐야 한다 — 여기서 빠뜨리면 '기타' 의 빈 역할 칸이 400 으로만 드러난다.
  const canSubmit = !pending && subjectId !== "" && counterpart !== null && isRelationComplete(relation);

  /**
   * 버튼 아래 한 줄. 시안은 "두 사람과 관계를 모두 골라주세요" 한 문장이지만,
   * 이 앱에서 관계 유형은 고르지 않아도 된다(relationLens 가 유형 없는 시선으로
   * 물러선다). 안 골라도 되는 것을 고르라고 하면 사용자는 없는 할 일을 찾는다 —
   * 실제로 막고 있는 것만 짚는다.
   */
  const ctaHint =
    subjectId === "" || counterpart === null
      ? "두 사람을 모두 골라주세요"
      : isRelationComplete(relation)
        ? "이용권 1장으로 바로 볼 수 있어요"
        : "관계에서 두 사람의 역할을 채워 주세요";

  /**
   * "나" 를 바꾸면 상대도 다시 본다. 상대로 골라 둔 사람을 "나" 로 고르면 그 사람은
   * 상대 후보에서 빠지는데, 선택값을 그대로 두면 아무 줄도 강조되지 않은 채
   * 제출이 열려 서버가 "다른 사람을 선택해 주세요" 로 되돌린다.
   */
  function selectSubject(person: PersonOption) {
    setSubjectId(person.id);
    setCounterpart((prev) => counterpartAfterSubjectChange(prev, person.id));
    setOpenPanel(null);
  }

  function selectCounterpart(person: PersonOption) {
    // 이미 끼워 둔 즉석 입력 줄을 다시 누른 것이면 선택은 그대로다.
    if (person.id !== newRow?.id) {
      setCounterpart({ kind: "saved", profileId: person.id, name: person.name });
    }
    setOpenPanel(null);
  }

  function togglePanel(slot: Slot) {
    setOpenPanel((prev) => (prev === slot ? null : slot));
    setFormFor(null);
  }

  /** 폼은 열 때마다 빈 상태로 시작한다 — 지난번에 치다 만 값이 남아 있으면
   *  다른 사람을 넣는 줄 알고 확인 버튼을 누르게 된다. */
  function openForm(slot: Slot) {
    setFormFor(slot);
    setOpenPanel(null);
    setFormError(null);
    // "나" 는 켠 채로, "상대" 는 끈 채로 — 내 사주는 남기려고 넣는 것이고
    // 상대는 한 번 보고 마는 경우가 흔하다(시안의 기본값).
    setDraft({ ...emptyDraft, saved: slot === "me" });
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function submitForm() {
    const input = toCounterpart(draft);
    // 버튼이 이미 막혀 있지만 한 번 더 본다 — 판정이 한 곳에서만 나오게 둔다.
    if (!input) return;

    if (formFor === "other") {
      // 상대는 여기서 행을 만들지 않는다. 궁합을 실제로 만들 때 /api/matches 가
      // 넣는다 — 폼만 채우고 떠난 사람의 생년월일을 남기지 않는다.
      setCounterpart({ kind: "new", input, name: input.name, save: draft.saved });
      setFormFor(null);
      return;
    }

    // "나" 는 반대다. subjectProfileId 로 보낼 진짜 id 가 필요하므로 지금 만든다.
    setFormPending(true);
    setFormError(null);
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // saved 는 input 안이 아니라 형제 필드다 — 저장 여부는 행의 값이 아니라
      // 서버가 정하는 kind 라서다(handler 의 bodySchema).
      body: JSON.stringify({ ...input, saved: draft.saved }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setFormPending(false);
    // 지우라고 말하지 않는다 — 프로필을 지우는 길이 이 앱에 아직 없다(profiles 에는
    // POST 뿐이다). 대신 지금 할 수 있는 것을 짚는다: 'temp' 는 MAX_PROFILES 가 아니라
    // MAX_TEMP_PROFILES 쪽에서 세므로, 저장을 끄면 이번 궁합은 그대로 볼 수 있다.
    if (res.status === 409) {
      setFormError(
        "저장할 수 있는 사람 20명을 다 채웠어요. '이 프로필 저장하기' 를 끄면 이번 궁합에는 쓸 수 있어요.",
      );
      return;
    }
    if (!res.ok || !body.id) {
      setFormError(body.error ?? "저장하지 못했어요");
      return;
    }
    const added = personOptionFromInput(body.id, input, draft.saved);
    setPeople((prev) => [added, ...prev]);
    setSubjectId(added.id);
    setCounterpart((prev) => counterpartAfterSubjectChange(prev, added.id));
    setFormFor(null);
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
          : { counterpart: counterpart.input, saveCounterpart: counterpart.save }),
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
    router.push(`/match/${body.matchId}`);
  }

  return (
    <div className="mx-auto max-w-[520px] px-5 py-8 pb-24 md:px-8">
      <h1 className="mb-5 text-2xl font-bold tracking-[-0.025em]">궁합 보기</h1>

      {/* 입력부 전체를 접는 스위치. 이미 본 궁합이 쌓이면 이 화면의 본문은
          목록이 되고, 새로 만드는 일은 가끔이다 — 그때마다 긴 폼을 지나
          스크롤하게 두지 않는다. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-[15px] py-[13px] text-left transition-colors hover:border-slate-300 ${
          open ? "mb-5" : ""
        }`}
      >
        <span
          className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] bg-accent-50 text-accent transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold tracking-[-0.015em] text-slate-900">
            새 궁합 보기
          </span>
          <span className="mt-0.5 block text-[12.5px] text-slate-400">
            {open ? "나와 상대를 고르면 돼요" : "이용권 1장으로 새 궁합을 볼 수 있어요"}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className={`flex-none transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
      <div className="space-y-[26px]">
      <PersonSelect
        title="나는 누구인가요?"
        hint="저장된 사람 중에서 골라주세요"
        placeholder="내 사주를 골라주세요"
        people={subjects}
        selected={subject}
        open={openPanel === "me"}
        onToggle={() => togglePanel("me")}
        onSelect={selectSubject}
        addLabel="내 사주 추가하기"
        onAdd={() => openForm("me")}
      >
        {formFor === "me" && (
          <NewPersonForm
            title="내 사주 추가"
            submitLabel="추가하기"
            saveLabel="이 프로필 저장하기"
            saveHint="저장하면 다음에도 골라서 바로 볼 수 있어요"
            draft={draft}
            onDraftChange={updateDraft}
            onCancel={() => setFormFor(null)}
            onSubmit={submitForm}
            pending={formPending}
            error={formError}
          />
        )}
      </PersonSelect>

      <PersonSelect
        title="상대는 누구인가요?"
        hint="저장된 사람 중에서 고르거나 새로 입력해요"
        placeholder="상대를 골라주세요"
        people={counterpartRows}
        selected={selectedCounterpart}
        open={openPanel === "other"}
        onToggle={() => togglePanel("other")}
        onSelect={selectCounterpart}
        addLabel="새로 입력하기"
        onAdd={() => openForm("other")}
      >
        {formFor === "other" && (
          <NewPersonForm
            title="상대 정보 입력"
            submitLabel="이 사람으로 보기"
            saveLabel="이 사람 프로필 저장하기"
            saveHint="저장하지 않으면 이번 궁합에만 사용해요"
            draft={draft}
            onDraftChange={updateDraft}
            onCancel={() => setFormFor(null)}
            onSubmit={submitForm}
          />
        )}
      </PersonSelect>

      <RelationPicker
        value={relation}
        onChange={setRelation}
        subjectName={subject?.name || "나"}
        counterpartName={counterpart?.name || "상대"}
      />

      {error && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-700">{error}</p>
      )}

      <div className="pt-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-[14px] bg-accent py-[17px] text-base font-bold tracking-[-0.01em] text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,.5)] transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          {pending ? "만드는 중..." : "궁합 보기"}
        </button>
        <p className="mt-3 text-center text-[12px] text-slate-400">{ctaHint}</p>
      </div>
      </div>
      )}

      {children}
    </div>
  );
}
