import type { Metadata } from "next";
import { LegalPage } from "../_components/LegalPage";
import { COMPANY } from "../_lib/company";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 사주대소",
  description: "사주대소 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updatedAt="2026-08-12">
      <p>
        {COMPANY.name}(이하 &ldquo;회사&rdquo;)은 이용자의 개인정보를 중요하게 여기며, 「개인정보
        보호법」 등 관계 법령을 준수합니다. 회사가 처리하는 개인정보의 항목과 목적은 다음과 같습니다.
      </p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li>소셜 로그인 계정 식별자, 이메일, 닉네임</li>
        <li>사주 계산을 위한 입력값: 생년월일시, 성별, (선택) 출생지</li>
        <li>결제 관련 정보: 거래·주문 식별자 (카드 정보 등은 결제대행사가 처리하며 회사는 보관하지 않습니다)</li>
      </ul>

      <h2>2. 개인정보의 이용 목적</h2>
      <ul>
        <li>사주 리포트의 생성·제공</li>
        <li>결제 및 환불 처리</li>
        <li>문의 응대 및 서비스 운영</li>
      </ul>

      <h2>3. 보유 및 이용 기간</h2>
      <p>
        회원 탈퇴 시 지체 없이 파기하는 것을 원칙으로 합니다. 다만 「전자상거래 등에서의 소비자보호에
        관한 법률」 등 관계 법령에 따라 보존이 필요한 거래·결제 기록은 해당 법령이 정한 기간 동안
        보관합니다.
      </p>

      <h2>4. 개인정보 처리의 위탁</h2>
      <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
      <ul>
        <li>PortOne 및 연동 결제대행사(KG이니시스 등): 결제·환불 처리</li>
        <li>Neon: 데이터베이스 저장·운영</li>
        <li>Upstash: 세션 관리</li>
        <li>소셜 로그인 제공자(카카오·LINE·Google): 로그인 인증</li>
      </ul>

      <h2>5. 정보주체의 권리</h2>
      <p>
        이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있으며,{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a> 로 요청할 수 있습니다.
      </p>

      <h2>6. 개인정보의 파기</h2>
      <p>
        보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일은
        복구할 수 없는 방법으로 삭제합니다.
      </p>

      <h2>7. 개인정보 보호책임자</h2>
      <p>
        성명: {COMPANY.ceo} / 연락처:{" "}
        <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
      </p>

      <h2>8. 고지의 의무</h2>
      <p>이 방침의 내용이 변경되는 경우 변경 사항을 서비스 내 공지를 통해 알립니다.</p>
    </LegalPage>
  );
}
