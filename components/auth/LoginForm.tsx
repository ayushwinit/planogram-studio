"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { loginAction } from "@/lib/auth/actions";
import type { LoginFormState } from "@/lib/auth/schemas";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email}
          aria-invalid={!!state?.errors?.email}
        />
        {state?.errors?.email?.[0] && (
          <p className="text-xs text-rose-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        {state?.errors?.password?.[0] && (
          <p className="text-xs text-rose-600">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.errors?.form?.[0] && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.errors.form[0]}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
