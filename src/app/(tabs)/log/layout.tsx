import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log – Axis",
  description: "Log workouts, runs, and body weight.",
};

export default function LogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
