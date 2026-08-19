import { RELAYBASE_DEFAULT_TAB } from "@/relaybase/components/constants";
import { EmailSenderPanelView } from "@/relaybase/panel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path: string[] }> };

export default async function Page({ params }: Props) {
  const { path } = await params;
  return <EmailSenderPanelView subPath={path} />;
}
