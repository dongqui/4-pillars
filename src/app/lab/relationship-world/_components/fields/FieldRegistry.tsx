"use client";

import type { RelationRole } from "../../_data/roles";
import { FillVolume } from "./FillVolume";
import { BesideLayers } from "./BesideLayers";
import { ExpressRays } from "./ExpressRays";
import { MoveRibbons } from "./MoveRibbons";
import { RefineShards } from "./RefineShards";

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
    case "move":
      return <MoveRibbons dimmed={dimmed} />;
    case "refine":
      return <RefineShards dimmed={dimmed} />;
  }
}
