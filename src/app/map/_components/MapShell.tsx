"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Element } from "@/lib/saju-core";
import type { MapPerson } from "../_data/person";
import { sheetOffset, settleSheet } from "../_lib/sheet-drag";
import { PeopleList } from "./PeopleList";
import { AddPersonModal } from "./AddPersonModal";
import { MapHeader } from "./MapHeader";

/**
 * 지금 이 패널이 "시트" 인지. Tailwind 의 md(768px) 와 같은 경계다 — 그보다
 * 넓으면 패널은 지도를 덮지 않는 우측 400px 고정 컬럼이고, 끌기도 빈 곳 탭에
 * 따른 접기도 뜻이 없다.
 *
 * CSS 로 판단할 수 없어서 JS 로 묻는다. 끌기는 픽셀을 재서 transform 을 만드는
 * 일이라 미디어 쿼리로 끌 수 있는 성질의 것이 아니다. 클라이언트 이벤트
 * 핸들러 안에서만 불리므로 window 가 없을 걱정은 없다.
 */
function isSheetLayout(): boolean {
  return !window.matchMedia("(min-width: 768px)").matches;
}

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function MapShell({
  people,
  centerElement,
  isOwner,
  shareId,
  loggedIn,
}: {
  people: readonly MapPerson[];
  /** 중심(나)의 일간 오행. PeopleList 의 궁합 단락이 쓴다. */
  centerElement: Element;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  /**
   * 모바일 시트가 지금 몇 px 를 덮고 있는지. 지도 내용을 그 절반만큼 위로 밀어,
   * 가려지지 않는 띠의 한가운데에 원반이 오게 하는 데 쓴다.
   *
   * 크기가 아니라 위치만 건드리는 것이 요점이다. 캔버스는 늘 본문 전체 높이라
   * 목록을 여닫아도 리사이즈되지 않고(=지도가 다시 맞춰지지 않고) 원반 크기도
   * 그대로다 — 보이는 창만 위아래로 움직인다.
   *
   * 시트 높이는 내용에 따라 달라져서(사람이 둘이면 짧다) 상수로 둘 수 없다.
   * ResizeObserver 로 관찰하는 편이 자연스러워 보이지만 쓰지 않는다 — 시트
   * 높이가 바뀌는 계기는 목록을 여닫는 것과 인원이 바뀌는 것, 그리고 창 크기가
   * 바뀌는 것뿐이라 그 셋을 직접 잡는 편이 더 단순하고, 무엇보다 그렇게 해야
   * 브라우저 밖에서도 언제 다시 재는지가 코드에 드러난다.
   *
   * useLayoutEffect 인 것은 DOM 이 바뀐 뒤 페인트 전에 재기 위해서다 — useEffect
   * 로 재면 한 프레임 동안 옛 위치가 그려졌다가 튄다.
   */
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setSheetHeight(sheetRef.current?.getBoundingClientRect().height ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [listOpen, people.length]);

  /**
   * 시트를 손가락으로 여닫는다.
   *
   * 없애려는 증상: 손잡이를 잡고 아래로 끌면 시트가 내려가는 대신 페이지가
   * 새로고침됐다. 원인은 시트가 시트처럼 **보이기만** 했다는 것이다 — 손잡이는
   * 장식 <span> 이었고 이 라우트 어디에도 포인터 핸들러가 없었다. 앱이 손짓을
   * 가져가지 않으니 그대로 브라우저에게 갔고, 크롬 안드로이드가 그것을
   * 당겨서-새로고침으로 받았다. 그래서 손짓을 뺏는 일(PeopleList 의 touch-none)과
   * 뺏은 손짓으로 시트를 움직이는 일(여기)을 같이 한다.
   *
   * 규칙 자체는 _lib/sheet-drag.ts 에 순수 함수로 있다 — 거리·속도 판정은
   * 브라우저 없이 재는 편이 낫고, 여기 남는 것은 이벤트를 듣고 그 답을 상태에
   * 옮기는 일뿐이다.
   *
   * setPointerCapture 를 쓰지 않는다. 캡처를 걸면 click 의 표적 계산이 브라우저마다
   * 달라져 손잡이 줄 안의 진짜 버튼("나도 추가" · 펼치기 토글)이 안 눌리는 길이
   * 생긴다. 대신 끄는 동안만 window 에 리스너를 단다 — 손가락이 시트 밖으로
   * 나가도 끝까지 따라온다.
   */
  const [dragY, setDragY] = useState(0);
  // 되돌아갈 때만 애니메이션을 켠다. 접히면서 끝나는 경우에는 꺼야 한다 —
  // 그 순간 시트 높이가 줄고 transform 이 0 으로 돌아가는데, 둘이 같은 프레임에
  // 일어나야 제자리다. 애니메이션이 켜져 있으면 시트가 한 번 아래로 튀었다가
  // 올라온다.
  const [eased, setEased] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; time: number; open: boolean; max: number } | null>(null);

  function startSheetDrag(event: React.PointerEvent<HTMLDivElement>) {
    // 데스크톱에서 이 패널은 시트가 아니라 우측 400px 고정 컬럼이다 — 끌 것이 없다.
    if (!isSheetLayout()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const sheet = sheetRef.current;
    if (sheet === null) return;
    // 손잡이 줄에서 시작한 손짓만 끌기다. 목록 행에서 시작한 것은 스크롤이다.
    const grab =
      event.target instanceof Element ? event.target.closest("[data-sheet-grab]") : null;
    if (grab === null) return;

    dragStart.current = {
      y: event.clientY,
      time: event.timeStamp,
      open: listOpen,
      // 접혔을 때의 자리. 여기까지만 내려가므로 끄는 내내 손잡이가 화면에 남는다.
      max: sheet.getBoundingClientRect().height - grab.getBoundingClientRect().height,
    };
    setEased(false);
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;

    function move(event: PointerEvent) {
      const start = dragStart.current;
      if (start === null) return;
      setDragY(sheetOffset(event.clientY - start.y, start.max));
    }

    function end(event: PointerEvent) {
      const start = dragStart.current;
      dragStart.current = null;
      setDragging(false);
      setDragY(0);
      if (start === null) return;

      const settled = settleSheet({
        open: start.open,
        dy: event.clientY - start.y,
        dt: event.timeStamp - start.time,
      });
      // "stay" 는 끌기 전 상태로 되돌아간다는 뜻이다 — 그때만 미끄러지듯 돌아간다.
      if (settled === "stay") setEased(true);
      else setListOpen(settled === "open");
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  // 토스트는 여기가 갖는다. 공유(MapHeader)와 삭제 실패(handleDelete) 둘 다
  // 같은 자리에 떠야 하는데, 헤더 안에 두면 삭제 쪽에서 닿을 수 없다.
  const [toast, setToast] = useState<string | null>(null);
  // 두 번째 메시지가 1800ms 안에 들어오면 새 토스트가 이전 타이머에 맞아 일찍
  // 지워진다. 타이머를 쥐고 있다가 새로 걸기 전에 먼저 지운다.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, []);

  // 3D 노드를 탭하면 목록의 그 행이 답이다 — 패널이 접혀 있으면 펼친다.
  // (목록 행을 탭한 경우에도 같은 경로로 오지만, 이미 열려 있으니 no-op 다.)
  //
  // id 가 null 로 오는 길은 하나뿐이다: 3D 의 빈 곳을 탭했을 때(World 의
  // onPointerMissed). 모바일에서는 그때 시트도 내린다 — 사용자가 방금 탭한 그
  // 빈 곳은 시트에 가려져 있던 지도이고, 선택만 풀고 시트를 세워 두면 정작
  // 보려던 것을 계속 못 본다. 데스크톱에서는 내리지 않는다: 그쪽 패널은 지도를
  // 덮지 않는 우측 컬럼이라 접을 이유가 없고, 배경을 눌렀다고 목록이 사라지면
  // 놀랄 뿐이다.
  //
  // 돌다 손을 뗀 것과 헷갈릴 걱정은 없다. r3f 는 이동 거리 2px 이하인 클릭에만
  // onPointerMissed 를 부르므로(events.js 의 delta <= 2), 지도를 회전시킨 손짓은
  // 여기 오지 않는다.
  function selectPerson(id: string | null) {
    setSelectedId(id);
    if (id !== null) setListOpen(true);
    else if (isSheetLayout()) setListOpen(false);
  }

  /**
   * 실패를 조용히 삼키지 않는다. 지우기는 남이 채워 넣은 쓰레기에 대한 소유자의
   * 유일한 대응 수단이라, 403 도 500 도 오프라인도 "아무 일 없음" 으로 보이면
   * 사용자는 같은 버튼을 계속 누르면서 지도가 왜 그대로인지 알 수 없다.
   */
  async function handleDelete(id: string) {
    let res: Response;
    try {
      res = await fetch(`/api/maps/${shareId}/people/${id}`, { method: "DELETE" });
    } catch {
      // fetch 가 던지는 것은 네트워크가 끊긴 경우다 — 상태 코드가 아예 없다.
      showToast("연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요");
      return;
    }

    if (res.status === 404) {
      // 이미 없는 사람이다. 실패로 알리되 목록은 새로고침한다 — 화면에만 남아 있던
      // 유령이 사라지는 것이 사용자가 원한 결과다.
      showToast("이미 지워진 사람이에요");
    } else if (res.status === 403) {
      showToast("지도 주인만 지울 수 있어요");
      return;
    } else if (!res.ok) {
      showToast("지우지 못했어요. 잠시 뒤 다시 시도해 주세요");
      return;
    }

    // 서버 컴포넌트가 목록의 진실이다. 로컬 상태로 낙관적 갱신을 하면 두 벌이 된다.
    if (selectedId === id) setSelectedId(null);
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      {/* 추가 모달이 떠 있는 동안 뒤 콘텐츠 전체(헤더 포함)를 포커스·클릭에서
          뺀다 — 오버레이가 시각적으로 덮어도 Tab 은 뚫고 들어간다. 헤더까지
          한 wrapper 로 묶는 것은, 헤더만 따로 inert 를 걸면 그 사이 Tab
          순서에 wrapper 경계가 하나 더 생겨 레이아웃과 무관하게 코드만
          복잡해지기 때문이다 — 이 wrapper 는 기존 바깥 div 와 같은
          flex-col/flex-1 이라 자식들의 배치는 그대로다. */}
      <div inert={adding} className="flex min-h-0 flex-1 flex-col">
        <MapHeader shareId={shareId} loggedIn={loggedIn} onToast={showToast} />

        {/* relative 는 모바일에서 목록 패널이 지도 위를 덮는 기준이다(아래 참고). */}
        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative min-h-0 flex-1">
            {/*
              isolate 가 필수다. drei <Html> 은 카메라 거리로 z-index 를 계산해
              zIndexRange 안의 값을 마커마다 찍는데, R3F 가 만드는 Html 컨테이너는
              position:relative + z-index auto 라 쌓임 맥락을 만들지 않는다. 여기서
              맥락을 끊으면 마커의 z 는 이 div 안에서만 유효해지고, div 자체는
              z-auto 라 패널·모달이 항상 위다.
            */}
            <div
              className="absolute inset-0 isolate translate-y-[calc(var(--sheet-shift)*-1)] transition-transform duration-300 md:translate-y-0"
              style={{ ["--sheet-shift" as string]: `${sheetHeight / 2}px` }}
            >
              <World people={people} selectedId={selectedId} onSelect={selectPerson} />
            </div>

          </div>

          {/*
            사이드 패널. 데스크톱은 우측 400px 고정 컬럼, 모바일은 지도 위를
            덮는 하단 시트다.

            **모바일에서 지도와 세로를 나눠 갖지 않는다.** 예전에는 이 패널이
            플렉스 형제라, 목록을 펼치면 그만큼 지도가 깎였다 — 375×812 폰에서
            지도가 702px 에서 421px 로 줄었고, 그 421px 안에서 원반은 폭에
             맞춰진 최대 크기 그대로라 배지가 위아래 가장자리에 꽉 끼었다.
            게다가 목록을 여닫을 때마다 캔버스가 리사이즈되어 지도가 다시
            맞춰졌다.

            지금은 absolute 로 띄워 지도 위를 덮는다. 지도 영역은 목록의 상태와
            무관하게 늘 본문 전체 높이이고, 목록을 여닫아도 지도는 리사이즈되지
            않는다 — 덮이기만 한다. 접으면 넉넉한 지도가 그대로 돌아온다.

            대가는 펼친 동안 원반의 아래쪽이 시트 뒤에 가려지는 것이다. 지도와
            목록이 같은 픽셀을 두고 다투는 것 자체는 없앨 수 없어서(둘 다에게
            충분한 높이를 주기에 폰 화면이 모자란다), 남은 선택은 "지도를
            줄인다" 와 "지도를 덮는다" 둘뿐이고 여기서는 덮는 쪽을 골랐다.

            max-h-full 은 시트가 본문보다 커지지 않게 막는다 — 목록이 아무리
            길어도 헤더를 밀어 올리거나 화면 밖으로 넘치지 않는다.
            md: 접두사가 붙은 것들이 데스크톱에서 이 전부를 되돌려, 예전처럼
            흐름 안의 우측 400px 컬럼이 된다.
          */}
          <div
            ref={sheetRef}
            onPointerDown={startSheetDrag}
            /* 끌기는 모바일에서만 시작하므로(startSheetDrag) 데스크톱에서 dragY 는
               늘 0 이고, 이 style 은 그때 transform 을 아예 만들지 않는다. */
            style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
            className={`absolute inset-x-0 bottom-0 z-20 flex max-h-full flex-col rounded-t-2xl bg-white shadow-[0_-8px_28px_-14px_rgba(15,23,42,0.25)] md:static md:z-auto md:max-h-none md:w-[400px] md:shrink-0 md:rounded-none md:border-l md:border-slate-100 md:shadow-none ${
              eased ? "transition-transform duration-200" : ""
            }`}
          >
            <PeopleList
              people={people}
              centerElement={centerElement}
              open={listOpen}
              onToggle={() => setListOpen((v) => !v)}
              selectedId={selectedId}
              onSelect={selectPerson}
              isOwner={isOwner}
              onDelete={handleDelete}
              onAdd={() => setAdding(true)}
            />
          </div>
        </div>
      </div>

      {/* open prop 이 아니라 마운트 자체로 연다 — AddPersonModal 은 내부에
          draft/error state 를 갖는데, 이걸 항상 마운트해 두고 open 으로만
          가리면 닫았다 다시 열어도 그 state 가 안 지워진다(모달 자신의
          docstring이 "닫으면 언마운트라 지워진다"고 약속한 바로 그 동작). */}
      {adding && (
        <AddPersonModal
          shareId={shareId}
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            // 서버가 목록의 진실이다. refresh 로 새 사람을 받아오고, 도착하면
            // selectedId 가 그를 가리켜 카메라가 날아가고 행이 하이라이트된다.
            setSelectedId(id);
            router.refresh();
          }}
        />
      )}

      {/* z-40 — 패널(z-10)보다 위다. 목록에서 지운 결과를 목록이 가리면 안 된다. */}
      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-[72px] z-40 -translate-x-1/2 rounded-full bg-slate-800/95 px-4 py-2 text-[13px] text-slate-100"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
