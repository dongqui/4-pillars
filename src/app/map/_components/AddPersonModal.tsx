"use client";

import { useEffect, useRef, useState } from "react";
import { hasLeapMonth } from "@/lib/saju-core";
import { Toggle } from "@/components/Toggle";
import {
  addDraftIssues, digitsOnly, emptyAddDraft, toAddBody,
  type AddDraft,
} from "../_lib/add-draft";

type BirthField = "y" | "m" | "d";

/**
 * 링크를 받은 사람이 자기를 지도에 넣는 모달. 로그인을 묻지 않는다 — 이
 * 공개성이 기능의 전부다(브리프). 받는 것은 이름·생년월일·양음력뿐이다:
 * 지도는 일주만 쓰고 일주는 성별·시각·출생지와 무관하다.
 *
 * 시트가 아니라 모달인 것은 시안이다 — 데스크톱은 중앙 420px, 모바일은 하단.
 * open prop 은 없다 — 부모(MapShell)가 `{adding && <AddPersonModal .../>}`로
 * 마운트 자체를 열고 닫는다. 닫으면 언마운트라 입력이 지워진다. 시트 시절에는
 * 마운트를 유지해 입력이 남았지만, 폼이 세 칸뿐이라 다시 치는 비용이 상태
 * 유지 코드보다 싸다.
 */
