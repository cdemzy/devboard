"use client";

import { useSearchParams } from "next/navigation";
import { Layers3, LockKeyhole } from "lucide-react";

export default function AccessPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-sm rounded-xl border border-border bg-[#161b22] p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-2.5 text-lg font-semibold"><Layers3 size={24} className="text-primary" />DevBoard</div>
        <div className="mb-6"><h1 className="text-xl font-semibold">Enter workspace password</h1><p className="mt-2 text-sm text-muted-foreground">This workspace is protected.</p></div>
        <form action="/api/access" method="post" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label>Password<input name="password" type="password" autoComplete="current-password" autoFocus required /></label>
          {searchParams.get("error") && <p role="alert" className="text-sm text-rose-300">Incorrect password. Try again.</p>}
          <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"><LockKeyhole size={15} />Continue</button>
        </form>
      </section>
    </main>
  );
}
