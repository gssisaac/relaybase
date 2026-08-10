"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
};

/**
 * Renders a QR code as an inline SVG. Used by the desktop Other device tab
 * to pair the Flutter app via a `relaybase://connect?...` deep link.
 */
export function QrCode({ value, size = 192, className }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
    })
      .then((result) => {
        if (!cancelled) {
          setSvg(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render QR");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (error) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        role="img"
        aria-label="QR code error"
      >
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-block" }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
