"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studioApi, type StudioMessage } from "@/lib/studio/api";

const NONE = "__none__";

export function MessagePicker({
  value,
  disabled,
  onApplied,
}: {
  value: string | null;
  disabled?: boolean;
  onApplied: (message: StudioMessage | null) => void;
}) {
  const [rows, setRows] = useState<StudioMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { messages } = await studioApi.listMessages();
      setRows(messages);
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
        const row = rows.find((m) => m.id === next);
        if (row) onApplied(row);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={loading ? "Loading messages…" : "Insert from saved message"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Custom content only</SelectItem>
        {rows.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
