"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth.actions";

const fieldCls =
  "w-full rounded-xl border border-white/[0.08] bg-surface-container-low py-3 pl-10 pr-3 text-base text-on-surface outline-none transition placeholder:text-outline focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10 overflow-hidden bg-surface text-on-surface">
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shadow-lg shadow-primary/20">
            <ShieldCheck className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">
            FinanzaPro
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tus finanzas personales, en un solo lugar
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-white/[0.08] bg-surface-container/90 p-6 shadow-2xl backdrop-blur-xl"
        >
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Usuario
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
                autoFocus
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className={`${fieldCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-5">
            {state.error && (
              <p role="alert" className="rounded-xl bg-[#93000a]/40 border border-tertiary/30 px-3 py-2 text-sm text-[#ffdad6]">
                {state.error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-on-primary shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
