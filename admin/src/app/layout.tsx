import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AdminHeader } from "@/components/layout/AdminHeader";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Relaybase Admin",
  description: "Relaybase platform administration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-screen font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <TooltipProvider delay={200}>
            <div className="flex min-h-screen flex-col bg-background">
              <AdminHeader />
              <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
