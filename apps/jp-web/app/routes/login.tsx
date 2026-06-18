import { useState } from "react";
import { LoginModal } from "@4-pillars/ui";
import { apiBaseUrl } from "../lib/auth";

export default function Login() {
  const [open, setOpen] = useState(true);
  const returnUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  return (
    <main style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>
        ログインを開く
      </button>
      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        apiBaseUrl={apiBaseUrl}
        returnUrl={returnUrl}
        locale="ja"
        title="ログイン"
        labels={{
          kakao: "Kakaoで始める",
          line: "LINEで始める",
          google: "Googleで始める",
          apple: "Appleで始める",
        }}
      />
    </main>
  );
}
