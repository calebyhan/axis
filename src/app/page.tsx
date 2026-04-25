import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Axis", description: "Personal athletic dashboard" };

export default function Root() {
  redirect("/dashboard");
}
