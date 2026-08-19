import { NextResponse } from "next/server";

export function apiError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status });
}
