"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth.actions";

const fieldCls =
  "w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 shadow-lg shadow-teal-500/30">
            <ShieldCheck className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            FinanzaPro
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tus finanzas personales, en un solo lugar
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
        >
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-semibold text-slate-600">
              Usuario
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
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
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-slate-600">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
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
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div aria-live="polite" className="min-h-5">
            {state.error && (
              <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {state.error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-base font-bold text-slate-950 shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
