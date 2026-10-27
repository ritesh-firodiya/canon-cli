export interface Env {
  canonRoot: string;
  /** The folder holding the product repos, or null when there is none. */
  workspace: string | null;
}

/** For commands that only make sense across products. */
export function requireWorkspace(env: Env): string {
  if (env.workspace) return env.workspace;
  throw new Error("no products found — run this in a product repo or the folder that holds them, or set CANON_WORKSPACE");
}
