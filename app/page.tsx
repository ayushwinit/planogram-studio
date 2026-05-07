import LoginForm from "@/components/auth/LoginForm";

export default function Home() {
  return (
    <main className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          {/* Drop your logo file at /public/winit-logo.png to replace this. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/winit-logo.png"
            alt="Winit"
            className="h-14 w-auto object-contain select-none"
            draggable={false}
          />
          <h1 className="text-2xl font-semibold text-slate-900">Planogram Studio</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
