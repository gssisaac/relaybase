import {
  UUID_V4_RE,
} from "../shared/constants";
import type { MacArch, TrackDirectDownloadBody } from "../shared/types";

export function parseTrackBody(raw: unknown): TrackDirectDownloadBody | null {
  if (!raw || typeof raw !== "object") return null;

  const body = raw as Record<string, unknown>;
  const clientId =
    typeof body.clientId === "string" ? body.clientId.trim().toLowerCase() : "";
  if (!clientId || !UUID_V4_RE.test(clientId)) return null;

  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim().slice(0, 80)
      : undefined;

  const archRaw = body.arch;
  const arch: MacArch | undefined =
    archRaw === "aarch64" || archRaw === "x86_64" ? archRaw : undefined;

  return { clientId, timezone, arch };
}
