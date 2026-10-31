"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual, verifyPassword } from "@/lib/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/session";

export interface LoginState {
  error?: string;
}

// Rate limit en memoria: 5 intentos fallidos por IP cada 15 min.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function isLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const expectedUser = process.env.AUTH_USERNAME;
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;
  if (!expectedUser || !passwordHash || !secret) {
    console.error("[auth] Faltan AUTH_USERNAME / AUTH_PASSWORD_HASH / AUTH_SECRET");
    return { error: "El inicio de sesión no está configurado." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isLimited(ip)) {
    return { error: "Demasiados intentos. Espera 15 minutos." };
  }

  // Se evalúan ambas comprobaciones siempre (sin cortocircuito).
  const userOk = safeEqual(username, expectedUser);
  const passOk = verifyPassword(password, passwordHash);
  if (!(userOk && passOk)) {
    registerFailure(ip);
    return { error: "Usuario o contraseña incorrectos." };
  }

  attempts.delete(ip);
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(expectedUser, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
