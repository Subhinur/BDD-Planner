import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isAllowedExternalUrl } = require("../electron/security.cjs") as {
  isAllowedExternalUrl(url: string): boolean;
};

test("external navigation permits only HTTP and HTTPS URLs", () => {
  assert.equal(isAllowedExternalUrl("https://example.com/help"), true);
  assert.equal(isAllowedExternalUrl("http://localhost:3000"), true);
  assert.equal(isAllowedExternalUrl("file:///etc/passwd"), false);
  assert.equal(isAllowedExternalUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedExternalUrl("not a url"), false);
});
