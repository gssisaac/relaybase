"use client";

import { useCallback, useEffect, useState } from "react";

import {
  TriggerCanvas,
  type TriggerCanvasSelection,
} from "@/studio/components/triggers/TriggerCanvas";
import { TriggerPreviewDialog } from "@/studio/components/triggers/TriggerPreviewDialog";
import { TriggerConfigInspector } from "@/studio/pages/triggers/TriggerConfigInspector";
import {
  TriggerConfigUiProvider,
  useTriggerConfigUi,
  useTriggerConfigUiRequired,
} from "@/studio/pages/triggers/TriggerConfigUiContext";
import { TriggerLegacyConfigRedirect } from "@/studio/pages/triggers/TriggerLegacyConfigRedirect";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { studioApi } from "@/lib/studio/api";

function TriggerConfigViewBody() {
  const { triggerId, trigger } = useTriggerDetail();
  const { inspectorOpen, openInspector, closeInspector } = useTriggerConfigUiRequired();
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
    void studioApi.getMessageTemplate(messageTemplateId).then(
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

  const onCanvasBackgroundClick = useCallback(() => {
    if (selection !== null) {
      setSelection(null);
      return;
    }
    if (inspectorOpen) {
      closeInspector();
    }
  }, [closeInspector, inspectorOpen, selection]);

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
          onSelect={(node) => {
            setSelection(node);
            openInspector();
          }}
          onClearSelection={onCanvasBackgroundClick}
          onPreview={() => setPreviewOpen(true)}
        />
        <TriggerConfigInspector selection={selection} />
      </div>
      <TriggerPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  );
}

function TriggerConfigViewRoot() {
  const configUi = useTriggerConfigUi();
  if (configUi) return <TriggerConfigViewBody />;
  return (
    <TriggerConfigUiProvider>
      <TriggerConfigViewBody />
    </TriggerConfigUiProvider>
  );
}

export function TriggerConfigView() {
  return <TriggerConfigViewRoot />;
}
