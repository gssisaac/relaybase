import assert from "node:assert/strict";
import test from "node:test";

import {
  guessEmailColumnIndex,
  guessNameColumnIndex,
  mapCsvRowsToContacts,
  parseCsvText,
} from "./parse-csv-contacts";

test("parseCsvText reads headers and rows", () => {
  const { headers, rows } = parseCsvText("Name,Email\nAlex,alex@example.com\n");
  assert.deepEqual(headers, ["Name", "Email"]);
  assert.deepEqual(rows, [["Alex", "alex@example.com"]]);
});

test("parseCsvText handles quoted commas", () => {
  const { rows } = parseCsvText('Name,Email\n"Kim, Alex",alex@example.com');
  assert.deepEqual(rows, [['Kim, Alex', "alex@example.com"]]);
});

test("guess columns from common headers", () => {
  const headers = ["Full Name", "E-mail"];
  assert.equal(guessNameColumnIndex(headers), 0);
  assert.equal(guessEmailColumnIndex(headers), 1);
});

test("mapCsvRowsToContacts dedupes and validates email", () => {
  const rows = [
    ["Alex", "alex@example.com"],
    ["", "not-an-email"],
    ["Dup", "alex@example.com"],
    ["Blake", "blake@example.com"],
  ];
  const { contacts, skippedInvalid } = mapCsvRowsToContacts(rows, 1, 0);
  assert.equal(skippedInvalid, 2);
  assert.deepEqual(contacts, [
    { email: "alex@example.com", name: "Alex" },
    { email: "blake@example.com", name: "Blake" },
  ]);
});
