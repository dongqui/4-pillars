import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { NoteCard, TipCard } from "./NoteCard";
import { EmphasizedText } from "./EmphasizedText";

/** 조건 한 줄. 힘이 나는 쪽은 파란 체크, 빠지는 쪽은 회색 마이너스. */
function ConditionItem({ text, tone }: { text: string; tone: "good" | "bad" }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span
        className={`flex-none w-[18px] h-[18px] mt-0.5 rounded-full font-bold flex items-center justify-center ${
          tone === "good"
            ? "bg-accent text-white text-[10px]"
            : "bg-slate-100 text-slate-400 text-[11px]"
        }`}
        aria-hidden
      >
        {tone === "good" ? "✓" : "−"}
      </span>
      <span className="text-sm text-slate-700 leading-[1.6] [text-wrap:pretty]">{text}</span>
    </div>
  );
}

export function EnvironmentSection({
  energizing,
  draining,
  summary,
  emphasis,
  roles,
  roleNote,
}: {
  energizing: string[];
  draining: string[];
  summary: string;
  emphasis: string;
  roles: string[];
  roleNote: string;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="environment" />
      <CardGrid>
        <div className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-accent mb-3.5">힘이 나는 조건</div>
          <div className="flex flex-col gap-[11px]">
            {energizing.map((item, i) => (
              <ConditionItem key={`${item}-${i}`} text={item} tone="good" />
            ))}
          </div>
        </div>
        <div className="border border-slate-200 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-slate-400 mb-3.5">기운이 빠지는 조건</div>
          <div className="flex flex-col gap-[11px]">
            {draining.map((item, i) => (
              <ConditionItem key={`${item}-${i}`} text={item} tone="bad" />
            ))}
          </div>
        </div>
      </CardGrid>
      <NoteCard>
        <EmphasizedText text={summary} emphasis={emphasis} />
      </NoteCard>
      <TipCard label="강점이 드러나는 자리">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {roles.map((role, i) => (
            <span
              key={`${role}-${i}`}
              className="text-[13px] font-semibold text-accent bg-accent-50 border border-accent-200 px-[11px] py-1 rounded-lg"
            >
              {role}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">
          {roleNote}
        </p>
      </TipCard>
    </section>
  );
}
