import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "프로젝트 사주",
  description: "생년월일시로 사주 원국을 계산하는 AI 사주 리포트 서비스",
  // iOS Safari 는 전화번호처럼 생긴 글자를 멋대로 <a href="tel:..."> 로 감싼다.
  // 사업자등록번호(432-33-01882)가 딱 그 꼴이라 서버 HTML 에 없던 링크가
  // 하이드레이션 직전 DOM 에 생기고, React 는 트리 전체를 버리고 다시 그린다.
  // 전화번호 링크는 우리가 직접 건다 — 브라우저 추측에 맡기지 않는다.
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
