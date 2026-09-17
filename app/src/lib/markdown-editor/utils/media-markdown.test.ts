import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeYoutubeEmbedsInMarkdown,
  promotePageMediaBlocks,
  serializePageMediaMarkdown,
  serializeVideoBlockMarkdown,
} from "./media-markdown";

describe("serializeVideoBlockMarkdown", () => {
  it("writes YouTube video blocks as markdown image syntax for raw mode", () => {
    assert.equal(
      serializeVideoBlockMarkdown({
        type: "video",
        props: {
          url: "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
          name: "July recap",
        },
      }),
      "![July recap](https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4)",
    );
  });
});

describe("normalizeYoutubeEmbedsInMarkdown", () => {
  it("rewrites youtube video html tags to markdown image syntax", () => {
    const md =
      '<video src="https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4" controls></video>';
    assert.equal(
      normalizeYoutubeEmbedsInMarkdown(md),
      "![YouTube video](https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4)",
    );
  });
});

describe("serializePageMediaMarkdown", () => {
  it("rewrites video image syntax to a video tag", () => {
    assert.equal(
      serializePageMediaMarkdown("![clip](./.note/AB239FBQ-clip.mp4)\n"),
      '<video src="./.note/AB239FBQ-clip.mp4" controls></video>\n',
    );
  });

  it("leaves still images alone", () => {
    const md = "![shot](./.note/AB239FBQ-shot.webp)\n";
    assert.equal(serializePageMediaMarkdown(md), md);
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
    assert.equal((block as { type: string }).type, "video");
    assert.equal((block as { props: { url: string } }).props.url, "./.note/AB239FBQ-clip.mp4");
  });

  it("promotes an image block with a YouTube url to a video block", () => {
    const [block] = promotePageMediaBlocks([
      {
        type: "image",
        props: {
          url: "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
          name: "g87ErJB0rh4?list=RDg87ErJB0rh4",
        },
        children: [],
      },
    ]);
    assert.equal((block as { type: string }).type, "video");
    assert.equal(
      (block as { props: { url: string } }).props.url,
      "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
    );
  });

  it("promotes a standalone YouTube link paragraph to a video block", () => {
    const [block] = promotePageMediaBlocks([
      {
        type: "paragraph",
        content: [
          {
            type: "link",
            href: "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
            content: [{ type: "text", text: "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4" }],
          },
        ],
        children: [],
      },
    ]);
    assert.equal((block as { type: string }).type, "video");
    assert.equal(
      (block as { props: { url: string } }).props.url,
      "https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4",
    );
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
    assert.equal((block as { type: string }).type, "file");
    assert.equal((block as { props: { url: string } }).props.url, "./.note/AB239FBQ-brief.pdf");
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
    assert.deepEqual(block, source);
  });
});
