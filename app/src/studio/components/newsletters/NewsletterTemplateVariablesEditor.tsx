"use client";

import { ImageIcon, Link2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  resolveTemplateVariableDefaults,
  type TemplateVariableField,
  type TemplateVariablesSchema,
} from "@/studio/lib/layouts/layout-template-variables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { studioApi } from "@/lib/studio/api";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/newsletter-upload";
import { examplePlaceholder } from "@/lib/ui/example-placeholder";
import { cn } from "@/lib/utils";

function ImageVariableField({
  field,
  value,
  editable,
  contentOwnerId,
  assetOwner,
  onChange,
}: {
  field: TemplateVariableField;
  value: string;
  editable: boolean;
  contentOwnerId: string;
  assetOwner: CrmContentAssetOwner;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const mode = value && !/^https?:\/\//i.test(value) ? "file" : "url";

  async function onFileSelected(file: File | null) {
    if (!file || !editable) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const contentBase64 = btoa(binary);
      const res =
        assetOwner === "message"
          ? await studioApi.uploadMessageAsset(contentOwnerId, {
              filename: file.name,
              mimeType: file.type,
              contentBase64,
            })
          : assetOwner === "trigger"
            ? await studioApi.uploadTriggerAsset(contentOwnerId, {
                filename: file.name,
                mimeType: file.type,
                contentBase64,
              })
            : await studioApi.uploadNewsletterAsset(contentOwnerId, {
                filename: file.name,
                mimeType: file.type,
                contentBase64,
              });
      onChange(res.url);
      toast.success("Logo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Tabs defaultValue={mode} className="gap-2">
        <TabsList variant="line" className="h-8 w-full">
          <TabsTrigger value="url" className="flex-1 gap-1 text-xs" disabled={!editable}>
            <Link2 className="size-3" />
            URL
          </TabsTrigger>
          <TabsTrigger value="file" className="flex-1 gap-1 text-xs" disabled={!editable}>
            <Upload className="size-3" />
            File
          </TabsTrigger>
        </TabsList>
        <TabsContent value="url" className="mt-0">
          <Input
            type="url"
            placeholder="https://…"
            value={/^https?:\/\//i.test(value) ? value : ""}
            disabled={!editable}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
          />
        </TabsContent>
        <TabsContent value="file" className="mt-0 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!editable || uploading}
            onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            disabled={!editable || uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImageIcon className="size-3.5" />
            {uploading ? "Uploading…" : value && !/^https?:\/\//i.test(value) ? "Replace image" : "Upload image"}
          </Button>
          {value ? (
            <p className="truncate text-[10px] text-muted-foreground" title={value}>
              {value}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function NewsletterTemplateVariablesEditor({
  newsletterId,
  assetOwner = "newsletter",
  schema,
  values,
  onChange,
  editable,
  complianceOrganizationName,
}: {
  newsletterId: string;
  assetOwner?: CrmContentAssetOwner;
  schema: TemplateVariablesSchema | null | undefined;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  editable: boolean;
  complianceOrganizationName?: string | null;
}) {
  if (!schema?.fields.length) {
    return (
      <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
        This template has no layout variables.
      </p>
    );
  }

  const resolved = resolveTemplateVariableDefaults({
    schema,
    values,
    complianceOrganizationName,
  });

  function setField(key: string, next: string) {
    onChange({ ...values, [key]: next });
  }

  return (
    <ul className="mb-4 flex flex-col gap-2">
      {schema.fields.map((field) => {
        const displayValue = values[field.key]?.trim()
          ? values[field.key]!
          : (resolved[field.key] ?? "");
        const missing = field.required && !displayValue.trim();
        return (
          <li
            key={field.key}
            className={cn(
              "rounded-md border bg-card p-2.5",
              missing ? "border-amber-500/50" : "border-border",
            )}
          >
            <Label className="text-xs font-medium">
              {field.label}
              {field.required ? <span className="text-destructive"> *</span> : null}
            </Label>
            {field.description ? (
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {field.description}
              </p>
            ) : null}
            <div className="mt-2">
              {field.type === "text" ? (
                <Input
                  value={values[field.key] ?? ""}
                  placeholder={
                    field.defaultFrom === "compliance.organizationName"
                      ? complianceOrganizationName?.trim() ||
                        examplePlaceholder("Organization name")
                      : undefined
                  }
                  disabled={!editable}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="h-8 text-xs"
                />
              ) : (
                <ImageVariableField
                  field={field}
                  value={values[field.key] ?? ""}
                  editable={editable}
                  contentOwnerId={newsletterId}
                  assetOwner={assetOwner}
                  onChange={(next) => setField(field.key, next)}
                />
              )}
            </div>
            <code className="mt-2 block text-[10px] text-muted-foreground">{`{{vars.${field.key}}}`}</code>
          </li>
        );
      })}
    </ul>
  );
}
