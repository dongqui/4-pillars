"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

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

  return (
    <div className="relative w-full h-full">
      <World selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}
