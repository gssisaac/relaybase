"use client";

import { useEffect, useState } from "react";

import {
  TriggerCanvas,
  type TriggerCanvasSelection,
} from "@/scale/components/triggers/TriggerCanvas";
import { TriggerPreviewDialog } from "@/scale/components/triggers/TriggerPreviewDialog";
import { TriggerConfigInspector } from "@/scale/pages/triggers/TriggerConfigInspector";
import { TriggerLegacyConfigRedirect } from "@/scale/pages/triggers/TriggerLegacyConfigRedirect";
import { useTriggerDetail } from "@/scale/pages/triggers/TriggerDetailContext";
import { scaleApi } from "@/lib/scale/api";

export function TriggerConfigView() {
  const { triggerId, trigger } = useTriggerDetail();
  const [selection, setSelection] = useState<TriggerCanvasSelection>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);

  useEffect(() => {
    setSelection(null);
  }, [triggerId]);

  useEffect(() => {
    const messageTemplateId = trigger?.messageTemplateId;
    if (!messageTemplateId) {
      setTemplateName(null);
      return;
    }
    let cancelled = false;
    void scaleApi.getMessageTemplate(messageTemplateId).then(
      (res) => {
        if (!cancelled) setTemplateName(res.template.name);
      },
      () => {
        if (!cancelled) setTemplateName(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [trigger?.messageTemplateId]);

  if (!trigger) return null;

  return (
    <>
      <TriggerLegacyConfigRedirect />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <TriggerCanvas
          triggerId={triggerId}
          trigger={trigger}
          templateName={templateName}
          selected={selection}
          onSelect={setSelection}
          onClearSelection={() => setSelection(null)}
          onPreview={() => setPreviewOpen(true)}
        />
        <TriggerConfigInspector selection={selection} />
      </div>
      <TriggerPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  );
}
