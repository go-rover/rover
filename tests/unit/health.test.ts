import { describe, expect, test } from "bun:test";

describe("dogfood", () => {
  test("bun test discovery", () => {
    expect(1 + 1).toBe(2);
  });
});
