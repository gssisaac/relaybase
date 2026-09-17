"use client";

import {
  SuggestionMenuController,
  TableHandlesController,
  useCreateBlockNote,
  type FloatingUIOptions,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { autoPlacement, offset, shift, size } from "@floating-ui/react";
import { useTheme } from "next-themes";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { TableHandleWithIcons } from "@/lib/markdown-editor/components/TableHandleMenu";
import { getNewsletterEditorSlashMenuItems } from "@/lib/markdown-editor/components/newsletter-slash-menu-items";
import { newsletterEditorSchema, type NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";
import type { EditorSnapshotProvider } from "@/lib/markdown-editor/persistence/types";
import { fingerprintEditorDocument, markdownFlushStrategy } from "@/lib/markdown-editor/utils/flush";
import {
  collectTransferFiles,
  getClipboardImageFile,
  transferHasFiles,
} from "@/lib/markdown-editor/utils/image-optimize";
import { DEFAULT_IMAGE_OPTIMIZATION_SETTINGS } from "@/lib/markdown-editor/utils/image-settings";
import {
  ingestNewsletterFile,
  markdownForIngestedFile,
  type IngestedPageFile,
} from "@/lib/markdown-editor/utils/file-ingest";
import { linkifyParsedBlocks } from "@/lib/markdown-editor/utils/linkify";
import {
  enhancePreviewHtml,
  serializeEditorMarkdown,
} from "@/lib/markdown-editor/utils/editor-markdown";
import { parseMarkdownToEditorBlocks } from "@/lib/markdown-editor/utils/email-button-markdown";
import { markdownSelectAllExtension } from "@/lib/markdown-editor/utils/select-all";
import { resolveNewsletterAssetPath } from "@/lib/markdown-editor/utils/assets";
import {
  normalizeNewsletterAssetUrl,
  normalizeNewsletterAssetUrlsInHtml,
} from "@/lib/markdown-editor/utils/asset-url";
import { getStudioApiBase } from "@/studio/api";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/newsletter-upload";
import { cn } from "@/lib/utils";

import "@blocknote/shadcn/style.css";
import "@/lib/markdown-editor/css/markdown-editor.css";
import "@/lib/markdown-editor/css/markdown-shared.css";

export type MarkdownEditorHandle = EditorSnapshotProvider;

type MarkdownEditorProps = {
  /** Real newsletter id — asset upload/resolution namespace (`/studio/newsletters/:newsletterId/assets`). */
  newsletterId: string;
  /**
   * Document identity for the persistence snapshot's `filePath` binding —
   * must equal the `path` the caller's persistence hook uses, so a stale
   * snapshot from a previously-open document isn't applied to this one.
   * Defaults to `newsletterId` when the document and asset namespace are the
   * same entity (e.g. template vs newsletter send record).
   */
  documentId?: string;
  /** Which Studio asset namespace receives uploads (newsletter, trigger, or message template). */
  assetOwner?: CrmContentAssetOwner;
  value: string;
  editable?: boolean;
  onChange: (payload: { markdown: string; html: string }) => void;
  className?: string;
};

function blockIdAtPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  return el?.closest("[data-id]")?.getAttribute("data-id") ?? null;
}

function insertIngestedPageFiles(
  editor: NewsletterEditor,
  items: IngestedPageFile[],
  dropPoint?: { clientX: number; clientY: number },
): void {
  if (items.length === 0) return;
  if (dropPoint) {
    const dropBlockId = blockIdAtPoint(dropPoint.clientX, dropPoint.clientY);
    if (dropBlockId) {
      try {
        editor.setTextCursorPosition(dropBlockId, "end");
      } catch {
        /* non-text block */
      }
    }
  }

  let reference = editor.getTextCursorPosition().block;
  for (const ingested of items) {
    editor.setTextCursorPosition(reference.id, "end");
    editor.pasteMarkdown(markdownForIngestedFile(ingested));
    reference = editor.getTextCursorPosition().block;
  }
}

function plainBlocksFromMarkdown(markdown: string): { type: string; props?: { level: number }; content: string }[] {
  const parts = markdown.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return [{ type: "paragraph", content: "" }];
  return parts.map((part) => ({ type: "paragraph", content: part.replace(/\n/g, " ") }));
}

async function setEditorMarkdown(
  editor: NewsletterEditor,
  markdown: string,
  syncingRef: MutableRefObject<boolean>,
  options?: { isStale?: () => boolean },
): Promise<boolean> {
  syncingRef.current = true;
  try {
    let blocks: unknown[];
    try {
      blocks = await parseMarkdownToEditorBlocks(editor, markdown, linkifyParsedBlocks);
    } catch (err) {
      console.error("Failed to parse markdown for editor", err);
      blocks = plainBlocksFromMarkdown(markdown);
    }
    if (options?.isStale?.()) return false;
    editor.replaceBlocks(
      editor.document,
      blocks.length > 0 ? (blocks as never[]) : [{ type: "paragraph", content: "" }],
    );
    return true;
  } catch (err) {
    console.error("Failed to hydrate markdown editor", err);
    if (options?.isStale?.()) return false;
    try {
      editor.replaceBlocks(editor.document, plainBlocksFromMarkdown(markdown) as never[]);
      return true;
    } catch {
      return false;
    }
  } finally {
    syncingRef.current = false;
  }
}

const slashMenuFloatingOptions: FloatingUIOptions = {
  useFloatingOptions: {
    placement: "bottom-start",
    middleware: [
      offset(10),
      autoPlacement({ allowedPlacements: ["bottom-start", "top-start"], padding: 10 }),
      shift(),
      size({
        apply({ elements, availableHeight }) {
          const MIN_HEIGHT = 280;
          if (availableHeight < MIN_HEIGHT) {
            elements.floating.style.minHeight = `${MIN_HEIGHT}px`;
            elements.floating.style.maxHeight = `${MIN_HEIGHT}px`;
          } else {
            elements.floating.style.minHeight = "";
            elements.floating.style.maxHeight = `${availableHeight}px`;
          }
        },
        padding: 10,
      }),
    ],
  },
  focusManagerProps: { disabled: true },
  elementProps: {
    onMouseDownCapture: (event) => event.preventDefault(),
    style: { zIndex: 80 },
  },
};

function openExternalLink(event: React.MouseEvent) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href")?.trim();
  if (!href || !/^https?:\/\//i.test(href)) return;
  event.preventDefault();
  window.open(href, "_blank", "noopener,noreferrer");
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  {
    newsletterId,
    documentId = newsletterId,
    assetOwner = "newsletter",
    value,
    editable = true,
    onChange,
    className,
  },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const syncingRef = useRef(false);
  const pendingEditorMarkdownRef = useRef<string | null>(null);
  const editorMountedRef = useRef(false);
  const editorRef = useRef<NewsletterEditor | null>(null);
  const newsletterIdRef = useRef(newsletterId);
  const assetOwnerRef = useRef(assetOwner);
  const hydratedRef = useRef(false);
  const hydratedFingerprintRef = useRef<string | null>(null);
  const hydrateGenRef = useRef(0);

  onChangeRef.current = onChange;
  valueRef.current = value;
  newsletterIdRef.current = newsletterId;
  assetOwnerRef.current = assetOwner;

  const ingestFile = useCallback(async (file: File) => {
    return ingestNewsletterFile({
      file,
      newsletterId: newsletterIdRef.current,
      assetOwner: assetOwnerRef.current,
      settings: DEFAULT_IMAGE_OPTIMIZATION_SETTINGS,
    });
  }, []);

  const ingestAndInsert = useCallback(
    async (
      files: File[],
      editorInstance: NewsletterEditor,
      dropPoint?: { clientX: number; clientY: number },
    ) => {
      if (files.length === 0) return;
      const results = await Promise.allSettled(files.map((file) => ingestFile(file)));
      const ingested: IngestedPageFile[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") ingested.push(result.value);
        else console.error("Failed to attach file", result.reason);
      }
      insertIngestedPageFiles(editorInstance, ingested, dropPoint);
    },
    [ingestFile],
  );

  const editor = useCreateBlockNote({
    schema: newsletterEditorSchema,
    animations: false,
    extensions: [markdownSelectAllExtension],
    links: { onClick: () => true },
    uploadFile: async (file) => {
      const { markdownUrl } = await ingestFile(file);
      return markdownUrl;
    },
    resolveFileUrl: async (url) => {
      if (/^(https?:|data:|blob:)/i.test(url)) return normalizeNewsletterAssetUrl(url);
      const assetPath = resolveNewsletterAssetPath(newsletterIdRef.current, url);
      if (!assetPath) return url;
      const [cid, ...rest] = assetPath.split("/");
      const filename = rest.join("/");
      if (!cid || !filename) return url;
      if (assetOwnerRef.current === "trigger") {
        return `${getStudioApiBase()}/studio/assets/trigger/${encodeURIComponent(cid)}/${encodeURIComponent(filename)}`;
      }
      if (assetOwnerRef.current === "message") {
        return `${getStudioApiBase()}/studio/assets/template/${encodeURIComponent(cid)}/${encodeURIComponent(filename)}`;
      }
      return `${getStudioApiBase()}/studio/assets/${encodeURIComponent(cid)}/${encodeURIComponent(filename)}`;
    },
    pasteHandler: ({ event, editor: pasteEditor, defaultPasteHandler }) => {
      const clipboard = event.clipboardData;
      let files = collectTransferFiles(clipboard);
      if (files.length === 0) {
        const imageOnly = getClipboardImageFile(clipboard);
        if (imageOnly) files = [imageOnly];
      }
      if (files.length > 0) {
        void ingestAndInsert(files, pasteEditor);
        return true;
      }
      return defaultPasteHandler({
        plainTextAsMarkdown: true,
        prioritizeMarkdownOverHTML: true,
      });
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    setReady(true);
  }, []);

  const emitChange = useCallback(
    (body: string, editorInstance: NewsletterEditor) => {
      pendingEditorMarkdownRef.current = body;
      const markdown = body;
      const html = enhancePreviewHtml(
        normalizeNewsletterAssetUrlsInHtml(editorInstance.blocksToHTMLLossy()),
      );
      onChangeRef.current({ markdown, html });
      return markdown;
    },
    [],
  );

  const readPersistedBody = useCallback((): string => {
    return pendingEditorMarkdownRef.current ?? valueRef.current;
  }, []);

  const flushBody = useCallback(
    (editorInstance?: NewsletterEditor | null): string => {
      const inst = editorInstance ?? editorRef.current;
      if (!inst || !editorMountedRef.current || !hydratedRef.current) {
        return readPersistedBody();
      }
      const strategy = markdownFlushStrategy(
        hydratedFingerprintRef.current,
        fingerprintEditorDocument(inst.document),
        false,
      );
      if (strategy === "serialize") {
        return serializeEditorMarkdown(inst);
      }
      return readPersistedBody();
    },
    [readPersistedBody],
  );

  const syncMarkdownFromValue = useCallback(async (markdown: string) => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !editorMountedRef.current) return;
    const gen = ++hydrateGenRef.current;
    const applied = await setEditorMarkdown(editorInstance, markdown, syncingRef, {
      isStale: () => hydrateGenRef.current !== gen,
    });
    if (!applied || hydrateGenRef.current !== gen) return;
    hydratedRef.current = true;
    hydratedFingerprintRef.current = fingerprintEditorDocument(editorInstance.document);
    // Seed parent preview HTML — notifyEditorChange skips unchanged fingerprints.
    emitChange(serializeEditorMarkdown(editorInstance), editorInstance);
  }, [emitChange]);

  const notifyEditorChange = useCallback(
    (editorInstance: NewsletterEditor) => {
      if (syncingRef.current || !hydratedRef.current) return;
      if (
        hydratedFingerprintRef.current != null &&
        fingerprintEditorDocument(editorInstance.document) === hydratedFingerprintRef.current
      ) {
        return;
      }
      emitChange(serializeEditorMarkdown(editorInstance), editorInstance);
    },
    [emitChange],
  );

  useEffect(() => {
    if (!editor) return;
    const unsubMount = editor.onMount(() => {
      editorMountedRef.current = true;
      void syncMarkdownFromValue(valueRef.current);
    });
    const unsubUnmount = editor.onUnmount(() => {
      editorMountedRef.current = false;
    });
    return () => {
      unsubMount();
      unsubUnmount();
    };
  }, [editor, syncMarkdownFromValue]);

  useEffect(() => {
    if (!editor || !editorMountedRef.current) return;
    const pending = pendingEditorMarkdownRef.current;
    const currentMarkdown = serializeEditorMarkdown(editor);
    if (pending !== null && (value === pending || currentMarkdown === value)) {
      pendingEditorMarkdownRef.current = null;
      return;
    }
    if (currentMarkdown === value) {
      pendingEditorMarkdownRef.current = null;
      return;
    }
    pendingEditorMarkdownRef.current = null;
    void syncMarkdownFromValue(value);
  }, [editor, syncMarkdownFromValue, value]);

  useEffect(() => {
    if (!editor) return;
    return editor.onChange((editorInstance) => notifyEditorChange(editorInstance));
  }, [editor, notifyEditorChange]);

  const pullSnapshot = useCallback((): string | null => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !editorMountedRef.current || syncingRef.current || !hydratedRef.current) {
      return null;
    }
    const strategy = markdownFlushStrategy(
      hydratedFingerprintRef.current,
      fingerprintEditorDocument(editorInstance.document),
      false,
    );
    if (strategy === "persisted") return valueRef.current;
    const body = flushBody(editorInstance);
    emitChange(body, editorInstance);
    return body;
  }, [emitChange, flushBody]);

  const insertTextAtCursor = useCallback(
    (text: string) => {
      const editorInstance = editorRef.current;
      if (!editorInstance || !editorMountedRef.current || !editable || !text) return;
      try {
        editorInstance.focus();
        editorInstance.insertInlineContent([{ type: "text", text, styles: {} }]);
        notifyEditorChange(editorInstance);
      } catch (err) {
        console.error("Failed to insert text in editor", err);
      }
    },
    [editable, notifyEditorChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      filePath: documentId,
      flushSnapshot(): string | null {
        return pullSnapshot();
      },
      insertText(text: string) {
        insertTextAtCursor(text);
      },
    }),
    [documentId, insertTextAtCursor, pullSnapshot],
  );

  useEffect(() => {
    return () => {
      pullSnapshot();
    };
  }, [pullSnapshot]);

  const isDark = ready && resolvedTheme === "dark";

  return (
    <div
      className={cn("gtm-md-editor gtm-md-editor-fill h-full min-h-0 w-full px-3 py-3", className)}
      data-theme={isDark ? "dark" : "light"}
      onContextMenu={(e) => e.stopPropagation()}
      onDragOverCapture={(event) => {
        if (!transferHasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDropCapture={(event) => {
        const files = collectTransferFiles(event.dataTransfer);
        if (files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const editorInstance = editorRef.current;
        if (!editorInstance) return;
        void ingestAndInsert(files, editorInstance, {
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }}
      onClick={openExternalLink}
    >
      {ready ? (
        <BlockNoteView
          editor={editor}
          editable={editable}
          sideMenu={false}
          slashMenu={false}
          tableHandles={false}
          theme={isDark ? "dark" : "light"}
          className="gtm-md-editor-view h-full min-h-0"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            floatingUIOptions={slashMenuFloatingOptions}
            getItems={(query) => getNewsletterEditorSlashMenuItems(editor, query)}
            shouldOpen={(state) => !state.selection.$from.parent.type.isInGroup("tableContent")}
          />
          <TableHandlesController tableHandle={TableHandleWithIcons} />
        </BlockNoteView>
      ) : (
        <div className="min-h-[12rem]" aria-hidden />
      )}
    </div>
  );
});

export default MarkdownEditor;
