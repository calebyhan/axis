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
        <main className="relative min-h-screen overflow-x-hidden pb-6 md:ml-64 md:pb-0">
          <TabTransition>{children}</TabTransition>
        </main>
        <BottomTabBar />
      </div>
    </SessionProvider>
  );
}
