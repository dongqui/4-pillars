export default function RelationshipWorldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // globals.css 는 light 고정이다. 다크는 이 라우트 안에서만 칠한다 —
  // 스파이크가 프로덕션 화면 색을 바꾸면 안 된다.
  return (
    <div className="fixed inset-0 bg-[#0F172A] text-slate-100 overflow-hidden">
      {children}
    </div>
  );
}
