"use client";

import { Settings, type LucideIcon } from "lucide-react";
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
import { useOpenSettings } from "@/lib/navigation/open-settings";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import type { EmailCommandGroup } from "@/email/commands/email-command-defs";
import { useEmailCommandRuntime } from "@/email/commands/EmailCommandRuntimeContext";

const GROUP_ORDER: EmailCommandGroup[] = ["navigation", "actions", "copy"];

const GROUP_HEADING: Record<EmailCommandGroup, string> = {
  navigation: "Navigate",
  actions: "Actions",
  copy: "Copy",
};

/**
 * App-level commands (NOT part of the mail command registry). The mail
 * registry (`email-command-defs.ts`) stays mail-action only; these are global
 * navigation shortcuts shown in a separate "App" group above the mail groups.
 */
type AppCommand = {
  id: string;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
};

export function GlobalCommandPalette() {
  const { scope, paletteOpen, setPaletteOpen } = useEmailCommandRuntime();
  const openSettings = useOpenSettings();
  const { isMacOS } = useDesktopChrome();

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

  const appCommands = useMemo<AppCommand[]>(
    () => [
      {
        id: "go-to-settings",
        label: "Go to settings",
        keywords: ["settings", "preferences", "config", "configure"],
        icon: Settings,
        shortcut: isMacOS ? "⌘," : "Ctrl+,",
        run: openSettings,
      },
    ],
    [openSettings, isMacOS],
  );

  const groups = useMemo(() => {
    const commands = scope?.commands ?? [];
    return GROUP_ORDER.map((group) => ({
      group,
      heading: GROUP_HEADING[group],
      commands: commands.filter((command) => command.group === group),
    })).filter((entry) => entry.commands.length > 0);
  }, [scope?.commands]);

  const hasMailCommands = groups.length > 0;

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>
          {scope
            ? "No commands for this selection."
            : "Open a mailbox to run commands."}
        </CommandEmpty>
        <CommandGroup heading="App">
          {appCommands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                value={`${command.label} ${command.keywords.join(" ")} ${command.shortcut ?? ""}`}
                onSelect={() => {
                  setPaletteOpen(false);
                  command.run();
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
        {hasMailCommands ? (
          <>
            <CommandSeparator />
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
          </>
        ) : null}
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
