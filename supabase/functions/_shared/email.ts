import "jsr:@supabase/functions-js/edge-runtime.d.ts"

export async function sendVerificationEmail(to: string, code: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY")
  const fromEmail =
    Deno.env.get("RESEND_FROM_EMAIL") ?? "Mollyverse <onboarding@resend.dev>"

  if (!resendKey) {
    console.error("RESEND_API_KEY is not set")
    throw new Error("EMAIL_NOT_CONFIGURED")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "Код подтверждения — Mollyverse",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #7c5cfc;">Mollyverse</h2>
          <p>Ваш код подтверждения:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111;">
            ${code}
          </p>
          <p style="color: #666;">Код действует <strong>15 минут</strong>.</p>
          <p style="color: #999; font-size: 13px;">
            Если вы не регистрировались в Mollyverse — просто проигнорируйте это письмо.
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("Resend error:", response.status, text)
    throw new Error("EMAIL_SEND_FAILED")
  }
}
