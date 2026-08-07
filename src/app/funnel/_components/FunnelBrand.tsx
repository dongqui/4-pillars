"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppBrand } from "@/components/AppBrand";
import { useFunnel } from "../_context/FunnelContext";
import { hasInput } from "../_lib/hasInput";
import { LeaveConfirmDialog } from "./LeaveConfirmDialog";

const HREF = "/";

/**
 * 퍼널 좌측 레일의 로고. 퍼널 입력은 메모리에만 있어서 여기서 나가면 그대로 사라지므로,
 * 채운 값이 있을 때만 확인을 묻고 빈 상태면 바로 보낸다.
 */
export function FunnelBrand() {
  const { data } = useFunnel();
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <AppBrand
        href={HREF}
        onNavigate={(e) => {
          if (!hasInput(data)) return;
          e.preventDefault();
          setAsking(true);
        }}
        iconClassName="w-[34px] h-[34px] rounded-[10px] bg-slate-900 text-base font-bold"
        textClassName="font-bold text-lg tracking-tight"
      />
      {asking && (
        <LeaveConfirmDialog
          onCancel={() => setAsking(false)}
          onConfirm={() => router.push(HREF)}
        />
      )}
    </>
  );
}
