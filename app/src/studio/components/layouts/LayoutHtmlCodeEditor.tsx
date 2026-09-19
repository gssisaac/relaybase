"use client";

import "@uiw/react-textarea-code-editor/dist.css";
import "./layout-html-code-editor.css";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[min(480px,55vh)] flex-1 animate-pulse rounded-md border border-input bg-muted/30"
        aria-hidden
      />
    ),
  },
);

export function LayoutHtmlCodeEditor({
  value,
  onChange,
  className,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
}) {
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div
      className={cn(
        "layout-html-code-editor-shell min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-input bg-background",
        className,
      )}
      onWheel={(event) => {
        event.currentTarget.scrollTop += event.deltaY;
        event.preventDefault();
      }}
    >
      <CodeEditor
        id={id}
        value={value}
        language="html"
        data-color-mode={colorMode}
        aria-label="HTML source"
        padding={12}
        minHeight={480}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="layout-html-code-editor w-full font-mono text-xs leading-relaxed"
        style={{
          fontSize: 12,
          overflow: "visible",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
        }}
      />
    </div>
  );
}
