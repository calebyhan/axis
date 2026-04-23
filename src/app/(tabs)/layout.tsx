import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Sidebar } from "@/components/nav/Sidebar";
import { TabTransition } from "@/components/nav/TabTransition";
import { SessionProvider } from "@/context/SessionContext";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        {/* Desktop: offset for sidebar. Mobile: offset for bottom nav */}
        <main className="relative min-h-screen overflow-x-hidden md:ml-64 md:pb-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_60%)] opacity-80" />
          <TabTransition>{children}</TabTransition>
        </main>
        <BottomTabBar />
      </div>
    </SessionProvider>
  );
}
