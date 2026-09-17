"use client";

import { useMemo, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudioApiError, studioSubscriberApi } from "@/studio/api";
import {
  NONE_COLUMN,
  guessEmailColumnIndex,
  guessNameColumnIndex,
  mapCsvRowsToContacts,
  parseCsvText,
  selectValueFromColumnIndex,
  columnIndexFromSelectValue,
  type ParsedCsvTable,
} from "@/studio/lib/subscribers/parse-csv-contacts";

type Step = "choose-file" | "map-columns" | "done";

export function ImportSubscribersDialog({
  groupId,
  trigger,
  onImported,
}: {
  groupId: string;
  trigger: ReactElement;
  onImported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose-file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<ParsedCsvTable | null>(null);
  const [emailColumn, setEmailColumn] = useState<string>(NONE_COLUMN);
  const [nameColumn, setNameColumn] = useState<string>(NONE_COLUMN);
  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    imported: number;
    skippedDuplicate: number;
    skippedInvalid: number;
    failed: number;
  } | null>(null);

  const columnOptions = useMemo(() => {
    const headers = table?.headers ?? [];
    return headers.map((header, index) => ({
      value: String(index),
      label: header.trim() || `Column ${index + 1}`,
    }));
  }, [table]);

  const previewContacts = useMemo(() => {
    if (!table) return [];
    const emailIdx = columnIndexFromSelectValue(emailColumn);
    if (emailIdx === null) return [];
    const nameIdx = columnIndexFromSelectValue(nameColumn);
    return mapCsvRowsToContacts(table.rows, emailIdx, nameIdx).contacts.slice(0, 3);
  }, [table, emailColumn, nameColumn]);

  function resetState() {
    setStep("choose-file");
    setFileName(null);
    setTable(null);
    setEmailColumn(NONE_COLUMN);
    setNameColumn(NONE_COLUMN);
    setImporting(false);
    setResultSummary(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  async function loadFile(file: File) {
    const text = await file.text();
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("CSV has no data rows");
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setEmailColumn(selectValueFromColumnIndex(guessEmailColumnIndex(parsed.headers)));
    setNameColumn(selectValueFromColumnIndex(guessNameColumnIndex(parsed.headers)));
    setStep("map-columns");
  }

  async function runImport() {
    if (!table) return;
    const emailIdx = columnIndexFromSelectValue(emailColumn);
    if (emailIdx === null) {
      toast.error("Choose which column contains email addresses");
      return;
    }
    const nameIdx = columnIndexFromSelectValue(nameColumn);
    const { contacts, skippedInvalid } = mapCsvRowsToContacts(table.rows, emailIdx, nameIdx);
    if (contacts.length === 0) {
      toast.error("No valid email rows to import");
      return;
    }

    setImporting(true);
    let imported = 0;
    let skippedDuplicate = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        await studioSubscriberApi.addContact(groupId, contact);
        imported++;
      } catch (e) {
        if (e instanceof StudioApiError && e.status === 409) {
          skippedDuplicate++;
          continue;
        }
        failed++;
      }
    }

    setImporting(false);
    setResultSummary({
      imported,
      skippedDuplicate,
      skippedInvalid,
      failed,
    });
    setStep("done");
    onImported?.();

    if (failed === 0) {
      toast.success(`Imported ${imported.toLocaleString()} subscriber${imported === 1 ? "" : "s"}`);
    } else {
      toast.message("Import finished with errors", {
        description: `${imported} imported · ${failed} failed`,
      });
    }
  }

  const readyToImport =
    step === "map-columns" &&
    columnIndexFromSelectValue(emailColumn) !== null &&
    !importing &&
    (table?.rows.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import subscribers</DialogTitle>
          <DialogDescription>
            Upload a CSV file, map the email and name columns, then import into this group.
          </DialogDescription>
        </DialogHeader>

        {step === "choose-file" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="subscriber-csv-file">CSV file</Label>
              <Input
                id="subscriber-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              First row should be column headers. Only email is required; name is optional.
            </p>
          </div>
        ) : null}

        {step === "map-columns" && table ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {fileName ? (
                <>
                  <span className="font-medium text-foreground">{fileName}</span>
                  {" · "}
                </>
              ) : null}
              {table.rows.length.toLocaleString()} row{table.rows.length === 1 ? "" : "s"}
            </p>

            <div className="space-y-2">
              <Label>Email column</Label>
              <Select
                value={emailColumn}
                onValueChange={(val) => {
                  if (val) setEmailColumn(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Name column (optional)</Label>
              <Select
                value={nameColumn}
                onValueChange={(val) => {
                  if (val) setNameColumn(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_COLUMN}>None</SelectItem>
                  {columnOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {previewContacts.length > 0 ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <p className="mb-1 font-medium text-foreground">Preview</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {previewContacts.map((c) => (
                    <li key={c.email} className="truncate">
                      {c.name ? `${c.name} · ${c.email}` : c.email}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "done" && resultSummary ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{resultSummary.imported.toLocaleString()}</span> imported
            </p>
            {resultSummary.skippedDuplicate > 0 ? (
              <p className="text-muted-foreground">
                {resultSummary.skippedDuplicate.toLocaleString()} already in group (skipped)
              </p>
            ) : null}
            {resultSummary.skippedInvalid > 0 ? (
              <p className="text-muted-foreground">
                {resultSummary.skippedInvalid.toLocaleString()} invalid or duplicate in file (skipped)
              </p>
            ) : null}
            {resultSummary.failed > 0 ? (
              <p className="text-destructive">
                {resultSummary.failed.toLocaleString()} could not be imported
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "map-columns" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => {
                  resetState();
                }}
              >
                Choose another file
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!readyToImport}
                onClick={() => void runImport()}
              >
                {importing ? "Importing…" : "Import"}
              </Button>
            </>
          ) : step === "done" ? (
            <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
