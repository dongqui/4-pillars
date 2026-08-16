"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Country } from "@/lib/regions";

export type Gender = "male" | "female";
export type Calendar = "solar" | "lunar";

export interface FunnelData {
  name: string;
  gender: Gender | null;
  calendar: Calendar;
  isLeapMonth: boolean;
  birth: { y: number; m: number; d: number } | null;
  timeKnown: boolean;
  time: { h: number; m: number } | null;
  birthPlace: { country: Country; regionId: string } | null;
  trueSolar: boolean;
}

const initialData: FunnelData = {
  name: "",
  gender: null,
  calendar: "solar",
  isLeapMonth: false,
  birth: null,
  timeKnown: true,
  time: null,
  birthPlace: null,
  trueSolar: true,
};

interface FunnelContextValue {
  data: FunnelData;
  update: (patch: Partial<FunnelData>) => void;
  reset: () => void;
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  /** 라이트 퍼널에서 넘어온 값. 없으면 빈 퍼널이다 */
  initial?: Partial<FunnelData>;
}) {
  // initial 은 서버가 첫 렌더에 정해 주는 값이라 이후 바뀌지 않는다 — 초기값으로만 쓴다.
  const seeded = useMemo(() => ({ ...initialData, ...initial }), [initial]);
  const [data, setData] = useState<FunnelData>(seeded);

  const update = useCallback((patch: Partial<FunnelData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  // 되돌릴 자리는 "빈 퍼널"이 아니라 "들어올 때의 상태"다.
  const reset = useCallback(() => setData(seeded), [seeded]);

  const value = useMemo(() => ({ data, update, reset }), [data, update, reset]);

  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used within FunnelProvider");
  return ctx;
}
