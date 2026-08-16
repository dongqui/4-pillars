"use client";

import type { RelationRole } from "../../_data/roles";
import { FillVolume } from "./FillVolume";
import { BesideLayers } from "./BesideLayers";

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
    // express / move / refine 은 Task 4~6 에서 채운다.
    default:
      return null;
  }
}
