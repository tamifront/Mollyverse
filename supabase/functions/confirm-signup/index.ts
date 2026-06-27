import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { hashCode, isValidEmail, normalizeEmail } from "../_shared/crypto.ts"
import { handleOptions, jsonResponse } from "../_shared/cors.ts"

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 5
const MIN_PASSWORD_LENGTH = 6

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405)
  }

  try {
    const body = await req.json()
    const email = normalizeEmail(body?.email ?? "")
    const code = String(body?.code ?? "").trim()
    const password = String(body?.password ?? "")

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "INVALID_EMAIL", message: "Некорректный email" }, 400)
    }

    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({
        error: "INVALID_CODE",
        message: "Код неверный. Попробуйте ещё раз",
      }, 400)
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse({
        error: "WEAK_PASSWORD",
        message: "Пароль слишком короткий (минимум 6 символов)",
      }, 400)
    }

    const supabase = createServiceClient()

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

    const { data: record, error: fetchError } = await supabase
      .from("signup_verifications")
      .select("*")
      .eq("email", email)
      .maybeSingle()

    if (fetchError) {
      console.error("fetch signup_verifications:", fetchError)
      return jsonResponse({ error: "SERVER_ERROR" }, 500)
    }

    if (!record) {
      return jsonResponse({
        error: "NO_CODE",
        message: "Код истёк. Запросите новый",
      }, 400)
    }

    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return jsonResponse({
        error: "LOCKED",
        message: "Слишком много попыток. Попробуйте через 5 минут",
        locked_until: record.locked_until,
      }, 429)
    }

    if (new Date(record.expires_at) < new Date()) {
      await supabase.from("signup_verifications").delete().eq("email", email)
      return jsonResponse({
        error: "EXPIRED",
        message: "Код истёк. Запросите новый",
      }, 400)
    }

    const inputHash = await hashCode(code)

    if (inputHash !== record.code_hash) {
      const attempts = (record.attempts ?? 0) + 1
      const update: Record<string, unknown> = {
        attempts,
        updated_at: new Date().toISOString(),
      }

      if (attempts >= MAX_ATTEMPTS) {
        update.locked_until = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString()
      }

      await supabase
        .from("signup_verifications")
        .update(update)
        .eq("email", email)

      if (attempts >= MAX_ATTEMPTS) {
        return jsonResponse({
          error: "LOCKED",
          message: "Слишком много попыток. Попробуйте через 5 минут",
          locked_until: update.locked_until,
        }, 429)
      }

      return jsonResponse({
        error: "INVALID_CODE",
        message: "Код неверный. Попробуйте ещё раз",
        attempts_left: MAX_ATTEMPTS - attempts,
      }, 400)
    }

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nickname: email.split("@")[0],
        },
      })

    if (createError) {
      console.error("createUser:", createError)
      const msg = (createError.message || "").toLowerCase()
      if (msg.includes("already") || msg.includes("registered")) {
        return jsonResponse({
          error: "EMAIL_EXISTS",
          message: "Пользователь с такой почтой уже существует",
        }, 409)
      }
      return jsonResponse({ error: "CREATE_USER_FAILED" }, 500)
    }

    await supabase.from("signup_verifications").delete().eq("email", email)

    return jsonResponse({
      ok: true,
      user_id: newUser.user?.id,
    })
  } catch (err) {
    console.error("confirm-signup:", err)
    return jsonResponse({ error: "SERVER_ERROR" }, 500)
  }
})
