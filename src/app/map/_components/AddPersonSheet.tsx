"use client";

import { useState } from "react";
import { hasLeapMonth } from "@/lib/saju-core";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import {
  addDraftIssues, digitsOnly, emptyAddDraft, toAddBody,
  type AddDraft, type AddDraftField,
} from "../_lib/add-draft";

const FIELD =
  "rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[15px] font-bold text-slate-100 text-center outline-none focus:border-sky-400 placeholder:text-slate-600";

const HINT_TEXT: Record<AddDraftField, string> = {
  name: "이름을 적어 주세요",
  birth: "생년월일을 네 자리 연도까지 정확히 적어 주세요",
};

/**
 * 링크를 받은 사람이 자기를 지도에 넣는 시트. 로그인을 묻지 않는다 — 이
 * 공개성이 기능의 전부다(브리프). 받는 것은 이름·생년월일·양음력 셋뿐이다:
 * 지도는 일주만 쓰고 일주는 성별·시각·출생지와 무관하다.
 */
export function AddPersonSheet({
  open,
  shareId,
  onClose,
  onAdded,
}: {
  open: boolean;
  shareId: string;
  onClose: () => void;
  /** 추가된 사람의 id. 부모가 그 사람을 선택해 카메라를 보낸다. */
  onAdded: (id: string) => void;
}) {
  const [draft, setDraft] = useState<AddDraft>(emptyAddDraft);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // 아직 아무것도 안 친 폼에는 안내를 띄우지 않는다 — 빈 폼에서 버튼이 꺼져 있는
  // 것은 사용자도 이미 안다(NewPersonForm 과 같은 판단).
  const touched = draft.name !== "" || draft.y !== "" || draft.m !== "" || draft.d !== "";
  const issues = touched ? addDraftIssues(draft) : [];
  const body = toAddBody(draft);

  const leapAvailable = (() => {
    const yy = parseInt(draft.y, 10);
    const mm = parseInt(draft.m, 10);
    return draft.calendar === "lunar" && !Number.isNaN(yy) && !Number.isNaN(mm) && hasLeapMonth(yy, mm);
  })();

  async function submit() {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/maps/${shareId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { person?: { id: string }; error?: string };
      if (!res.ok || !json.person) {
        // 중복은 이제 여기서 갈리지 않는다 — 서버가 이미 있는 사람도 201 로
        // 돌려준다(생년월일을 짐작해 상태 코드로 확인하지 못하게). 남은 에러는
        // 검증 실패와 인원 50명 초과(409)뿐이라, "이미 추가됨" 같은 문구를
        // 여기서 만들어 붙이지 않는다 — 서버 메시지를 그대로 보여준다.
        setError(json.error ?? "잠시 후 다시 시도해 주세요");
        return;
      }
      setDraft(emptyAddDraft);
      onAdded(json.person.id);
    } catch {
      setError("네트워크가 불안정해요. 다시 시도해 주세요");
    } finally {
      setSending(false);
    }
  }

  const hint = (field: AddDraftField) =>
    issues.includes(field) ? <p className="mt-1 text-[12px] text-slate-500">{HINT_TEXT[field]}</p> : null;

  return (
    <div
      aria-hidden={!open}
      // 닫히는 동안에도 마운트된 채 남으므로, inert 로 포커스·클릭 대상에서 뺀다
      // (PersonSheet.tsx 가 같은 이유로 같은 일을 한다).
      inert={!open}
      // 시트 껍데기(위치·전환)는 PersonSheet.tsx 와 같은 값이다 — 두 판이 화면
      // 같은 자리에서 다른 속도로 움직이면 눈에 띈다. 색만 다크로 바꾼다.
      className={`
        fixed z-20 bg-slate-900/95 text-slate-100 shadow-elevated backdrop-blur-[14px]
        border-t border-white/10
        transition-transform duration-300 ease-out
        inset-x-0 bottom-0 h-[40vh] rounded-t-2xl
        md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[380px] md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l
        ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}
      `}
    >
      <div className="h-full flex flex-col gap-3 overflow-y-auto px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        {/* 모바일 손잡이 — PersonSheet 와 같다 */}
        <div className="md:hidden mx-auto w-9 h-1 rounded-full bg-white/15 shrink-0" />

        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-100">지도에 추가하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-slate-400 hover:bg-white/10"
          >
            닫기
          </button>
        </div>

        <p className="text-[13px] text-slate-400">이름과 생년월일만 있으면 돼요.</p>

        <div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="이름"
            aria-label="이름"
            aria-invalid={issues.includes("name")}
            maxLength={20}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[15px] font-semibold text-slate-100 outline-none focus:border-sky-400 placeholder:text-slate-600"
          />
          {hint("name")}
        </div>

        <SegmentedControl<"solar" | "lunar">
          options={[
            { value: "solar", label: "양력" },
            { value: "lunar", label: "음력" },
          ]}
          value={draft.calendar}
          onChange={(calendar) =>
            setDraft({ ...draft, calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
          }
        />

        <div>
          <div className="flex items-center gap-2">
            <input
              value={draft.y}
              onChange={(e) => setDraft({ ...draft, y: digitsOnly(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="1990"
              aria-label="생년"
              aria-invalid={issues.includes("birth")}
              className={`w-[84px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">년</span>
            <input
              value={draft.m}
              onChange={(e) => setDraft({ ...draft, m: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생월"
              aria-invalid={issues.includes("birth")}
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">월</span>
            <input
              value={draft.d}
              onChange={(e) => setDraft({ ...draft, d: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생일"
              aria-invalid={issues.includes("birth")}
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">일</span>
          </div>
          {hint("birth")}
        </div>

        {leapAvailable && (
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
            <span className="text-[13px] text-slate-400">윤달</span>
            <Toggle
              checked={draft.isLeapMonth}
              onChange={(v) => setDraft({ ...draft, isLeapMonth: v })}
              label="윤달"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!body || sending}
          className="w-full rounded-xl bg-sky-500 py-3.5 text-[15px] font-bold text-white disabled:bg-white/10 disabled:text-slate-500"
        >
          {sending ? "더하는 중" : "지도에 추가"}
        </button>
      </div>
    </div>
  );
}
