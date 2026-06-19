import { useState } from "react";
import { LoginModal } from "@4-pillars/ui";
import { t } from "@4-pillars/i18n";
import { apiBaseUrl } from "../lib/auth";
import { useLocale } from "../lib/locale";

export default function Login() {
  const [open, setOpen] = useState(true);
  const locale = useLocale();
  const m = t(locale).login;
  const returnUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  return (
    <main style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>
        {m.open}
      </button>
      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        apiBaseUrl={apiBaseUrl}
        returnUrl={returnUrl}
        locale={locale}
        title={m.title}
        labels={{
          kakao: m.kakao,
          line: m.line,
          google: m.google,
          apple: m.apple,
        }}
      />
    </main>
  );
}
