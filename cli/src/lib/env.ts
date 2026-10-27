export interface Env {
  canonRoot: string;
  /** The estate folder (parent of several products), or null when there is none. */
  estateRoot: string | null;
}

/** For commands that only make sense across products. */
export function requireEstate(env: Env): string {
  if (env.estateRoot) return env.estateRoot;
  throw new Error(
    "no estate found — put `estate: true` in .claude/canon.yaml of the folder that holds your products, or set CANON_ESTATE",
  );
}
