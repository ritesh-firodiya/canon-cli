import { valueAt } from "../config/load.ts";
import type { Check } from "./types.ts";

/** True when everything the locked value says also holds in the resolved one. */
function holds(locked: unknown, resolved: unknown): boolean {
  if (Array.isArray(locked)) return Array.isArray(resolved) && locked.every((item, index) => holds(item, resolved[index]));
  if (locked && typeof locked === "object") {
    return Boolean(resolved) && Object.entries(locked).every(([key, value]) => holds(value, (resolved as Record<string, unknown>)[key]));
  }
  return locked === resolved;
}

export const locks: Check = {
  id: "locks",
  module: null,
  description: "no lower layer changes or removes a value a higher layer locked",
  run({ config }) {
    return config.locks
      .filter((lock) => !holds(lock.value, valueAt(config, lock.key)))
      .map((lock) => ({
        check: "locks",
        level: "error" as const,
        file: ".context/context.yaml",
        message: `${lock.key} is locked by ${lock.layer}${lock.value === undefined ? ", which does not set it" : ""}; a lower layer changed or removed it`,
      }));
  },
};
