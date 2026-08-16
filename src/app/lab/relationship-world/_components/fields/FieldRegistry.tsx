"use client";

import type { RelationRole } from "../../_data/roles";
import { FillVolume } from "./FillVolume";

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
    // beside / express / move / refine 은 Task 3~6 에서 채운다.
    default:
      return null;
  }
}
