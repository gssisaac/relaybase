import { createExtension, type BlockNoteEditor } from "@blocknote/core";

/** BlockNote omits TipTap's keymap, so Mod-a never reaches selectAll. */
export function selectAllEditorContent(editor: BlockNoteEditor): boolean {
  const selectableIds: string[] = [];
  editor.forEachBlock((block) => {
    const spec =
      editor.schema.blockSchema[
        block.type as keyof typeof editor.schema.blockSchema
      ];
    if (spec?.content === "inline" || spec?.content === "table") {
      selectableIds.push(block.id);
    }
    return true;
  });

  if (selectableIds.length >= 2) {
    editor.setSelection(
      selectableIds[0]!,
      selectableIds[selectableIds.length - 1]!,
    );
    return true;
  }

  if (selectableIds.length === 1) {
    return editor._tiptapEditor.commands.selectAll();
  }

  return false;
}

export const markdownSelectAllExtension = createExtension({
  key: "railmarkMarkdownSelectAll",
  keyboardShortcuts: {
    "Mod-a": ({ editor }) => selectAllEditorContent(editor),
  },
});
