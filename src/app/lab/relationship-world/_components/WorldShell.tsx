"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CameraModeToggle } from "./CameraModeToggle";
import { FRIENDS } from "../_data/mock-people";
import { PersonSheet } from "./PersonSheet";
import { PeopleList } from "./PeopleList";
import type { CameraMode } from "../_lib/camera";

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function WorldShell() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("b");
  const [resetSignal, setResetSignal] = useState(0);
  const [listOpen, setListOpen] = useState(false);

  const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;

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
          selectedId={selectedId}
          onSelect={setSelectedId}
          mode={mode}
          resetSignal={resetSignal}
        />
      </div>

      {/* 스파이크 비교용 UI. 실제 제품 화면에는 없다. */}
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
        목록과 시트는 둘 다 화면 아래에서 올라오는 판이라 동시에 열면 어느 쪽을
        닫는 건지 알 수 없다. 목록을 펴면 선택을 풀고, 목록에서 사람을 고르면
        목록이 접히면서 시트가 열린다 — 언제나 하나만 떠 있다.
      */}
      <PeopleList
        open={listOpen}
        onToggle={() => {
          setListOpen((v) => {
            if (!v) setSelectedId(null);
            return !v;
          });
        }}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setListOpen(false);
        }}
      />

      <PersonSheet
        person={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
