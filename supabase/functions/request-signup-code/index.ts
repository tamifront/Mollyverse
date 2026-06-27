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
