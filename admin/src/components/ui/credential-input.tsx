"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function CredentialInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        autoComplete="off"
        className={cn("pr-8", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide credential" : "Show credential"}
      >
        <i
          className={`ti ${visible ? "ti-eye-off" : "ti-eye"} text-sm`}
          aria-hidden
        />
      </button>
    </div>
  );
}

export { CredentialInput };
