/**
 * 캐릭터가 나오기 전의 대기 연출.
 *
 * 퍼널의 마지막(계산 중)과 리빌의 첫 페이즈가 같은 화면처럼 보여야 해서 한 벌만 둔다 —
 * 두 라우트에 걸쳐 있지만 사용자에게는 끊기지 않는 한 장면이다.
 * 결과가 확정되기 전에는 캐릭터 색을 쓰지 않는다. 중립으로 두었다가 카드가 뜰 때
 * 처음 색이 나온다.
 */
export function CharacterLoadingBlock({ line }: { line: string }) {
  return (
    <div className="relative flex flex-col items-center px-8 text-center">
      <div className="relative mb-8 h-[86px] w-[86px]">
        <div className="pv-breathe absolute inset-0 rounded-full [background:radial-gradient(circle_at_50%_45%,rgba(255,255,255,.14),rgba(255,255,255,0)_70%)]" />
        <div className="absolute inset-[10px] rounded-full border-[1.5px] border-white/15" />
        <div className="absolute inset-[10px] animate-spin rounded-full border-2 border-transparent border-t-white/70" />
      </div>
      {/* 애니메이션을 못 보는 사람에게도 진행 중임이 전해져야 한다 */}
      <div
        role="status"
        aria-live="polite"
        className="pv-fade text-[clamp(20px,3.2vw,24px)] font-bold tracking-[-0.03em] text-white"
      >
        {line}
      </div>
    </div>
  );
}

/** 리빌과 같은 배경을 깐 전체 화면 판 */
export function CharacterLoadingScreen({ line }: { line: string }) {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-900 py-14">
      <div
        aria-hidden
        className="absolute inset-0 [background:radial-gradient(680px_560px_at_50%_50%,rgba(255,255,255,.07)_0%,rgba(255,255,255,0)_68%)]"
      />
      <CharacterLoadingBlock line={line} />
    </main>
  );
}
