import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  TableHandle,
  useComponentsContext,
  useDictionary,
  useExtension,
  useExtensionState,
  type TableHandleMenuProps,
  type TableHandleProps,
} from "@blocknote/react";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Trash2,
} from "lucide-react";

const menuIconClass = "size-4 text-muted-foreground";

function DeleteMenuItem({ orientation }: { orientation: "row" | "column" }) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const tableHandles = useExtension(TableHandlesExtension);
  const index = useExtensionState(TableHandlesExtension, {
    selector: (state) =>
      orientation === "column" ? state?.colIndex : state?.rowIndex,
  });

  if (tableHandles === undefined || index === undefined) {
    return null;
  }

  return (
    <Components.Generic.Menu.Item
      icon={<Trash2 className={menuIconClass} />}
      onClick={() => tableHandles.removeRowOrColumn(index, orientation)}
    >
      {orientation === "row"
        ? dict.table_handle.delete_row_menuitem
        : dict.table_handle.delete_column_menuitem}
    </Components.Generic.Menu.Item>
  );
}

function AddMenuItem(
  props:
    | { orientation: "row"; side: "above" | "below" }
    | { orientation: "column"; side: "left" | "right" },
) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const tableHandles = useExtension(TableHandlesExtension);
  const index = useExtensionState(TableHandlesExtension, {
    selector: (state) =>
      props.orientation === "column" ? state?.colIndex : state?.rowIndex,
  });

  if (tableHandles === undefined || index === undefined) {
    return null;
  }

  const icon =
    props.orientation === "row" ? (
      props.side === "above" ? (
        <BetweenHorizontalStart className={menuIconClass} />
      ) : (
        <BetweenHorizontalEnd className={menuIconClass} />
      )
    ) : props.side === "left" ? (
      <BetweenVerticalStart className={menuIconClass} />
    ) : (
      <BetweenVerticalEnd className={menuIconClass} />
    );

  return (
    <Components.Generic.Menu.Item
      icon={icon}
      onClick={() => {
        tableHandles.addRowOrColumn(
          index,
          props.orientation === "row"
            ? { orientation: "row", side: props.side }
            : { orientation: "column", side: props.side },
        );
      }}
    >
      {dict.table_handle[`add_${props.side}_menuitem`]}
    </Components.Generic.Menu.Item>
  );
}

function TableHandleMenuWithIcons({ orientation }: TableHandleMenuProps) {
  const Components = useComponentsContext()!;

  return (
    <Components.Generic.Menu.Dropdown className="bn-table-handle-menu">
      <DeleteMenuItem orientation={orientation} />
      {orientation === "row" ? (
        <>
          <AddMenuItem orientation="row" side="above" />
          <AddMenuItem orientation="row" side="below" />
        </>
      ) : (
        <>
          <AddMenuItem orientation="column" side="left" />
          <AddMenuItem orientation="column" side="right" />
        </>
      )}
    </Components.Generic.Menu.Dropdown>
  );
}

export function TableHandleWithIcons(props: TableHandleProps) {
  return (
    <TableHandle {...props} tableHandleMenu={TableHandleMenuWithIcons as never} />
  );
}
