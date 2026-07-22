"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Country } from "../_lib/regions";

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

export function FunnelProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FunnelData>(initialData);

  const update = useCallback((patch: Partial<FunnelData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setData(initialData), []);

  const value = useMemo(() => ({ data, update, reset }), [data, update, reset]);

  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used within FunnelProvider");
  return ctx;
}
