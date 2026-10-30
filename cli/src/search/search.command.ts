// canon search — full-text + semantic search over all knowledge via qmd.
import type { Command } from 'commander';
import { qmdQuery } from '../lib/qmd.ts';

export function registerSearch(program: Command): void {
  program
    .command('search')
    .description('search knowledge (hybrid: keywords + semantics + rerank, via qmd)')
    .argument('<query>')
    .option('-c, --collection <name>', 'restrict to a collection', 'canon')
    .action((query: string, opts: { collection: string }) => {
      const r = qmdQuery(query, [opts.collection]);
      process.stdout.write(r.out || r.err);
      process.exit(r.ok ? 0 : 1);
    });
}
