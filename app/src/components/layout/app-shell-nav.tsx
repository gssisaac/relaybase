"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { UserSidebar } from "@/components/layout/UserSidebar";
import { useIsMobile } from "@/components/layout/use-is-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type AppShellNavContextValue = {
  isMobile: boolean;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  openNav: () => void;
  closeNav: () => void;
};

const AppShellNavContext = createContext<AppShellNavContextValue | null>(null);

export function useOptionalAppShellNav() {
  return useContext(AppShellNavContext);
}

export function useAppShellNav() {
  const ctx = useContext(AppShellNavContext);
  if (!ctx) {
    throw new Error("useAppShellNav requires AppShellFrame");
  }
  return ctx;
}

export function AppShellFrame({
  teamMode = false,
  hideSidebar = false,
  children,
}: {
  teamMode?: boolean;
  hideSidebar?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  const navValue = useMemo(
    () => ({
      isMobile,
      navOpen,
      setNavOpen,
      openNav,
      closeNav,
    }),
    [closeNav, isMobile, navOpen, openNav],
  );

  const sidebarFallback = (
    <aside className="h-full w-60 shrink-0 border-r border-sidebar-border bg-sidebar" />
  );

  return (
    <AppShellNavContext.Provider value={navValue}>
      <div className="flex h-svh overflow-hidden bg-background">
        {!hideSidebar ? (
          <>
            <div className="hidden h-full shrink-0 md:block">
              <Suspense fallback={sidebarFallback}>
                <UserSidebar teamMode={teamMode} />
              </Suspense>
            </div>
            {isMobile ? (
              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetContent
                  side="left"
                  showCloseButton
                  className="w-[min(100vw,17rem)] max-w-[88vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                >
                  <div className="h-full min-h-0 overflow-hidden">
                    <Suspense fallback={sidebarFallback}>
                      <UserSidebar teamMode={teamMode} presentation="sheet" />
                    </Suspense>
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
          </>
        ) : null}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </AppShellNavContext.Provider>
  );
}
