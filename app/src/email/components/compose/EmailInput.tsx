"use client";

import * as React from "react";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ComposeContact } from "@/email/lib/compose/compose-contacts";
import {
  filterComposeContactSuggestions,
  formatComposeContactLabel,
} from "@/email/lib/compose/compose-contacts";
import {
  formatRecipientTokens,
  isValidRecipientToken,
  tokenizeRecipientInput,
  tokenizeRecipientValue,
} from "@/lib/email/parse-recipients";

export type EmailInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  suggestions?: ComposeContact[];
  onContactUsed?: (entries: { email: string; displayName?: string }[]) => void;
  className?: string;
};

function looksCompleteRecipientToken(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (isValidRecipientToken(trimmed)) return true;
  return /^.+<[^>\s]+@[^>\s]+>$/.test(trimmed);
}

function entriesFromTokens(tokens: string[]) {
  return tokens
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return null;
      if (isValidRecipientToken(trimmed)) {
        const match = trimmed.match(/^(.*?)\s*<([^>]+@[^>]+)>\s*$/);
        if (match) {
          const name = match[1]!.trim().replace(/^["']|["']$/g, "");
          return {
            email: match[2]!,
            displayName: name || undefined,
          };
        }
        return { email: trimmed };
      }
      return null;
    })
    .filter((entry): entry is { email: string; displayName?: string } =>
      Boolean(entry),
    );
}

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  function EmailInput(
    {
      value,
      onChange,
      placeholder,
      autoFocus = false,
      suggestions = [],
      onContactUsed,
      className,
    },
    ref,
  ) {
    const [inputValue, setInputValue] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const innerInputRef = React.useRef<HTMLInputElement>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);

    React.useImperativeHandle(ref, () => innerInputRef.current as HTMLInputElement);

    const tokens = React.useMemo(() => tokenizeRecipientValue(value), [value]);
    const committedEmails = React.useMemo(
      () =>
        tokens
          .map((token) => {
            const match = token.match(/<([^>]+@[^>]+)>/);
            return (match?.[1] ?? token).trim().toLowerCase();
          })
          .filter(Boolean),
      [tokens],
    );

    const filteredSuggestions = React.useMemo(
      () =>
        filterComposeContactSuggestions(
          suggestions,
          inputValue,
          committedEmails,
        ).slice(0, 8),
      [committedEmails, inputValue, suggestions],
    );

    React.useEffect(() => {
      if (!autoFocus) return;
      innerInputRef.current?.focus({ preventScroll: true });
    }, [autoFocus]);

    React.useEffect(() => {
      setActiveIndex(0);
    }, [inputValue, filteredSuggestions.length]);

    React.useEffect(() => {
      setOpen(Boolean(inputValue.trim()) && filteredSuggestions.length > 0);
    }, [filteredSuggestions.length, inputValue]);

    const commitTokens = React.useCallback(
      (nextTokens: string[]) => {
        onChange(formatRecipientTokens(nextTokens));
      },
      [onChange],
    );

    const commitInput = React.useCallback(
      (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        const next = [...tokens, trimmed];
        commitTokens(next);
        setInputValue("");
        setOpen(false);
        const entries = entriesFromTokens([trimmed]);
        if (entries.length > 0) onContactUsed?.(entries);
      },
      [commitTokens, onContactUsed, tokens],
    );

    const commitMany = React.useCallback(
      (parts: string[]) => {
        const nextParts = parts.map((part) => part.trim()).filter(Boolean);
        if (!nextParts.length) return;
        const next = [...tokens, ...nextParts];
        commitTokens(next);
        setInputValue("");
        setOpen(false);
        const entries = entriesFromTokens(nextParts);
        if (entries.length > 0) onContactUsed?.(entries);
      },
      [commitTokens, onContactUsed, tokens],
    );

    const removeToken = React.useCallback(
      (index: number) => {
        commitTokens(tokens.filter((_, i) => i !== index));
      },
      [commitTokens, tokens],
    );

    const pickSuggestion = React.useCallback(
      (contact: ComposeContact) => {
        const label = formatComposeContactLabel(contact);
        const next = [...tokens, label];
        commitTokens(next);
        setInputValue("");
        setOpen(false);
        onContactUsed?.([
          { email: contact.email, displayName: contact.displayName },
        ]);
        innerInputRef.current?.focus();
      },
      [commitTokens, onContactUsed, tokens],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (/[,;\n]/.test(next)) {
        const parts = tokenizeRecipientInput(next);
        const trailing = next.endsWith(",") || next.endsWith(";") || next.endsWith("\n");
        if (parts.length > 1 || trailing) {
          commitMany(parts);
          return;
        }
      }
      setInputValue(next);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (open && filteredSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filteredSuggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex(
            (i) => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length,
          );
          return;
        }
        if (e.key === "Enter" && inputValue.trim()) {
          e.preventDefault();
          pickSuggestion(filteredSuggestions[activeIndex]!);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && inputValue.trim()) {
        e.preventDefault();
        commitInput(inputValue);
        return;
      }

      if (e.key === "," || e.key === ";") {
        e.preventDefault();
        commitInput(inputValue);
        return;
      }

      if (e.key === " " && looksCompleteRecipientToken(inputValue)) {
        e.preventDefault();
        commitInput(inputValue);
        return;
      }

      if (e.key === "Backspace" && !inputValue && tokens.length > 0) {
        removeToken(tokens.length - 1);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text || !/[,;\n]/.test(text)) return;
      e.preventDefault();
      commitMany(tokenizeRecipientInput(text));
    };

    const handleBlur = (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && rootRef.current?.contains(next)) return;
      if (inputValue.trim()) commitInput(inputValue);
      setOpen(false);
    };

    return (
      <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1.5"
          onClick={() => innerInputRef.current?.focus()}
        >
          {tokens.map((token, index) => (
            <Badge
              key={`${token}-${index}`}
              variant={isValidRecipientToken(token) ? "secondary" : "destructive"}
              className="h-6 max-w-full gap-1 pr-1 pl-2"
            >
              <span className="truncate">{token}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${token}`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeToken(index);
                }}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <input
            ref={innerInputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
            placeholder={tokens.length === 0 ? placeholder : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="email"
            data-1p-ignore
            data-lpignore="true"
            className="min-w-32 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />
        </div>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border/60 bg-popover shadow-md">
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredSuggestions.map((contact, index) => (
                <li key={contact.email}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted",
                      index === activeIndex && "bg-muted",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickSuggestion(contact)}
                  >
                    <span className="truncate">
                      {formatComposeContactLabel(contact)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  },
);

EmailInput.displayName = "EmailInput";
