"use client";

import { Fragment, useEffect, useMemo } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandFooterItem,
  CommandFooterKey,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { EmailCommandGroup } from "@/email/commands/email-command-defs";
import { useEmailCommandRuntime } from "@/email/commands/EmailCommandRuntimeContext";

const GROUP_ORDER: EmailCommandGroup[] = ["navigation", "actions", "copy"];

const GROUP_HEADING: Record<EmailCommandGroup, string> = {
  navigation: "Navigate",
  actions: "Actions",
  copy: "Copy",
};

export function GlobalCommandPalette() {
  const { scope, paletteOpen, setPaletteOpen } = useEmailCommandRuntime();

  // App keyboard layer (capture): ⌘K / Ctrl+K must win over mail-layer `k`.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPaletteOpen((open) => !open);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [setPaletteOpen]);

  const groups = useMemo(() => {
    const commands = scope?.commands ?? [];
    return GROUP_ORDER.map((group) => ({
      group,
      heading: GROUP_HEADING[group],
      commands: commands.filter((command) => command.group === group),
    })).filter((entry) => entry.commands.length > 0);
  }, [scope?.commands]);

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>
          {scope
            ? "No commands for this selection."
            : "Open a mailbox to run commands."}
        </CommandEmpty>
        {groups.map((entry, index) => (
          <Fragment key={entry.group}>
            {index > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={entry.heading}>
              {entry.commands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    value={`${command.label} ${command.keywords.join(" ")} ${command.shortcut ?? ""}`}
                    onSelect={() => {
                      setPaletteOpen(false);
                      void command.run();
                    }}
                  >
                    <Icon />
                    <span>{command.label}</span>
                    {command.shortcut ? (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Fragment>
        ))}
      </CommandList>
      <CommandFooter>
        <CommandFooterItem
          keys={
            <>
              <CommandFooterKey>↑</CommandFooterKey>
              <CommandFooterKey>↓</CommandFooterKey>
            </>
          }
          label="Select"
        />
        <CommandFooterItem
          keys={<CommandFooterKey>⏎</CommandFooterKey>}
          label="Open"
        />
        <CommandFooterItem
          keys={<CommandFooterKey>esc</CommandFooterKey>}
          label="Close"
        />
      </CommandFooter>
    </CommandDialog>
  );
}
