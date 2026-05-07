"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/actions";

export default function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => startTransition(() => logoutAction())}
      disabled={pending}
      title="Sign out"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
