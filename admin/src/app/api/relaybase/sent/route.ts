import { NextResponse } from "next/server";

import { listEmailSenderSentEmails } from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

export async function GET() {
  try {
    return NextResponse.json({ sent: listEmailSenderSentEmails() });
  } catch (error) {
    return apiError(error);
  }
}
