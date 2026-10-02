import { Resend } from "resend";
import type { SupportMail } from "./mail";

export interface Mailer {
  send(m: SupportMail): Promise<void>;
}

/**
 * 운영 알림 메일러. 키·보내는 곳·받는 곳 중 하나라도 비면 null 을 돌려준다 —
 * 호출자는 메일만 건너뛰고 문의 저장은 그대로 한다(결제처럼 기능을 잠그지 않는다).
 *
 * env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고 분기를 확인한다.
 */
export function createSupportMailer(
  env: Record<string, string | undefined> = process.env,
): Mailer | null {
  const key = env.RESEND_API_KEY;
  const from = env.SUPPORT_MAIL_FROM;
  const to = env.SUPPORT_MAIL_TO;
  if (!key || !from || !to) return null;

  const resend = new Resend(key);
  return {
    async send(m) {
      // resend 는 API 오류를 throw 하지 않고 { error } 로 돌려준다 — 여기서 던져야
      // 호출자의 catch 가 로그를 남긴다.
      const { error } = await resend.emails.send({
        from,
        to,
        subject: m.subject,
        text: m.text,
        ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      });
      if (error) throw new Error(`resend: ${error.name}: ${error.message}`);
    },
  };
}
