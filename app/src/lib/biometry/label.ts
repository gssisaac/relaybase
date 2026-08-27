import type { BiometryType } from "./types";

export function biometryLabel(type: BiometryType, platform?: string): string {
  if (type === 2) return "Touch ID";
  if (type === 3) return "Face ID";
  if (type === 4) return "Iris";
  if (type === 1 || platform === "windows") return "Windows Hello";
  if (platform === "macos") return "Touch ID";
  return "device password";
}
