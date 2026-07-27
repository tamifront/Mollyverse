import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { sendVerificationEmail } from "../_shared/email.ts"
import {
  generateSixDigitCode,
  hashCode,
  isValidEmail,
  normalizeEmail,
} from "../_shared/crypto.ts"
import { handleOptions, jsonResponse } from "../_shared/cors.ts"

const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 5

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405)
  }

  try {
    const body = await req.json()
    const email = normalizeEmail(body?.email ?? "")

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "INVALID_EMAIL", message: "Некорректный email" }, 400)
    }

    const supabase = createServiceClient()

    await supabase.rpc("cleanup_expired_signup_verifications")

    const { data: alreadyRegistered, error: checkError } = await supabase.rpc(
      "check_email_registered",
      { p_email: email }
    )

    if (checkError) {
      console.error("check_email_registered:", checkError)
      return jsonResponse({ error: "SERVER_ERROR" }, 500)
    }

    if (alreadyRegistered) {
      return jsonResponse({
        error: "EMAIL_EXISTS",
        message: "Пользователь с такой почтой уже существует",
      }, 409)
    }

    const { data: existing } = await supabase
      .from("signup_verifications")
      .select("locked_until")
      .eq("email", email)
      .maybeSingle()

    if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
      return jsonResponse({
        error: "LOCKED",
        message: "Слишком много попыток. Попробуйте через 5 минут",
        locked_until: existing.locked_until,
      }, 429)
    }

    const code = generateSixDigitCode()
    const codeHash = await hashCode(code)
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()

    const { error: upsertError } = await supabase
      .from("signup_verifications")
      .upsert(
        {
          email,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )

    if (upsertError) {
      console.error("upsert signup_verifications:", upsertError)
      return jsonResponse({ error: "SERVER_ERROR" }, 500)
    }

    try {
      await sendVerificationEmail(email, code)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg === "EMAIL_NOT_CONFIGURED") {
        return jsonResponse({ error: "EMAIL_NOT_CONFIGURED" }, 503)
      }
      if (msg === "RESEND_TEST_EMAIL_ONLY") {
        return jsonResponse({
          error: "RESEND_TEST_EMAIL_ONLY",
          message:
            "На тестовом Resend письма уходят только на почту аккаунта Resend (tamilaismailova2012@gmail.com)",
        }, 502)
      }
      if (msg === "RESEND_INVALID_KEY") {
        return jsonResponse({
          error: "RESEND_INVALID_KEY",
          message: "Неверный API-ключ Resend. Создайте новый ключ и обновите secrets",
        }, 502)
      }
      if (msg === "RESEND_FROM_INVALID") {
        return jsonResponse({
          error: "RESEND_FROM_INVALID",
          message: "Неверный адрес отправителя. Используйте onboarding@resend.dev",
        }, 502)
      }
      if (msg === "EMAIL_INVALID_KEY") {
        return jsonResponse({
          error: "EMAIL_INVALID_KEY",
          message: "Неверный API-ключ Brevo. Создайте новый ключ в панели Brevo",
        }, 502)
      }
      if (msg === "EMAIL_SENDER_NOT_VERIFIED") {
        return jsonResponse({
          error: "EMAIL_SENDER_NOT_VERIFIED",
          message: "Подтвердите email отправителя в Brevo (Senders → Verify)",
        }, 502)
      }
      await supabase.from("signup_verifications").delete().eq("email", email)
      return jsonResponse({ error: "EMAIL_SEND_FAILED" }, 502)
    }

    return jsonResponse({
      ok: true,
      expires_at: expiresAt,
      resend_cooldown_seconds: 60,
      max_attempts: MAX_ATTEMPTS,
      lockout_minutes: LOCKOUT_MINUTES,
    })
  } catch (err) {
    console.error("request-signup-code:", err)
    return jsonResponse({ error: "SERVER_ERROR" }, 500)
  }
})
