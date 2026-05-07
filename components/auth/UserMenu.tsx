"use client";

import Link from "next/link";
import { useTransition } from "react";
import { UserPlus, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { logoutAction } from "@/lib/auth/actions";

export default function UserMenu({ name, email }: { name: string; email: string }) {
  const [pending, startTransition] = useTransition();

  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-1.5 pr-2">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-[11px] font-semibold text-white">
            {initials}
          </span>
          <span className="hidden sm:inline text-sm font-medium text-slate-700 max-w-[120px] truncate">
            {name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
          <div className="text-xs text-slate-500 truncate">{email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/signup" className="cursor-pointer">
            <UserPlus className="h-4 w-4" /> Add user
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => logoutAction());
          }}
        >
          <LogOut className="h-4 w-4" /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
