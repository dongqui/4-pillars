import { sectionHeading, type SectionKey } from "@/app/api/saju/_lib/sections";

/**
 * 번호·카테고리·제목을 그대로 그리는 순수 표시부. match(궁합) 리포트는 섹션
 * 레지스트리가 아닌 자기 해석 결과(MatchInterpretation)에서 제목을 뽑아 쓰므로
 * 여기서 마크업만 공유한다.
 */
export function SectionHeadingRaw({ no, category, title }: { no: string; category: string; title: string }) {
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-2">{no} · {category}</div>
      <h2 className="text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] m-0 mb-5">{title}</h2>
    </>
  );
}

/**
 * 섹션 머리말. 번호·카테고리·제목을 여기서 받지 않고 레지스트리에서 읽는다 —
 * 컴포넌트마다 번호를 적어 두면 순서를 바꿀 때 화면과 잠금 목록이 갈라진다.
 */
export function SectionHeading({ section }: { section: SectionKey }) {
  const { no, category, title } = sectionHeading(section);
  return <SectionHeadingRaw no={no} category={category} title={title} />;
}
