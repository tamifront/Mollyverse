import "jsr:@supabase/functions-js/edge-runtime.d.ts"

function cleanEnv(value: string | undefined, fallback = "") {
  if (!value) return fallback
  let v = value.trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v || fallback
}

function buildEmailHtml(code: string) {
  return `
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
  `
}

async function sendViaBrevo(to: string, code: string) {
  const apiKey = cleanEnv(Deno.env.get("BREVO_API_KEY"))
  const senderEmail = cleanEnv(Deno.env.get("BREVO_SENDER_EMAIL"))
  const senderName = cleanEnv(Deno.env.get("BREVO_SENDER_NAME"), "Mollyverse")

  if (!apiKey || !senderEmail) {
    console.error("BREVO_API_KEY or BREVO_SENDER_EMAIL is not set")
    throw new Error("EMAIL_NOT_CONFIGURED")
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject: "Код подтверждения — Mollyverse",
      htmlContent: buildEmailHtml(code),
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("Brevo error:", response.status, text)
    let detail = "EMAIL_SEND_FAILED"
    try {
      const parsed = JSON.parse(text)
      const msg = String(parsed?.message || "").toLowerCase()
      if (msg.includes("key") || msg.includes("unauthorized")) {
        detail = "EMAIL_INVALID_KEY"
      } else if (msg.includes("sender") || msg.includes("not verified")) {
        detail = "EMAIL_SENDER_NOT_VERIFIED"
      }
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
}

async function sendViaResend(to: string, code: string) {
  const resendKey = cleanEnv(Deno.env.get("RESEND_API_KEY"))
  const fromEmail = cleanEnv(
    Deno.env.get("RESEND_FROM_EMAIL"),
    "onboarding@resend.dev"
  )

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
      html: buildEmailHtml(code),
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("Resend error:", response.status, text)
    let detail = "EMAIL_SEND_FAILED"
    try {
      const parsed = JSON.parse(text)
      const msg = String(parsed?.message || parsed?.error || "").toLowerCase()
      if (msg.includes("only send") && msg.includes("your own")) {
        detail = "RESEND_TEST_EMAIL_ONLY"
      } else if (msg.includes("api key") || msg.includes("invalid")) {
        detail = "RESEND_INVALID_KEY"
      } else if (msg.includes("from") || msg.includes("domain")) {
        detail = "RESEND_FROM_INVALID"
      }
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
}

/** Brevo — на любой email. Resend — только с подтверждённым доменом. */
export async function sendVerificationEmail(to: string, code: string) {
  const brevoKey = cleanEnv(Deno.env.get("BREVO_API_KEY"))
  if (brevoKey) {
    await sendViaBrevo(to, code)
    return
  }
  await sendViaResend(to, code)
}
