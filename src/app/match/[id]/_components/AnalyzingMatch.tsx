/**
 * 저장된 섹션이 하나도 없을 때의 Suspense fallback.
 *
 * 이름을 받지 않는 이유가 바뀌었다. 예전에는 히어로가 <Suspense> 밖에 있어 이름이
 * 이미 떠 있었기 때문이었지만, 지금은 히어로도 안쪽으로 들어가 이 화면에는 아무
 * 신원 정보가 없다 — 보여줄 본문이 없는 화면에 이름과 아바타만 떠 있으면 기다림이
 * 더 길게 느껴진다는 판단이다.
 */
export function AnalyzingMatch() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">궁합을 풀어보고 있어요</div>
      <div className="text-[15px] text-slate-500 mt-2">두 사람의 사주를 겹쳐 보는 중이에요</div>
      <div className="text-[13px] text-slate-400 mt-5">
        처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.
      </div>
    </div>
  );
}

/**
 * 일부만 저장돼 있을 때, 이미 그려진 본문 **아래**에 붙는 표시.
 *
 * 위의 전체 화면 스피너와 자리가 다르다. 여기서는 읽을 것이 이미 화면에 있으므로
 * 시선을 뺏지 않아야 한다 — 큰 스피너와 굵은 문구 대신 한 줄로 둔다.
 */
export function AnalyzingRestOfMatch() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-[72px] flex items-center justify-center gap-2.5 text-slate-400"
    >
      <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      <span className="text-[13px]">남은 이야기를 마저 풀어보고 있어요</span>
    </div>
  );
}
