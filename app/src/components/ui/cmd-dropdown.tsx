"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type CmdDropdownOption<Value extends string = string> = {
  value: Value
  label: string
  disabled?: boolean
  icon?: React.ReactNode
  /** Extra strings matched by search (in addition to label). */
  keywords?: string
  onClick?: (event: React.MouseEvent) => void
}

export type CmdDropdownOptionGroup<Value extends string = string> = {
  heading: string
  options: CmdDropdownOption<Value>[]
}

export type CmdDropdownTriggerRenderProps = {
  openPopover: (event: React.MouseEvent) => void
  selectedOptions: CmdDropdownOption[]
  disabled?: boolean
}

type CmdDropdownBaseProps<Value extends string = string> = {
  /** Flat list — use for single-section pickers (e.g. domains). */
  options?: CmdDropdownOption<Value>[]
  /** Grouped list — use when options belong under headings (e.g. accounts by domain). */
  groups?: CmdDropdownOptionGroup<Value>[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  required?: boolean
  enableSearch?: boolean
  className?: string
  triggerId?: string
  triggerClassName?: string
  contentClassName?: string
  contentAlign?: "start" | "center" | "end"
  emptyMessage?: string
  clearLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: (props: CmdDropdownTriggerRenderProps) => React.ReactNode
}

export type CmdDropdownProps<Value extends string = string> =
  CmdDropdownBaseProps<Value> &
    (
      | {
          multiple?: false
          value?: Value | null
          onValueChange?: (value: Value | undefined) => void
        }
      | {
          multiple: true
          value?: Value[]
          onValueChange?: (value: Value[]) => void
        }
    )

function optionFilterKeywords(option: CmdDropdownOption): string[] {
  return [option.label, option.keywords]
    .filter(Boolean)
    .flatMap((part) => part.trim().split(/\s+/))
    .filter(Boolean)
}

/** Substring match — cmdk's default fuzzy filter matches unrelated labels (e.g. "reading" → "reola"). */
function cmdDropdownSearchFilter(
  value: string,
  search: string,
  keywords?: string[],
): number {
  const query = search.trim().toLowerCase()
  if (!query) return 1

  const haystacks = [value, ...(keywords ?? [])]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  const tokens = query.split(/\s+/).filter(Boolean)

  for (const haystack of haystacks) {
    if (tokens.every((token) => haystack.includes(token))) {
      return haystack.includes(query) ? 1 : 0.85
    }
  }
  return 0
}

function CmdDropdown<Value extends string = string>({
  options,
  groups,
  placeholder = "Select an option",
  searchPlaceholder,
  disabled = false,
  required = false,
  enableSearch = true,
  className,
  triggerId,
  triggerClassName,
  contentClassName,
  contentAlign = "start",
  emptyMessage = "No results found.",
  clearLabel = "Clear selection",
  open: openProp,
  onOpenChange,
  children,
  ...selectionProps
}: CmdDropdownProps<Value>) {
  const multiple = selectionProps.multiple === true
  const flatOptions = React.useMemo(() => {
    if (groups?.length) {
      return groups.flatMap((group) => group.options)
    }
    return options ?? []
  }, [groups, options])

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(next)
      }
      onOpenChange?.(next)
    },
    [onOpenChange, openProp],
  )

  const selectedValues = React.useMemo(() => {
    if (multiple) {
      return new Set(selectionProps.value ?? [])
    }
    const single = selectionProps.value
    return single != null && single !== "" ? new Set([single]) : new Set<Value>()
  }, [multiple, selectionProps.value])

  const selectedOptions = React.useMemo(
    () => flatOptions.filter((option) => selectedValues.has(option.value)),
    [flatOptions, selectedValues],
  )

  const renderOption = (option: CmdDropdownOption<Value>) => {
    const isSelected = selectedValues.has(option.value)
    return (
      <CommandItem
        key={option.value}
        value={option.value}
        keywords={optionFilterKeywords(option)}
        disabled={option.disabled}
        data-checked={isSelected ? true : undefined}
        className={cn(
          multiple && "[&>svg.ml-auto]:hidden",
          !multiple && "justify-between",
        )}
        onClick={(event) => {
          option.onClick?.(event)
        }}
        onSelect={() => {
          if (option.disabled) return
          if (option.onClick) return
          toggleOption(option.value)
          if (!multiple) {
            setOpen(false)
          }
        }}
      >
        {multiple ? (
          <span
            className={cn(
              "mr-2 flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "opacity-50",
            )}
            aria-hidden
          >
            {isSelected ? <CheckIcon className="size-3.5" /> : null}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {option.icon ? (
            <span className="inline-flex shrink-0 text-muted-foreground [&>svg]:size-4">
              {option.icon}
            </span>
          ) : null}
          <span className="truncate">{option.label}</span>
        </span>
      </CommandItem>
    )
  }

  const emitChange = React.useCallback(
    (next: Set<Value>) => {
      if (multiple) {
        selectionProps.onValueChange?.([...next])
        return
      }
      const first = next.values().next().value as Value | undefined
      selectionProps.onValueChange?.(first)
    },
    [multiple, selectionProps],
  )

  const toggleOption = React.useCallback(
    (value: Value) => {
      const next = new Set(selectedValues)
      if (multiple) {
        if (next.has(value)) {
          next.delete(value)
        } else {
          next.add(value)
        }
      } else {
        next.clear()
        next.add(value)
      }
      emitChange(next)
    },
    [emitChange, multiple, selectedValues],
  )

  const clearAll = React.useCallback(() => {
    emitChange(new Set())
  }, [emitChange])

  const openFromEvent = React.useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return
      event.preventDefault()
      setOpen(true)
    },
    [disabled, setOpen],
  )

  const triggerLabel =
    selectedOptions.length === 0 ? (
      <>
        <span className="truncate text-muted-foreground">{placeholder}</span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </>
    ) : multiple ? (
      <>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selectedOptions.length > 4 ? (
            <Badge variant="secondary">{selectedOptions.length} selected</Badge>
          ) : (
            selectedOptions.map((option) => (
              <Badge key={option.value} variant="secondary" className="max-w-[9rem] truncate">
                {option.icon ? (
                  <span className="mr-1 inline-flex shrink-0 [&>svg]:size-3.5">{option.icon}</span>
                ) : null}
                {option.label}
              </Badge>
            ))
          )}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </>
    ) : (
      <>
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {selectedOptions[0]?.icon ? (
            <span className="inline-flex shrink-0 text-muted-foreground [&>svg]:size-4">
              {selectedOptions[0].icon}
            </span>
          ) : null}
          <span className="truncate">{selectedOptions[0]?.label}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </>
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("min-w-0", className)}>
        {children ? (
          <PopoverTrigger
            disabled={disabled}
            render={
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                id={triggerId}
                className={cn(
                  "h-8 w-full min-w-[12rem] justify-between gap-2 font-normal",
                  triggerClassName,
                )}
              />
            }
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
              {children({
                openPopover: openFromEvent,
                selectedOptions,
                disabled,
              })}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
        ) : (
          <PopoverTrigger
            disabled={disabled}
            render={
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                id={triggerId}
                className={cn(
                  "h-8 w-full min-w-[12rem] justify-between gap-2 font-normal",
                  triggerClassName,
                )}
              />
            }
          >
            {triggerLabel}
          </PopoverTrigger>
        )}
      </div>
      <PopoverContent
        align={contentAlign}
        className={cn(
          "w-(--anchor-width) min-w-[var(--anchor-width)] max-w-[min(24rem,calc(100vw-2rem))] gap-0 p-0.5",
          contentClassName,
        )}
      >
        <Command
          shouldFilter={enableSearch}
          filter={cmdDropdownSearchFilter}
          className={cn(
            "gap-0 p-0",
            "[&_[data-slot=command-input-wrapper]]:m-0.5 [&_[data-slot=command-input-wrapper]]:p-0",
            "[&_[data-slot=input-group]]:h-8! [&_[data-slot=input-group]]:rounded-lg! [&_[data-slot=input-group]]:border-border/80! [&_[data-slot=input-group]]:bg-card! [&_[data-slot=input-group]]:shadow-[0_1px_1px_0_rgba(0,0,0,0.02)]! [&_[data-slot=input-group]]:transition-all dark:[&_[data-slot=input-group]]:border-border/60! dark:[&_[data-slot=input-group]]:bg-input/10!",
            "[&_[data-slot=input-group]:focus-within]:border-primary! [&_[data-slot=input-group]:focus-within]:ring-2! [&_[data-slot=input-group]:focus-within]:ring-primary/10!",
            "[&_[data-slot=command-group]]:p-0 [&_[data-slot=command-group]]:**:[[cmdk-group-heading]]:px-1.5 [&_[data-slot=command-group]]:**:[[cmdk-group-heading]]:py-1 [&_[data-slot=command-group]]:**:[[cmdk-group-items]]:pl-0.5",
            "[&_[data-slot=command-item]]:gap-1.5 [&_[data-slot=command-item]]:px-1.5 [&_[data-slot=command-item]]:py-1",
          )}
        >
          {enableSearch ? (
            <CommandInput
              placeholder={searchPlaceholder ?? placeholder ?? "Search…"}
            />
          ) : null}
          <CommandList className="max-h-60 scroll-py-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groups?.length ? (
              groups.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.options.map((option) => renderOption(option))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {flatOptions.map((option) => renderOption(option))}
              </CommandGroup>
            )}
          </CommandList>
          {!required && selectedOptions.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    clearAll()
                    if (!multiple) {
                      setOpen(false)
                    }
                  }}
                  className="justify-center px-1.5 py-1 text-center text-xs text-muted-foreground"
                >
                  {clearLabel}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { CmdDropdown }
