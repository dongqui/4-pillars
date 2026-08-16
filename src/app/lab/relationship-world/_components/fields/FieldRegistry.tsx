"use client";

import type { RelationRole } from "../../_data/roles";
import { FillVolume } from "./FillVolume";
import { BesideLayers } from "./BesideLayers";
import { ExpressRays } from "./ExpressRays";

export function FieldRegistry({
  role,
  dimmed,
}: {
  role: RelationRole;
  dimmed: boolean;
}) {
  switch (role) {
    case "fill":
      return <FillVolume dimmed={dimmed} />;
    case "beside":
      return <BesideLayers dimmed={dimmed} />;
    case "express":
      return <ExpressRays dimmed={dimmed} />;
    // move / refine 은 Task 5~6 에서 채운다.
    default:
      return null;
  }
}
