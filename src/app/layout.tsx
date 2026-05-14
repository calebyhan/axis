import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUserAccentColor } from "@/lib/queries/profile";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { TimeZoneSync } from "@/components/TimeZoneSync";

export const metadata: Metadata = {
  title: "Axis",
  description: "Personal athletic dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Axis",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0A",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const accent = await getUserAccentColor();

  return (
    <html lang="en" data-accent={accent}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-background text-white antialiased">
        <TimeZoneSync />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
