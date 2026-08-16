import type { Metadata } from "next";
import { WorldShell } from "./_components/WorldShell";

export const metadata: Metadata = {
  title: "관계 지도 스파이크",
  robots: { index: false, follow: false },
};

export default function RelationshipWorldPage() {
  return <WorldShell />;
}
