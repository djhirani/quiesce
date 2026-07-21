/**
 * Deterministic canonical JSON serialization shared by the UI, tests, and CLI.
 * Object keys are sorted lexicographically (UTF-16 code-unit order), array
 * order is preserved, negative zero normalizes to zero, and unsupported
 * values, NaN, and Infinity are rejected rather than silently coerced.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number": {
      if (!Number.isFinite(value)) {
        throw new Error(
          "Canonical serialization rejects NaN and Infinity values.",
        );
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
      );
      return `{${entries
        .map(([key, entry]) => {
          if (entry === undefined) {
            throw new Error(
              `Canonical serialization rejects undefined value for key "${key}".`,
            );
          }
          return `${JSON.stringify(key)}:${canonicalize(entry)}`;
        })
        .join(",")}}`;
    }
    default:
      throw new Error(
        `Canonical serialization rejects unsupported type "${typeof value}".`,
      );
  }
}
