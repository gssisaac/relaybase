export type ParsedCsvTable = {
  headers: string[];
  rows: string[][];
};

const NONE_COLUMN = "__none__";

export { NONE_COLUMN };

export function parseCsvText(text: string): ParsedCsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));
  return { headers, rows: dataRows };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s-]+/g, " ");
}

export function guessCsvColumnIndex(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(candidate);
    if (exact >= 0) return exact;
  }
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]!;
    for (const candidate of candidates) {
      if (h.includes(candidate)) return i;
    }
  }
  return null;
}

export function guessEmailColumnIndex(headers: string[]): number | null {
  return guessCsvColumnIndex(headers, ["email", "e mail", "email address", "mail"]);
}

export function guessNameColumnIndex(headers: string[]): number | null {
  return guessCsvColumnIndex(headers, ["name", "full name", "display name", "first name"]);
}

export function columnIndexFromSelectValue(value: string): number | null {
  if (!value || value === NONE_COLUMN) return null;
  const idx = Number.parseInt(value, 10);
  return Number.isFinite(idx) ? idx : null;
}

export function selectValueFromColumnIndex(index: number | null): string {
  if (index === null || index < 0) return NONE_COLUMN;
  return String(index);
}

export type CsvContactDraft = { email: string; name?: string };

export function mapCsvRowsToContacts(
  rows: string[][],
  emailColumnIndex: number,
  nameColumnIndex: number | null,
): { contacts: CsvContactDraft[]; skippedInvalid: number } {
  const contacts: CsvContactDraft[] = [];
  const seen = new Set<string>();
  let skippedInvalid = 0;

  for (const row of rows) {
    const rawEmail = row[emailColumnIndex]?.trim().toLowerCase() ?? "";
    if (!rawEmail.includes("@")) {
      skippedInvalid++;
      continue;
    }
    if (seen.has(rawEmail)) {
      skippedInvalid++;
      continue;
    }
    seen.add(rawEmail);
    const rawName =
      nameColumnIndex === null ? "" : (row[nameColumnIndex]?.trim() ?? "");
    contacts.push(rawName ? { email: rawEmail, name: rawName } : { email: rawEmail });
  }

  return { contacts, skippedInvalid };
}
