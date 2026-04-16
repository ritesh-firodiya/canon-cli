import { simpleGit, type SimpleGit } from 'simple-git';

export function createGit(repoRoot: string): SimpleGit {
  return simpleGit(repoRoot);
}

export async function isGitRepo(repoRoot: string): Promise<boolean> {
  try {
    const git = createGit(repoRoot);
    await git.status();
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(repoRoot: string): Promise<string> {
  const git = createGit(repoRoot);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
  return branch.trim();
}

export async function createBranch(repoRoot: string, branchName: string): Promise<void> {
  const git = createGit(repoRoot);
  await git.checkoutLocalBranch(branchName);
}

export async function commitAll(repoRoot: string, message: string): Promise<string> {
  const git = createGit(repoRoot);
  await git.add('.');
  const result = await git.commit(message);
  return result.commit;
}

export async function switchBranch(repoRoot: string, branchName: string): Promise<void> {
  const git = createGit(repoRoot);
  await git.checkout(branchName);
}

export async function getStatus(repoRoot: string): Promise<{ modified: string[]; added: string[]; deleted: string[] }> {
  const git = createGit(repoRoot);
  const status = await git.status();
  return {
    modified: status.modified,
    added: [...status.not_added, ...status.created],
    deleted: status.deleted,
  };
}

export async function stashChanges(repoRoot: string): Promise<boolean> {
  const git = createGit(repoRoot);
  const status = await git.status();
  if (status.files.length === 0) return false;
  await git.stash();
  return true;
}

export async function popStash(repoRoot: string): Promise<void> {
  const git = createGit(repoRoot);
  await git.stash(['pop']);
}
