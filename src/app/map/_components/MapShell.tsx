"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CameraModeToggle } from "./CameraModeToggle";
import type { MapCenter, MapPerson } from "../_data/person";
import { PersonSheet } from "./PersonSheet";
import { PeopleList } from "./PeopleList";
import { AddPersonSheet } from "./AddPersonSheet";
import { MapHeader } from "./MapHeader";
import type { CameraMode } from "../_lib/camera";

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
  center,
  isOwner,
  shareId,
  loggedIn,
}: {
  people: readonly MapPerson[];
  center: MapCenter;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("b");
  const [resetSignal, setResetSignal] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

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

  const selected = people.find((p) => p.id === selectedId) ?? null;

  // 판이 하나라도 열려 있으면 헤더를 강제로 보인다 — 나가는 길을 없애지 않는다.
  const anyPanelOpen = selectedId !== null || listOpen || adding;
  const hideHeader = headerHidden && !anyPanelOpen;

  // 목록·상세·추가 세 판은 서로 배타적이다 — 화면 아래에서 올라오는 판이 둘
  // 이상 함께 뜨면 어느 쪽을 닫는 탭인지 알 수 없다. 어디서 선택이 일어나든
  // (3D 월드를 직접 탭하든, 목록에서 고르든) 이 한 곳을 거쳐 나머지 둘을 접는다.
  function selectPerson(id: string | null) {
    setSelectedId(id);
    setListOpen(false);
    setAdding(false);
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
    <div className="relative w-full h-full">
      {/*
        isolate 가 필수다. drei <Html> 은 카메라 거리로 z-index 를 계산해
        zIndexRange 안의 값을 마커마다 찍는데, R3F 가 만드는 Html 컨테이너는
        position:relative + z-index auto 라 쌓임 맥락을 만들지 않는다. 그대로 두면
        명패의 z-30 이 시트(z-20)·토글(z-10)과 같은 맥락에서 겨뤄, 사람을 탭한
        순간 흰 시트 위로 어두운 명패가 올라앉고 pointerEvents:"auto" 때문에
        닫기 버튼을 향한 탭까지 가로챈다. 여기서 맥락을 끊으면 마커의 z 는
        이 div 안에서만 유효해지고, div 자체는 z-auto 라 시트와 토글이 항상 위다.
      */}
      <div
        className="absolute inset-0 isolate"
        // 지도에 손이 닿는 순간 헤더를 치운다. 카메라를 돌리는 동안 화면이 가장 넓어야 한다.
        onPointerDown={() => setHeaderHidden(true)}
      >
        <World
          people={people}
          center={center}
          selectedId={selectedId}
          onSelect={(id) => {
            selectPerson(id);
            // 빈 곳을 탭하면(id === null) 선택이 풀리면서 헤더가 돌아온다.
            if (id === null) setHeaderHidden(false);
          }}
          mode={mode}
          resetSignal={resetSignal}
        />
      </div>

      <MapHeader
        hidden={hideHeader}
        onReveal={() => setHeaderHidden(false)}
        isOwner={isOwner}
        shareId={shareId}
        loggedIn={loggedIn}
        onToast={showToast}
      />

      {/*
        카메라 시점 전환 토글. 스파이크 시절부터 쓰던 A/B/C 세 모드를 제품
        화면에서도 그대로 쓴다. 헤더 높이는 이제 56px + safe-area-inset-top
        이다(헤더가 인셋을 padding 이 아니라 오프셋으로 먹는다) — 그래서
        12px 간격을 max(12px, inset) 이 아니라 항상 더한다. max 를 쓰면
        인셋이 12px 를 넘는 노치 기기에서 간격이 0으로 접힌다.
      */}
      <div className="absolute top-[calc(56px+env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-10">
        <CameraModeToggle
          mode={mode}
          onChange={setMode}
          onReset={() => {
            // 선택을 함께 푼다. 안 그러면 기본 뷰로 스냅한 직후 focus 보간이
            // 다시 그 사람에게 끌고 가서 "처음 위치로" 가 먹통으로 보인다.
            setSelectedId(null);
            setResetSignal((n) => n + 1);
          }}
        />
      </div>

      {/*
        목록·상세·추가 세 판은 다 화면 아래에서 올라오는 판이라 동시에 열면 어느
        쪽을 닫는 건지 알 수 없다. 목록을 펴면 선택과 추가 폼을 접고, 목록에서
        사람을 고르면 목록이 접히면서 시트가 열린다 — 언제나 하나만 떠 있다.
      */}
      <PeopleList
        people={people}
        open={listOpen}
        onToggle={() => {
          setListOpen((v) => {
            if (!v) {
              setSelectedId(null);
              setAdding(false);
            }
            return !v;
          });
        }}
        selectedId={selectedId}
        onSelect={selectPerson}
        isOwner={isOwner}
        onDelete={handleDelete}
      />

      {/*
        추가 버튼. 소유자가 아니어도 보인다 — 링크를 받은 사람이 자기를 넣는 것이
        이 기능의 전부다. 목록 손잡이 바로 위, 접힌 목록에 가리지 않는 자리다.

        판이 열리면 inert 다. 이 버튼은 z-10 이라 판(z-20·z-30) 아래로 완전히
        덮이는데, inert 가 없으면 눈에 보이지 않는 채로 tab 순서에는 남는다 —
        추가 시트를 열어둔 키보드/스위치 사용자가 시트 안에서 tab 을 돌리다
        보이지 않는 이 버튼을 눌러 이미 있는 시트를 다시 여는 일이 생긴다.
        MapHeader·PersonSheet·AddPersonSheet 가 쓰는 것과 같은 방식이다.
      */}
      <button
        type="button"
        inert={anyPanelOpen}
        onClick={() => {
          setSelectedId(null);
          setListOpen(false);
          setAdding(true);
        }}
        className="fixed right-4 z-10 rounded-full bg-sky-500 px-4 py-3 text-[14px] font-bold text-white shadow-elevated bottom-[calc(max(56px,44px+env(safe-area-inset-bottom))+16px)]"
      >
        + 나도 추가하기
      </button>

      <PersonSheet
        person={selected}
        onClose={() => setSelectedId(null)}
      />

      <AddPersonSheet
        open={adding}
        shareId={shareId}
        onClose={() => setAdding(false)}
        onAdded={(id) => {
          setAdding(false);
          // 서버가 목록의 진실이다. refresh 로 새 사람을 받아오고, 도착하면
          // selectedId 가 그를 가리켜 카메라가 날아가고 상세가 열린다.
          setSelectedId(id);
          router.refresh();
        }}
      />

      {/* z-40 — 판(z-20·z-30)보다 위다. 목록에서 지운 결과를 목록이 가리면 안 된다. */}
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
