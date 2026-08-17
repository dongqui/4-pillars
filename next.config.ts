import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 실기기(폰)에서 dev 서버를 열려면 localhost 가 아니라 LAN IP 로 접속해야 하는데,
  // Next 16 은 dev 리소스(/_next/*)에 대한 교차 출처 요청을 기본으로 막는다.
  // 막히면 JS 청크가 전부 403 이 되어 하이드레이션이 아예 일어나지 않고,
  // 화면은 서버 렌더된 로딩 상태에서 영원히 멈춘 것처럼 보인다.
  // dev 서버에만 적용되며 프로덕션 빌드에는 영향이 없다.
  allowedDevOrigins: ["172.30.1.*"],
};

export default nextConfig;