export function AddPersonModal({
  shareId,
  onClose,
  onAdded,
}: {
  shareId: string;
  onClose: () => void;
  /** 추가된 사람의 id. 부모가 그 사람을 선택해 카메라를 보낸다. */
  onAdded: (id: string) => void;
}) {
  const [draft, setDraft] = useState<AddDraft>(emptyAddDraft);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [focusField, setFocusField] = useState<BirthField | null>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);

  // 오버레이 클릭이 아니어도 나갈 방법이 있어야 한다 — 키보드로 들어온
  // 사용자가 Tab 만으로 카드 밖까지 나가게 하지 않는다.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const body = toAddBody(draft);
  const name = draft.name.trim();

  // 세 칸이 다 찼는데도 유효하지 않을 때만 에러로 말한다 — 치는 중에 빨개지면
  // 오타가 아니라 미완성까지 혼나는 셈이다.
  const birthComplete = draft.y.length === 4 && draft.m !== "" && draft.d !== "";
  const birthInvalid = birthComplete && addDraftIssues(draft).includes("birth");

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
        // 중복은 여기서 갈리지 않는다 — 서버가 이미 있는 사람도 201 로
        // 돌려준다(생년월일을 짐작해 상태 코드로 확인하지 못하게). 남은 에러는
        // 검증 실패와 인원 50명 초과(409)뿐이라, 서버 메시지를 그대로 보여준다.
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

  const boxClass = (field: BirthField) =>
    `flex items-baseline gap-1 rounded-[13px] border-[1.5px] bg-white px-3 py-3 cursor-text transition-colors ${
      birthInvalid ? "border-rose-500" : focusField === field ? "border-blue-600" : "border-slate-200"
    }`;
  const numClass =
    "w-full border-0 bg-transparent p-0 text-center text-[19px] font-bold tracking-[0.04em] text-slate-900 outline-none tabular-nums placeholder:text-slate-300";
  const segClass = (on: boolean) =>
    `rounded-[7px] px-3 py-[5px] text-[12.5px] font-bold border-0 cursor-pointer transition-colors ${
      on ? "bg-white text-slate-900 shadow-sm" : "bg-transparent text-slate-400"
    }`;

  return (
    // 오버레이 클릭 = 닫기. 카드 자체의 클릭은 stopPropagation 으로 삼킨다.
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] md:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="지도에 추가하기"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3.5 rounded-t-[22px] shadow-elevated md:max-w-[420px] md:rounded-[22px] md:px-6 md:pb-6 md:pt-4"
      >
        {/* 모바일 손잡이 */}
        <div className="md:hidden mx-auto mb-[18px] h-1 w-[38px] rounded-full bg-slate-200" />

        <p className="m-0 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">관계 지도</p>
        <h2 className="m-0 mt-1 text-[21px] font-bold leading-tight tracking-[-0.04em] text-slate-900">
          지도에 추가하기
        </h2>
        <p className="m-0 mt-[5px] text-[13.5px] text-slate-500">이름과 생년월일만 있으면 돼요.</p>

        <div className="mt-[22px] flex flex-col gap-4">
          <label className="block">
            <span className="mb-[7px] block text-[12.5px] font-bold text-slate-500">이름</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="예: 백상현"
              maxLength={20}
              className="w-full rounded-[13px] border-[1.5px] border-slate-200 px-[15px] py-[13px] text-[15.5px] text-slate-900 outline-none transition-colors focus:border-blue-600 placeholder:text-slate-300"
            />
          </label>

          <div>
            <div className="mb-[7px] flex items-center justify-between gap-2.5">
              <span className="text-[12.5px] font-bold text-slate-500">생년월일</span>
              <div className="flex gap-[3px] rounded-[9px] bg-slate-100 p-[3px]">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, calendar: "solar", isLeapMonth: false })
                  }
                  className={segClass(draft.calendar === "solar")}
                >
                  양력
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, calendar: "lunar" })}
                  className={segClass(draft.calendar === "lunar")}
                >
                  음력
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2">
              <label className={boxClass("y")}>
                <input
                  value={draft.y}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 4);
                    setDraft({ ...draft, y: v });
                    // 연도 네 자리를 다 치면 월로 손을 옮겨 준다 — 시안의 입력 흐름.
                    if (v.length === 4) mRef.current?.focus();
                  }}
                  onFocus={() => setFocusField("y")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="1993"
                  aria-label="생년"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">년</span>
              </label>
              <label className={boxClass("m")}>
                <input
                  ref={mRef}
                  value={draft.m}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 2);
                    setDraft({ ...draft, m: v });
                    if (v.length === 2) dRef.current?.focus();
                  }}
                  onFocus={() => setFocusField("m")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="04"
                  aria-label="생월"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">월</span>
              </label>
              <label className={boxClass("d")}>
                <input
                  ref={dRef}
                  value={draft.d}
                  onChange={(e) => setDraft({ ...draft, d: digitsOnly(e.target.value, 2) })}
                  onFocus={() => setFocusField("d")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="12"
                  aria-label="생일"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">일</span>
              </label>
            </div>

            <p className={`m-0 mt-[7px] text-[12px] ${birthInvalid ? "text-rose-500" : "text-slate-300"}`}>
              {birthInvalid ? "날짜를 다시 확인해 주세요" : "시간은 몰라도 괜찮아요."}
            </p>
          </div>

          {leapAvailable && (
            <label className="flex items-center justify-between rounded-[13px] border-[1.5px] border-slate-200 px-[15px] py-3">
              <span className="text-[13px] text-slate-500">윤달</span>
              <Toggle
                checked={draft.isLeapMonth}
                onChange={(v) => setDraft({ ...draft, isLeapMonth: v })}
                label="윤달"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="m-0 rounded-[13px] bg-rose-50 px-[15px] py-2.5 text-[13px] text-rose-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!body || sending}
            className={`mt-0.5 rounded-[13px] border-0 py-3.5 text-[15px] font-bold text-white transition-colors ${
              body && !sending ? "bg-blue-600 hover:bg-blue-700 cursor-pointer" : "bg-slate-300"
            }`}
          >
            {sending ? "올리는 중" : body ? `${name} 님을 지도에 올리기` : "지도에 올리기"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full border-0 bg-transparent pt-3.5 text-[14px] font-semibold text-slate-400 cursor-pointer hover:text-slate-500"
        >
          다음에 할게요
        </button>
      </div>
    </div>
  );
}
