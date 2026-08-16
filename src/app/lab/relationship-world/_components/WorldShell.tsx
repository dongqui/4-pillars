"use client";

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
  return (
    <div className="relative w-full h-full">
      <World />
    </div>
  );
}
