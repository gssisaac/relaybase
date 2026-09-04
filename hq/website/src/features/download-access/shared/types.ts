export type InviteSource = "email" | "direct";

export type MacArch = "aarch64" | "x86_64";

export type DownloadButtonLocation =
  | "header"
  | "hero"
  | "footer"
  | "beta-page";

export type TrackDirectDownloadBody = {
  clientId: string;
  timezone?: string;
  arch?: MacArch;
};
