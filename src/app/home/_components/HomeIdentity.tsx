"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CharacterCard } from "@/components/character-card/CharacterCard";
import { CARD_TONES } from "@/components/character-card/tokens";
import { MOBILE_MAX, useViewportWidth } from "@/components/useViewportWidth";
import { HANDOFF_KEY } from "@/lib/characters/handoff";
import type { HomeEntry } from "../_lib/to-home-entry";
import { DeleteProfileDialog } from "./DeleteProfileDialog";
import { ExploreGrid } from "./ExploreGrid";

interface Props {
  entries: HomeEntry[];
  /** 프로필을 더 만들 수 있는지 — 한도에 닿으면 추가 버튼을 잠근다 */
  canAdd: boolean;
  /**
   * 지난번에 고른 프로필(users.primary_profile_id). 비로그인이거나 아직 아무것도
   * 고르지 않았으면 null — 그때는 첫 줄로 물러선다.
   */
  primaryProfileId: string | null;
}

/** 셀렉터에서 삭제를 누른 줄. 다이얼로그가 열려 있는 동안만 값이 있다 */
interface DeleteTarget {
  index: number;
  profileId: string;
  name: string;
}

const ADD_HREF = "/funnel?step=name";

/**
 * 아직 계정이 없는 사람의 리포트. 로그인을 먼저 시키지 않는다 — 무료 섹션은 드래프트의
 * 실데이터로 그대로 보여주고, 잠긴 섹션의 CTA 가 로그인(=드래프트 승격) → 결제로 이어진다.
 */
const DRAFT_REPORT_HREF = "/report";

/** 아직 계정이 없는 사람의 상담 입구. /consult 가 로그인 → 퍼널 순으로 넘긴다 */
const DRAFT_CONSULT_HREF = "/consult";

/** 휴지통. 글자를 넣기엔 셀렉터 줄이 좁아서 그림 하나로 세운다 */
function TrashGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <path d="M2.5 4h11M6.2 4V2.6h3.6V4M4 4l.6 9.1h6.8L12 4" />
      <path d="M6.6 6.6v4M9.4 6.6v4" />
    </svg>
  );
}

/**
 * 프로필 셀렉터 + 캐릭터 카드 + 탐색 그리드.
 *
 * 셋을 한 컴포넌트에 두는 이유는 "보고 있는 사주" 하나가 세 곳을 동시에 바꾸기
 * 때문이다 — 셀렉터를 넘기면 카드도 리포트 링크도 같이 따라가야 한다.
 */
