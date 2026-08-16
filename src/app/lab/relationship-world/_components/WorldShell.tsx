"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CameraModeToggle } from "./CameraModeToggle";
import { FRIENDS } from "../_data/mock-people";
import { PersonSheet } from "./PersonSheet";
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

  const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="relative w-full h-full">
      <World
        selectedId={selectedId}
        onSelect={setSelectedId}
        mode={mode}
        resetSignal={resetSignal}
      />

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

      <PersonSheet person={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
