import { EmailAppProviders } from "@/mail-platform/runtime";

/**
 * Email app layout — web-only mail client.
 *
 * No console gate, no desktop shell, no Touch ID. Just the mail runtime
 * + the mail pages. Login is handled by `/login` within this group.
 */
export default function EmailAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmailAppProviders>{children}</EmailAppProviders>;
}
