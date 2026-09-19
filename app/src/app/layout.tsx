import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ChunkLoadRecovery } from "@/components/ChunkLoadRecovery";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ClientToaster } from "@/components/ClientToaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CloudflarePlanDialogHost } from "@/lib/cloudflare/CloudflarePlanDialog";
import { ZoomHotkeys } from "@/components/ZoomHotkeys";
import { FeedbackDialogProvider } from "@/components/feedback/FeedbackDialogProvider";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          <ChunkLoadRecovery />
          <AppProviders>
            <FeedbackDialogProvider>
              <TooltipProvider delay={200}>{children}</TooltipProvider>
            </FeedbackDialogProvider>
          </AppProviders>
          <ClientToaster />
          <CloudflarePlanDialogHost />
          <ZoomHotkeys />
        </ThemeProvider>
      </body>
    </html>
  );
}
