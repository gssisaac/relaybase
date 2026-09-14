import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftsFromValue,
  isValidMarker,
  localAttachmentsOf,
} from "./account-state-migration-logic.ts";
import type { DraftEmail } from "@/email/components/mailbox/types";

describe("isValidMarker", () => {
  it("accepts a well-formed marker", () => {
    assert.equal(
      isValidMarker({ version: 1, migratedAt: "2026-01-01T00:00:00Z" }),
      true,
    );
  });

  it("rejects null, non-objects, and malformed shapes", () => {
    assert.equal(isValidMarker(null), false);
    assert.equal(isValidMarker(undefined), false);
    assert.equal(isValidMarker("not-a-marker"), false);
    assert.equal(isValidMarker({}), false);
    assert.equal(isValidMarker({ version: 2, migratedAt: "x" }), false);
    assert.equal(isValidMarker({ version: 1 }), false);
    assert.equal(isValidMarker({ version: 1, migratedAt: 12345 }), false);
  });
});

describe("draftsFromValue", () => {
  it("extracts the drafts array from a well-formed blob", () => {
    const drafts = [{ id: "d1" }] as unknown as DraftEmail[];
    assert.deepEqual(draftsFromValue({ drafts }), drafts);
  });

  it("returns an empty array for malformed or missing shapes", () => {
    assert.deepEqual(draftsFromValue(null), []);
    assert.deepEqual(draftsFromValue(undefined), []);
    assert.deepEqual(draftsFromValue("oops"), []);
    assert.deepEqual(draftsFromValue({}), []);
    assert.deepEqual(draftsFromValue({ drafts: "not-an-array" }), []);
  });
});

function draft(attachments: DraftEmail["attachments"]): DraftEmail {
  return {
    id: "d1",
    from: "a@example.com",
    to: "b@example.com",
    subject: "s",
    body: "b",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    attachments,
  };
}

describe("localAttachmentsOf", () => {
  it("keeps only origin:local attachments", () => {
    const result = localAttachmentsOf(
      draft([
        {
          id: "a1",
          filename: "one.png",
          contentType: "image/png",
          size: 10,
          origin: "local",
        },
        {
          id: "a2",
          filename: "two.png",
          contentType: "image/png",
          size: 20,
          origin: "source",
          source: {
            kind: "inbound",
            domain: "example.com",
            messageId: "m1",
            attachmentId: "0",
          },
        },
      ]),
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "a1");
  });

  it("returns an empty array when there are no attachments", () => {
    assert.deepEqual(localAttachmentsOf(draft(undefined)), []);
    assert.deepEqual(localAttachmentsOf(draft([])), []);
  });
});
