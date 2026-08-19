export default function RelationshipWorldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // globals.css 는 light 고정이다. 다크는 이 라우트 안에서만 칠한다 —
  // 지도가 다른 화면의 색까지 바꾸면 안 된다.
  return (
    <div className="fixed inset-0 bg-[#0F172A] text-slate-100 overflow-hidden">
      {children}
    </div>
  );
}
