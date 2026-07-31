/**
 * 디자인에는 없는 화면. 로그인 직후 첫 방문자는 대부분 프로필이 0개라
 * 목록만 비워 두면 무엇을 해야 하는지 알 수 없다.
 */
export function EmptyState() {
  return (
    <div className="pb-2 pt-6 text-center">
      <p className="mb-1.5 text-[17px] font-bold tracking-[-0.02em]">
        아직 저장된 프로필이 없어요
      </p>
      <p className="text-sm text-slate-400 [word-break:keep-all]">
        생년월일시를 입력하면 사주 리포트를 만들어 드려요.
      </p>
    </div>
  );
}
