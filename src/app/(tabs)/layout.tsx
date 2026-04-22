import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Sidebar } from "@/components/nav/Sidebar";
import { SessionProvider } from "@/context/SessionContext";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        {/* Desktop: offset for sidebar. Mobile: offset for bottom nav */}
        <main className="md:ml-60 pb-[72px] md:pb-0 min-h-screen">
          {children}
        </main>
        <BottomTabBar />
      </div>
    </SessionProvider>
  );
}
