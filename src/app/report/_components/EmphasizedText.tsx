/** 요약 문장 중 일부(emphasis)를 <strong>으로 강조해 렌더링하는 공용 헬퍼. */
export function EmphasizedText({ text, emphasis }: { text: string; emphasis: string }) {
  if (!emphasis) return <>{text}</>;

  const index = text.indexOf(emphasis);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const after = text.slice(index + emphasis.length);

  return (
    <>
      {before}
      <strong className="text-slate-900">{emphasis}</strong>
      {after}
    </>
  );
}
