import { NextRequest, NextResponse } from "next/server";

import { MAX_FEEDBACK_IMAGE_BYTES } from "@/lib/feedback/feedback-limits";
import { putFeedbackImageInR2 } from "@/lib/feedback/store-feedback-r2";

function isImageContentType(type: string): boolean {
  return type.startsWith("image/");
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const feedbackId = String(form.get("feedbackId") ?? "").trim();
  const attachmentId = String(form.get("attachmentId") ?? "").trim();
  const file = form.get("file");

  if (!feedbackId || !attachmentId || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing upload fields" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!isImageContentType(contentType)) {
    return NextResponse.json({ error: "Images only" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FEEDBACK_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 400 });
  }

  const filename =
    file instanceof File && file.name.trim()
      ? file.name.trim().slice(0, 120)
      : "screenshot.png";

  const bytes = await file.arrayBuffer();
  const createdAt = new Date().toISOString();

  const result = await putFeedbackImageInR2({
    feedbackId,
    attachmentId,
    filename,
    contentType,
    bytes,
    createdAt,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    key: result.key,
    filename,
    contentType,
    size: bytes.byteLength,
  });
}
