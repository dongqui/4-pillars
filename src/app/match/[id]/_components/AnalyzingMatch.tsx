/**
 * 일부만 저장돼 있을 때, 이미 그려진 본문 **아래**에 붙는 표시.
 *
 * 공용 로딩 화면(LoadingScreen)과 자리가 다르다. 여기서는 읽을 것이 이미 화면에 있으므로
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
