"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CameraModeToggle } from "./CameraModeToggle";
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
          onReset={() => setResetSignal((n) => n + 1)}
        />
      </div>
    </div>
  );
}
