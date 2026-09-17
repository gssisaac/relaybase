export function isStudioSettingsPath(pathname: string): boolean {
  return pathname === "/studio/settings" || pathname.startsWith("/studio/settings/");
}
