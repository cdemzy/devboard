"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { AuthScreen } from "@/components/auth-screen";
import { Workspace } from "@/components/workspace";
export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const client = getSupabase();
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setLoading(false);
      });
      client.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) setError(error.message);
          setSession(data.session);
          setLoading(false);
        })
        .catch((error) => {
          setError(String(error));
          setLoading(false);
        });
      return () => subscription.unsubscribe();
    } catch (error) {
      // Defer configuration failures so the initial render remains deterministic.
      queueMicrotask(() => {
        setError(error instanceof Error ? error.message : "Unable to connect.");
        setLoading(false);
      });
    }
  }, []);
  if (loading)
    return (
      <main
        className="app-loading grid min-h-screen place-items-center text-muted-foreground"
        role="status"
      >
        Opening your workspace…
      </main>
    );
  if (error)
    return (
      <main className="app-error-screen grid min-h-screen place-items-center p-8">
        <div className="app-error-content max-w-md">
          <h1 className="mb-3 text-xl font-semibold">DevBoard setup</h1>
          <p role="alert" className="app-error-message text-muted-foreground">
            {error}
          </p>
        </div>
      </main>
    );
  return session ? (
    <Workspace
      key={session.user.id}
      email={session.user.email ?? "Your account"}
    />
  ) : (
    <AuthScreen />
  );
}
