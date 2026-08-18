"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { DISPLAY_TITLES, FEATURE_LABELS, FEATURE_NOTE, ROLE_LABELS, type RelationRole } from "../_data/roles";
import { roleColor } from "../_data/role-colors";
import { paletteFor } from "../_data/saju-colors";
import type { MapPerson } from "../_data/person";

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
  person: MapPerson | null;
  onClose: () => void;
}) {
  const open = person !== null;

  // 닫히는 300ms 동안 내용까지 같이 사라지면, 빈 흰 카드가 우주 위로 미끄러져
  // 내려간다 — 지금 판단 대상인 인터랙션 한복판에서. 마지막 사람을 붙들어
  // 두고 전환이 끝난 뒤(화면 밖)에도 그대로 둔다. 다시 열 때는 person 이
  // 먼저 오므로 항상 새 사람이 보인다.
  // React 공식 "props 로 state 조정" 패턴이다. effect 도 ref 도 아니라
  // 렌더 중에 바로 맞춘 뒤 같은 렌더에서 쓴다 — 빈 카드가 한 프레임도 안 보인다.
  const [lastShown, setLastShown] = useState<MapPerson | null>(null);
  if (person !== null && person !== lastShown) setLastShown(person);
  const shown = person ?? lastShown;

  return (
    <div
      aria-hidden={!open}
      // 닫히는 300ms 동안에도 shown 이 마운트된 채 남아 있어(위 주석), 닫기
      // 버튼이 aria-hidden 서브트리 안에서 여전히 focusable 로 남는다 — 닫은
      // 뒤 Tab 을 누르면 화면 밖 시트로 포커스가 들어간다. inert 는 시각적
      // 애니메이션과 무관하게 그 서브트리를 포커스·클릭 대상에서 완전히 뺀다.
      inert={!open}
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
              {/*
                브리프 §4.2: 관계 별명을 가장 먼저 보여준다. "민수는 내 라이벌" 처럼
                캡처해서 공유했을 때 문장이 사는 것이 이 줄의 목적이다.
              */}
              <p className="text-[13px] font-semibold tracking-[0.08em] m-0"
                 style={{ color: roleColor(shown.role) }}>
                {DISPLAY_TITLES[shown.role][shown.feature]}
              </p>
              <h2 className="text-2xl font-bold tracking-[-0.02em] m-0 mt-0.5">{shown.name}</h2>
              <p className="text-[15px] text-slate-500 mt-1 m-0 flex items-center gap-1.5">
                {/*
                  사주색은 노드에서 내려왔지만 사라지지 않았다. 그 사람이 누구인가는
                  한 층 아래로 갈 뿐이다 (브리프 §8).
                */}
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: paletteFor(shown.pillarKey).core }}
                />
                {shown.sceneName}
              </p>
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

          {/* 기본 상태의 FEATURE_NOTE 는 빈 문자열이라 아무것도 렌더링되지 않는다 */}
          {FEATURE_NOTE[shown.feature] && (
            <p className="text-[15px] leading-relaxed text-slate-700 mt-2 m-0">
              {FEATURE_NOTE[shown.feature]}
            </p>
          )}

          {shown.sameDayPillar && (
            // 六合 도 沖 도 아니라 배치로는 말할 수 없는 사실이다. 여기서만 말한다.
            <p className="mt-1 text-[13px] text-slate-500">일주가 통째로 같아요.</p>
          )}
        </div>
      )}
    </div>
  );
}
