import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Relaybase Console",
  description:
    "Relaybase account, billing, license, and recovery console.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
