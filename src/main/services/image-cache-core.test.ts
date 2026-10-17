import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionForContentType,
  filesToEvict,
  imageCacheKey,
} from "./image-cache-core.js";
import { cachedImage, parseCachedImageUrl } from "../../shared/cached-image.js";

test("cache keys are stable per URL", () => {
  assert.equal(
    imageCacheKey("https://a/b.png"),
    imageCacheKey("https://a/b.png")
  );
  assert.notEqual(
    imageCacheKey("https://a/b.png"),
    imageCacheKey("https://a/c.png")
  );
  assert.match(imageCacheKey("x"), /^[0-9a-f]{64}$/);
});

test("only image content types get an extension", () => {
  assert.equal(extensionForContentType("image/webp"), "webp");
  assert.equal(extensionForContentType("image/jpeg; charset=binary"), "jpg");
  assert.equal(extensionForContentType("IMAGE/PNG"), "png");
  assert.equal(extensionForContentType("text/html"), null);
  assert.equal(extensionForContentType(null), null);
});

test("eviction drops least recently used files until under the cap", () => {
  const files = [
    { path: "new", sizeBytes: 40, lastUsedMs: 3 },
    { path: "old", sizeBytes: 40, lastUsedMs: 1 },
    { path: "mid", sizeBytes: 40, lastUsedMs: 2 },
  ];
  assert.deepEqual(filesToEvict(files, 100), ["old"]);
  assert.deepEqual(filesToEvict(files, 40), ["old", "mid"]);
  assert.deepEqual(filesToEvict(files, 500), []);
});

test("cachedImage wraps only http(s) URLs and round-trips", () => {
  const url = "https://cdn.example.com/a b/cover.jpg?x=1&y=2";
  const wrapped = cachedImage(url);
  assert.match(wrapped, /^cached-image:/);
  assert.equal(parseCachedImageUrl(wrapped), url);
  assert.equal(cachedImage("local:C:/x.png"), "local:C:/x.png");
  assert.equal(
    cachedImage("data:image/png;base64,AA"),
    "data:image/png;base64,AA"
  );
  assert.equal(cachedImage(null), null);
  assert.equal(cachedImage(undefined), undefined);
  assert.equal(parseCachedImageUrl("cached-image:file%3A%2F%2F%2Fetc"), null);
  assert.equal(parseCachedImageUrl("local:abc"), null);
});
