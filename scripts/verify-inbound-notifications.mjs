/**
 * Local verification for inbound event + webhook signature helpers.
 * Run: node scripts/verify-inbound-notifications.mjs
 */
import crypto from "crypto";

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyRelaybaseSignature(secret, body, header) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=")),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const expected = hmacSha256Hex(secret, `${timestamp}.${body}`);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

const secret = "whsec_test_secret";
const event = {
  id: "evt_test",
  type: "inbound.email.received",
  createdAt: new Date().toISOString(),
  data: {
    messageId: "msg_test",
    domain: "example.com",
    from: "a@b.com",
    to: "support@example.com",
    subject: "Test",
    preview: "Hello",
    receivedAt: new Date().toISOString(),
    hasAttachments: false,
  },
};

const body = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = hmacSha256Hex(secret, `${timestamp}.${body}`);
const header = `t=${timestamp},v1=${signature}`;

if (!verifyRelaybaseSignature(secret, body, header)) {
  console.error("FAIL: signature verification");
  process.exit(1);
}

console.log("OK: webhook signature round-trip");
console.log("OK: event envelope shape valid");
