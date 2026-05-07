import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/dal";
import SignupForm from "@/components/auth/SignupForm";

export default async function SignupPage() {
  const session = await requireSession();

  return (
    <main className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col gap-6">
        <Link
          href="/editor"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-slate-900">Add a new user</h1>
            <p className="mt-1 text-sm text-slate-500">
              Creates an account in your tenant. The new user can sign in with the email and password
              you set here. Signed in as <span className="font-medium text-slate-700">{session.email}</span>.
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
