"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { signupAction } from "@/lib/auth/actions";
import type { SignupFormState } from "@/lib/auth/schemas";

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupFormState, FormData>(signupAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(`Created user ${state.success.name} (${state.success.email})`);
      formRef.current?.reset();
    }
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state?.values?.name}
          aria-invalid={!!state?.errors?.name}
        />
        {state?.errors?.name?.[0] && (
          <p className="text-xs text-rose-600">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          required
          defaultValue={state?.values?.email}
          aria-invalid={!!state?.errors?.email}
        />
        {state?.errors?.email?.[0] && (
          <p className="text-xs text-rose-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        {state?.errors?.password?.[0] ? (
          <p className="text-xs text-rose-600">{state.errors.password[0]}</p>
        ) : (
          <p className="text-xs text-slate-500">At least 8 characters with a letter and a number.</p>
        )}
      </div>

      {state?.errors?.form?.[0] && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.errors.form[0]}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
        {pending ? "Creating user…" : "Create user"}
      </Button>
    </form>
  );
}
