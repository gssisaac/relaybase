import { describe, expect, it } from "vitest";

import { promotePageMediaBlocks, serializePageMediaMarkdown } from "./page-media-markdown";

describe("serializePageMediaMarkdown", () => {
  it("rewrites video image syntax to a video tag", () => {
    expect(serializePageMediaMarkdown("![clip](./.note/AB239FBQ-clip.mp4)\n")).toBe(
      '<video src="./.note/AB239FBQ-clip.mp4" controls></video>\n',
    );
  });

  it("leaves still images alone", () => {
    const md = "![shot](./.note/AB239FBQ-shot.webp)\n";
    expect(serializePageMediaMarkdown(md)).toBe(md);
  });
});

describe("promotePageMediaBlocks", () => {
  it("promotes an image block with a video url to a video block", () => {
    const [block] = promotePageMediaBlocks([
      {
        type: "image",
        props: { url: "./.note/AB239FBQ-clip.mp4", name: "clip" },
        children: [],
      },
    ]);
    expect(block).toMatchObject({
      type: "video",
      props: { url: "./.note/AB239FBQ-clip.mp4", name: "clip" },
    });
  });

  it("promotes a standalone document link to a file block", () => {
    const [block] = promotePageMediaBlocks([
      {
        type: "paragraph",
        content: [
          {
            type: "link",
            href: "./.note/AB239FBQ-brief.pdf",
            content: [{ type: "text", text: "brief" }],
          },
        ],
        children: [],
      },
    ]);
    expect(block).toMatchObject({
      type: "file",
      props: { url: "./.note/AB239FBQ-brief.pdf", name: "brief" },
    });
  });

  it("leaves generic file links as paragraphs", () => {
    const source = {
      type: "paragraph",
      content: [
        {
          type: "link",
          href: "./.note/AB239FBQ-archive.zip",
          content: [{ type: "text", text: "archive" }],
        },
      ],
      children: [],
    };
    const [block] = promotePageMediaBlocks([source]);
    expect(block).toEqual(source);
  });
});
