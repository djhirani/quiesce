// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalize } from "@/lib/certificate/canonical";

describe("canonical serialization", () => {
  it("sorts object keys recursively and preserves array order", () => {
    expect(
      canonicalize({
        b: 1,
        a: [1, "x", { d: 2, c: 3 }],
        c: { z: true, y: null },
      }),
    ).toBe('{"a":[1,"x",{"c":3,"d":2}],"b":1,"c":{"y":null,"z":true}}');
  });

  it("is byte-stable regardless of key insertion order", () => {
    const first = canonicalize({ alpha: 1, beta: { g: 1, f: 2 } });
    const second = canonicalize({ beta: { f: 2, g: 1 }, alpha: 1 });
    expect(first).toBe(second);
    expect(canonicalize(JSON.parse(first))).toBe(first);
  });

  it("normalizes negative zero to zero", () => {
    expect(canonicalize({ value: -0 })).toBe('{"value":0}');
  });

  it("uses deterministic JSON string escaping", () => {
    const tricky = 'quote " backslash \\ newline \n unicode   emoji 🛑';
    expect(canonicalize(tricky)).toBe(JSON.stringify(tricky));
  });

  it("rejects NaN, Infinity, undefined, and unsupported types", () => {
    expect(() => canonicalize(Number.NaN)).toThrow(/NaN/);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(/Infinity/);
    expect(() => canonicalize({ a: undefined })).toThrow(/undefined/);
    expect(() => canonicalize({ a: () => 1 })).toThrow(/unsupported/);
    expect(() => canonicalize({ a: BigInt(1) })).toThrow(/unsupported/);
  });
});
