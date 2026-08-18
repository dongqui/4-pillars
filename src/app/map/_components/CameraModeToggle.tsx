"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { CAMERA_MODE_OPTIONS, type CameraMode } from "../_lib/camera";

export function CameraModeToggle({
  mode,
  onChange,
  onReset,
}: {
  mode: CameraMode;
  onChange: (m: CameraMode) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[210px] opacity-85">
        <SegmentedControl options={CAMERA_MODE_OPTIONS} value={mode} onChange={onChange} />
      </div>
      {/* Reset 은 C 에서만. 자유도가 높을 때만 길을 잃는다. */}
      {mode === "c" && (
        <button
          type="button"
          onClick={onReset}
          className="h-9 px-3 text-[13px] font-medium rounded-lg border border-slate-400/30 bg-slate-900/60 text-slate-200 backdrop-blur-sm cursor-pointer"
        >
          처음 위치로
        </button>
      )}
    </div>
  );
}
