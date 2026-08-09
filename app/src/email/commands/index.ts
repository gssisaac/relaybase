export {
  EMAIL_COMMAND_DEFS,
  getEmailCommandDef,
  type EmailCommandDef,
  type EmailCommandFolder,
  type EmailCommandGroup,
  type EmailCommandId,
  type EmailCommandRequires,
  type EmailCommandTargetKind,
} from "@/email/commands/email-command-defs";

export {
  resolveEmailCommands,
  runEmailCommand,
  type EmailCommandDescriptor,
  type EmailCommandRuntime,
  type ResolvedEmailCommand,
} from "@/email/commands/email-command-store";

export {
  EmailCommandRuntimeProvider,
  useEmailCommandRuntime,
  type EmailCommandRuntimeScope,
} from "@/email/commands/EmailCommandRuntimeContext";

export {
  useEmailCommandRuntimeAdapter,
  type UseEmailCommandRuntimeAdapterInput,
  type UseEmailCommandRuntimeAdapterResult,
} from "@/email/commands/useEmailCommandRuntimeAdapter";

export { EmailCommandContextMenu } from "@/email/commands/EmailCommandContextMenu";

export { GlobalCommandPalette } from "@/email/commands/GlobalCommandPalette";
