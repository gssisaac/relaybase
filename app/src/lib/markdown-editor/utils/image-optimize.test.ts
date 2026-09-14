import { describe, expect, it } from "vitest";

import { collectTransferFiles, transferHasFiles } from "./image-optimize";

function fakeTransfer(files: File[], types: string[] = ["Files"]): DataTransfer {
  return {
    types,
    files,
    items: [],
  } as unknown as DataTransfer;
}

describe("collectTransferFiles", () => {
  it("returns every non-empty file in order", () => {
    const a = new File(["aaa"], "a.png", { type: "image/png" });
    const b = new File(["bbbb"], "b.pdf", { type: "application/pdf" });
    const empty = new File([], "empty.txt", { type: "text/plain" });
    expect(collectTransferFiles(fakeTransfer([a, empty, b])).map((file) => file.name)).toEqual([
      "a.png",
      "b.pdf",
    ]);
  });

  it("dedupes identical files from files + items", () => {
    const file = new File(["hello"], "shot.webp", { type: "image/webp" });
    const data = {
      types: ["Files"],
      files: [file],
      items: [{ kind: "file", getAsFile: () => file }],
    } as unknown as DataTransfer;
    expect(collectTransferFiles(data)).toHaveLength(1);
  });

  it("returns an empty list when nothing was transferred", () => {
    expect(collectTransferFiles(null)).toEqual([]);
    expect(collectTransferFiles(fakeTransfer([]))).toEqual([]);
  });
});

describe("transferHasFiles", () => {
  it("is true when the Files type is advertised", () => {
    expect(transferHasFiles(fakeTransfer([], ["Files"]))).toBe(true);
    expect(transferHasFiles(fakeTransfer([], ["text/plain"]))).toBe(false);
  });
});