export function HomeIdentity({ entries, canAdd, primaryProfileId }: Props) {
  const vw = useViewportWidth();
  const mobile = vw < MOBILE_MAX;
  // 서버가 준 것은 index 가 아니라 id 다 — index 는 목록이 한 줄이라도 바뀌는 순간
  // 다른 사람을 가리키는 숫자가 되고, 서버와 클라가 같은 목록을 본다는 가정이
  // 어디에도 적히지 않는다. 못 찾으면(지워졌거나 드래프트뿐이면) 첫 줄이다.
  const [index, setIndex] = useState(() => {
    if (primaryProfileId === null) return 0;
    const i = entries.findIndex((e) => e.profileId === primaryProfileId);
    return i === -1 ? 0 : i;
  });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 리빌에서 넘어온 첫 진입에만 카드가 이어받는 연출을 켠다. 신호는 한 번 쓰고 지운다.
  // state 가 아니라 클래스를 직접 붙이는 이유: 서버에는 sessionStorage 가 없어 첫
  // 렌더에는 무엇도 알 수 없고, state 로 두면 그 사실 하나 때문에 전체가 한 번 더 그려진다.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HANDOFF_KEY) === null) return;
      sessionStorage.removeItem(HANDOFF_KEY);
      cardRef.current?.classList.add("pv-handoff");
    } catch {
      // 스토리지를 못 읽으면 연출만 빠진다
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * 고른 줄을 계정의 "나" 로 올린다 — 다음에 홈에 들어오면 이 줄이 잡혀 있고,
   * 지도·상담 주체·궁합의 "나" 도 같은 사람을 본다.
   *
   * 결과를 보지 않는다. 화면은 이미 넘어갔고 실패해도 잃는 것은 "다음 방문의
   * 기본값" 하나뿐인데, 성공했을 때 아무 표시도 없는 동작에 실패할 때만 빨간 줄을
   * 띄우면 사용자는 자기가 무엇을 잘못했는지 찾게 된다.
   *
   * 아직 계정에 저장되지 않은 드래프트는 올릴 행이 없다 — 그냥 돌아간다.
   */
  function promote(profileId: string | null) {
    if (profileId === null) return;
    void fetch(`/api/profiles/${profileId}/primary`, { method: "POST" }).catch(() => {});
  }

  const active = entries[Math.min(index, entries.length - 1)];

  const tone = active.character
    ? CARD_TONES[active.character.family.element]
    : null;

  // 아직 계정에 저장되지 않은 드래프트는 지울 API 대상이 없다 — 로그인하면 프로필로
  // 승격되고 그때부터 그 줄에 삭제가 붙는다. 지울 게 있으면 프로필이 한 줄뿐이어도
  // 셀렉터를 잠그지 않는다. 잠그면 마지막 한 장을 지울 길이 사라진다.
  const deletable = entries.some((entry) => entry.profileId !== null);
  const expandable = entries.length > 1 || deletable;

  return (
    <>
      <section className="bg-[linear-gradient(180deg,#F7F9FB_0%,#FBFCFD_62%,#fff_100%)] py-[18px] md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[780px] flex-col items-stretch px-5 md:items-center md:px-8">
          <div ref={wrapRef} className="relative z-20 mb-3.5 w-full">
            <div className="flex items-center gap-2">
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((v) => !v)}
                disabled={!expandable}
                className={`flex h-[52px] min-w-0 flex-1 items-center gap-[11px] rounded-[14px] border bg-white px-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)] ${
                  open ? "border-accent" : "border-slate-200"
                } ${expandable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13.5px] font-bold"
                  style={
                    tone
                      ? { background: tone.surface, color: tone.accent }
                      : { background: "#F1F5F9", color: "#94A3B8" }
                  }
                >
                  {active.initial}
                </span>
                <span className="flex min-w-0 flex-col items-start gap-px">
                  <span className="text-[15.5px] font-bold leading-[1.2] tracking-[-0.025em]">
                    {active.name}
                  </span>
                  <span className="max-w-[190px] truncate text-[12.5px] leading-[1.2] text-slate-400">
                    {active.character?.scene.name ?? "캐릭터를 세울 수 없어요"}
                  </span>
                </span>
                {expandable && (
                  <span
                    aria-hidden
                    className={`ml-auto flex-none text-[11px] text-slate-400 ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                )}
              </button>

              {canAdd ? (
                <Link
                  href={ADD_HREF}
                  className="flex h-[52px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-[15px] text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent"
                >
                  <span className="text-[17px] font-normal leading-none">
                    +
                  </span>
                  {mobile ? "프로필" : "프로필 추가"}
                </Link>
              ) : (
                <span
                  aria-disabled
                  title="프로필이 가득 찼어요"
                  className="flex h-[52px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[14px] border border-slate-200 bg-white px-[15px] text-sm font-semibold text-slate-300"
                >
                  <span className="text-[17px] font-normal leading-none">
                    +
                  </span>
                  {mobile ? "프로필" : "프로필 추가"}
                </span>
              )}
            </div>

            {open && (
              <div
                id={panelId}
                role="listbox"
                aria-label="사주 고르기"
                className="absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_44px_-20px_rgba(15,23,42,.32)]"
              >
                {entries.map((entry, i) => {
                  const rowBg = i === index ? "bg-slate-50" : "bg-white";
                  return (
                    // 고르기와 지우기가 한 줄에 선다. 버튼 안에 버튼을 넣을 수 없어 줄을
                    // 감싸고, 감싼 상자는 listbox 가 option 만 소유하도록 none 으로 비운다.
                    <div key={entry.key} role="none" className="flex items-stretch">
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === index}
                        onClick={() => {
                          // 보고 있던 줄을 다시 누른 것이면 바뀐 것이 없다 — 쏘지 않는다.
                          if (i !== index) {
                            setIndex(i);
                            promote(entry.profileId);
                          }
                          setOpen(false);
                        }}
                        className={`flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-3 pl-3.5 pr-1 text-left ${rowBg}`}
                      >
                        <span
                          aria-hidden
                          className={`w-4 flex-none pt-[3px] text-xs font-bold ${
                            i === index ? "text-accent" : "text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold tracking-[-0.02em]">
                            {entry.name}
                          </span>
                          <span className="mt-px block truncate text-[13px] text-slate-400">
                            {entry.character?.scene.name ??
                              "캐릭터를 세울 수 없어요"}
                          </span>
                        </span>
                      </button>
                      {entry.profileId !== null && (
                        <button
                          type="button"
                          aria-label={`${entry.name} 프로필 삭제`}
                          onClick={() =>
                            setTarget({
                              index: i,
                              profileId: entry.profileId as string,
                              name: entry.name,
                            })
                          }
                          className={`flex w-11 flex-none cursor-pointer items-center justify-center text-slate-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${rowBg}`}
                        >
                          <TrashGlyph />
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-slate-100 p-1.5">
                  <Link
                    href={ADD_HREF}
                    className="flex items-center gap-2.5 rounded-[11px] px-3 py-3 text-[14.5px] font-semibold text-accent hover:bg-slate-50"
                  >
                    <span className="text-[17px] font-normal leading-none">
                      +
                    </span>
                    새 프로필 추가
                  </Link>
                </div>
              </div>
            )}
          </div>

          {active.character ? (
            <div ref={cardRef} className="w-full">
              <CharacterCard character={active.character} w="fill" />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
              <p className="text-[15px] font-semibold">
                이 프로필로는 캐릭터를 세울 수 없어요
              </p>
              <p className="mt-1.5 text-[13px] text-slate-400 [text-wrap:pretty]">
                저장된 생년월일이 계산 가능한 범위(1900~2050년)를 벗어났어요.
              </p>
            </div>
          )}
        </div>
      </section>

      {target && (
        <DeleteProfileDialog
          profileId={target.profileId}
          name={target.name}
          onClose={() => {
            setTarget(null);
            triggerRef.current?.focus();
          }}
          onDeleted={() => {
            // 지운 줄이 보고 있던 줄보다 위였으면 목록이 한 칸씩 당겨진다 — 같이 당긴다.
            // 보고 있던 줄 자신을 지웠으면 그 자리로 올라오는 다음 줄을 그대로 본다.
            const removed = target.index;

            // ⚠️ 착지한 줄을 entries 에서 그대로 읽으면 안 된다. 다이얼로그는
            // router.refresh() 를 부른 직후 이 콜백을 부르는데 새 목록은 아직 오지
            // 않았다 — 지금 entries 에는 방금 지운 줄이 그대로 있다.
            const rest = entries.filter((_, i) => i !== removed);
            const landing = Math.min(removed < index ? index - 1 : index, rest.length - 1);
            // 지운 것이 "나" 였으면 FK 가 null 로 만든다(0029 의 ON DELETE SET NULL).
            // 화면은 다음 줄에 착지해 있는데 DB 는 null 이라 어긋난다 — 다시 맞춘다.
            // 아무것도 안 남았으면 rest[-1] 이 undefined 라 promote 가 그냥 돌아간다.
            promote(rest[landing]?.profileId ?? null);

            setIndex((cur) => (removed < cur ? cur - 1 : cur));
            setTarget(null);
            setOpen(false);
          }}
        />
      )}

      <ExploreGrid
        reportHref={
          active.profileId
            ? `/report?profile=${active.profileId}`
            : DRAFT_REPORT_HREF
        }
        consultHref={
          active.profileId
            ? `/consult?profile=${active.profileId}`
            : DRAFT_CONSULT_HREF
        }
      />
    </>
  );
}
