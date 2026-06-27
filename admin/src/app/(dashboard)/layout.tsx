import { EmailSenderProvider } from "@/relaybase/components/EmailSenderContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <EmailSenderProvider>{children}</EmailSenderProvider>
    </div>
  );
}
