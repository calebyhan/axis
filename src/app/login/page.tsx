"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="page-kicker">Axis</div>
          <h1 className="text-[2.4rem] font-semibold tracking-[-0.06em]">Personal athletic dashboard</h1>
          <p className="text-muted text-sm mt-3">Matte-black glass UI for training, recovery, and long-term progress.</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">Check your email for a login link.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-sm text-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="glass-input text-sm"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <button
              type="submit"
              className="glass-button glass-button-primary w-full text-sm font-medium"
            >
              Send magic link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
