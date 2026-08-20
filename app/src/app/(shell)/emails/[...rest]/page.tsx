import { EmailsLegacyRedirect } from "@/app/(shell)/emails/EmailsLegacyRedirect";

type Props = { params: Promise<{ rest: string[] }> };

export default async function Page({ params }: Props) {
  const { rest } = await params;
  return <EmailsLegacyRedirect rest={rest} />;
}

export function generateStaticParams() {
  return [
    { rest: ["inbox"] },
    { rest: ["drafts"] },
    { rest: ["sent"] },
    { rest: ["compose"] },
    { rest: ["trash"] },
    { rest: ["settings"] },
  ];
}
