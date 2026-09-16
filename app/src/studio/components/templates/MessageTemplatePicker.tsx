"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studioApi, type MessageTemplate } from "@/lib/studio/api";

const NONE = "__none__";

export function MessageTemplatePicker({
  value,
  disabled,
  onApplied,
}: {
  value: string | null;
  disabled?: boolean;
  onApplied: (template: MessageTemplate | null) => void;
}) {
  const [rows, setRows] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { templates } = await studioApi.listMessageTemplates();
      setRows(templates);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled || loading}
      onValueChange={(next) => {
        if (next === NONE) {
          onApplied(null);
          return;
        }
        const row = rows.find((t) => t.id === next);
        if (row) onApplied(row);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={loading ? "Loading templates…" : "Link message template"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Custom content (no template)</SelectItem>
        {rows.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
