"use client";

import { Fragment, type ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  resolveEmailCommands,
  type EmailCommandRuntime,
} from "@/email/commands/email-command-store";

export function EmailCommandContextMenu({
  runtime,
  children,
}: {
  runtime: EmailCommandRuntime;
  children: ReactNode;
}) {
  const commands = resolveEmailCommands(runtime);
  const groups = [
    commands.filter((c) => c.group === "navigation"),
    commands.filter((c) => c.group === "actions"),
    commands.filter((c) => c.group === "copy"),
  ].filter((group) => group.length > 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {groups.map((group, groupIndex) => (
          <Fragment key={group[0]?.group ?? groupIndex}>
            {groupIndex > 0 ? <ContextMenuSeparator /> : null}
            {group.map((command) => {
              const Icon = command.icon;
              return (
                <ContextMenuItem
                  key={command.id}
                  onClick={() => void command.run()}
                >
                  <Icon className="size-4" />
                  {command.label}
                  {command.shortcut ? (
                    <ContextMenuShortcut>{command.shortcut}</ContextMenuShortcut>
                  ) : null}
                </ContextMenuItem>
              );
            })}
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
