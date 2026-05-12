import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in – Axis",
  description: "Sign in to your personal athletic dashboard.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
