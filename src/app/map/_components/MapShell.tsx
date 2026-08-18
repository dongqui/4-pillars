"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CameraModeToggle } from "./CameraModeToggle";
import type { MapCenter, MapPerson } from "../_data/person";
import { PersonSheet } from "./PersonSheet";
import { PeopleList } from "./PeopleList";
import { AddPersonSheet } from "./AddPersonSheet";
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
}: {
  people: readonly MapPerson[];
  center: MapCenter;
  isOwner: boolean;
  shareId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("b");
  const [resetSignal, setResetSignal] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected = people.find((p) => p.id === selectedId) ?? null;

  // 목록·상세·추가 세 판은 서로 배타적이다 — 화면 아래에서 올라오는 판이 둘
  // 이상 함께 뜨면 어느 쪽을 닫는 탭인지 알 수 없다. 어디서 선택이 일어나든
  // (3D 월드를 직접 탭하든, 목록에서 고르든) 이 한 곳을 거쳐 나머지 둘을 접는다.
  function selectPerson(id: string | null) {
    setSelectedId(id);
    setListOpen(false);
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/maps/${shareId}/people/${id}`, { method: "DELETE" });
    if (!res.ok) return;
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
      <div className="absolute inset-0 isolate">
        <World
          people={people}
          center={center}
          selectedId={selectedId}
          onSelect={selectPerson}
          mode={mode}
          resetSignal={resetSignal}
        />
      </div>

      {/* 카메라 시점 전환 토글. 스파이크 시절부터 쓰던 A/B/C 세 모드를 제품 화면에서도 그대로 쓴다. */}
      <div className="absolute top-[max(12px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-10">
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
      */}
      <button
        type="button"
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
    </div>
  );
}
