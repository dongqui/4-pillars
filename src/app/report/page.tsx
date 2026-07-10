export default function ReportPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-accent-50 text-accent flex items-center justify-center text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold tracking-tight mt-2">분석이 완료되었어요</h1>
      <p className="text-slate-500">리포트 화면은 준비 중입니다.</p>
      <a
        href="/"
        className="mt-4 text-[15px] font-semibold text-accent hover:opacity-80"
      >
        처음으로 →
      </a>
    </main>
  );
}
