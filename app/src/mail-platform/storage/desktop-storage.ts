/**
 * Desktop storage — delegates to the existing Tauri bridge
 * (`desktopGetMailJson`, `desktopSaveMailBinary`, …).
 *
 * Console mode (desktop app) uses `~/.relaybase/mail/` as the durable
 * store. This adapter wraps the bridge calls so email UI code can stay
 * platform-agnostic.
 */
import {
  desktopGetMailJson,
  desktopSaveMailJson,
  desktopGetMailBinary,
  desktopSaveMailBinary,
  desktopDeleteMailBinary,
  desktopDeleteMailBinaryDir,
} from "@/lib/desktop/bridge";
import type { MailStorage } from "../types";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const CHUNK = 0x8000;
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += CHUNK) {
    const slice = view.subarray(i, Math.min(i + CHUNK, view.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function createDesktopStorage(): MailStorage {
  return {
    async readJson(relativePath: string): Promise<unknown | null> {
      try {
        return await desktopGetMailJson(relativePath);
      } catch {
        return null;
      }
    },

    async writeJson(relativePath: string, value: unknown): Promise<void> {
      await desktopSaveMailJson(relativePath, value);
    },

    async readBinary(relativePath: string): Promise<ArrayBuffer | null> {
      const base64 = await desktopGetMailBinary(relativePath);
      if (!base64) return null;
      return base64ToArrayBuffer(base64);
    },

    async writeBinary(relativePath: string, value: ArrayBuffer): Promise<void> {
      await desktopSaveMailBinary(relativePath, arrayBufferToBase64(value));
    },

    async deleteBinary(relativePath: string): Promise<void> {
      await desktopDeleteMailBinary(relativePath);
    },

    async deleteBinaryDir(relativePath: string): Promise<void> {
      await desktopDeleteMailBinaryDir(relativePath);
    },
  };
}
