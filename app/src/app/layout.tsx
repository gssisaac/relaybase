import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CloudflarePlanDialogHost } from "@/lib/cloudflare/CloudflarePlanDialog";
import { ZoomHotkeys } from "@/components/ZoomHotkeys";
import { AppProviders } from "@/lib/desktop/shell";

import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Relaybase",
  description: "Email dashboard",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} h-svh overflow-hidden font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AppProviders>
            <TooltipProvider delay={200}>{children}</TooltipProvider>
          </AppProviders>
          <Toaster />
          <CloudflarePlanDialogHost />
          <ZoomHotkeys />
        </ThemeProvider>
      </body>
    </html>
  );
}
