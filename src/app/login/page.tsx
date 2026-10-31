"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth.actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur"
      >
        <h1 className="text-2xl font-bold text-slate-900">FinanzaPro</h1>
        <p className="text-sm text-slate-500">Inicia sesión para continuar</p>

        <label className="block text-sm font-medium text-slate-700">
          Usuario
          <input
            name="username"
            autoComplete="username"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-500"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-teal-600 py-2 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
