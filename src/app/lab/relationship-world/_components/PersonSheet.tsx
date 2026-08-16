"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { FEATURE_LABELS, ROLE_LABELS, type RelationRole } from "../_data/roles";
import type { MockPerson } from "../_data/mock-people";

// 六合 과 沖 의 설명은 길이와 무게를 맞춘다. 한쪽만 따뜻하게 쓰면
// 그 순간 좋은 관계 / 나쁜 관계가 된다.
const FEATURE_NOTE: Record<"yukhap" | "chung", string> = {
  yukhap: "둘 사이의 흐름이 끊기지 않고 이어집니다.",
  chung: "둘 사이의 흐름이 팽팽하게 맞물립니다.",
};

const ROLE_NOTE: Record<RelationRole, string> = {
  fill: "곁에 있으면 비어 있던 자리가 채워지는 사람입니다.",
  beside: "같은 방향을 보고 나란히 걷는 사람입니다.",
  express: "이 사람 앞에서는 말이 쉽게 나옵니다.",
  move: "가만히 있던 마음을 움직이게 하는 사람입니다.",
  refine: "거친 부분을 깎아 모양을 잡아주는 사람입니다.",
};

export function PersonSheet({
  person,
  onClose,
}: {
  person: MockPerson | null;
  onClose: () => void;
}) {
  const open = person !== null;

  // 닫히는 300ms 동안 내용까지 같이 사라지면, 빈 흰 카드가 우주 위로 미끄러져
  // 내려간다 — 지금 판단 대상인 인터랙션 한복판에서. 마지막 사람을 붙들어
  // 두고 전환이 끝난 뒤(화면 밖)에도 그대로 둔다. 다시 열 때는 person 이
  // 먼저 오므로 항상 새 사람이 보인다.
  // React 공식 "props 로 state 조정" 패턴이다. effect 도 ref 도 아니라
  // 렌더 중에 바로 맞춘 뒤 같은 렌더에서 쓴다 — 빈 카드가 한 프레임도 안 보인다.
  const [lastShown, setLastShown] = useState<MockPerson | null>(null);
  if (person !== null && person !== lastShown) setLastShown(person);
  const shown = person ?? lastShown;

  return (
    <div
      aria-hidden={!open}
      className={`
        fixed z-20 bg-white text-slate-900 shadow-elevated
        transition-transform duration-300 ease-out
        inset-x-0 bottom-0 h-[40vh] rounded-t-2xl
        md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[380px] md:rounded-t-none md:rounded-l-2xl
        ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}
      `}
    >
      {shown && (
        <div className="h-full flex flex-col px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          {/* 모바일 손잡이 */}
          <div className="md:hidden mx-auto w-9 h-1 rounded-full bg-slate-200 mb-4" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.02em] m-0">{shown.name}</h2>
              <p className="text-[15px] text-slate-500 mt-1 m-0">{shown.sceneName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Badge>{ROLE_LABELS[shown.role]}</Badge>
            {/* feature 가 없으면 아무 배지도 붙지 않는다 */}
            {shown.feature !== "none" && <Badge>{FEATURE_LABELS[shown.feature]}</Badge>}
          </div>

          <p className="text-[15px] leading-relaxed text-slate-700 mt-4 m-0">
            {ROLE_NOTE[shown.role]}
          </p>

          {shown.feature !== "none" && (
            <p className="text-[15px] leading-relaxed text-slate-700 mt-2 m-0">
              {FEATURE_NOTE[shown.feature]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
