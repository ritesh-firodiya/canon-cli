import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { scanRepo } from '../../scanner/index.js';
import { analyzeWithAI } from '../../scanner/pattern-extractor.js';
import { MemoryStore } from '../../memory/store.js';
import { createProvider } from '../../llm/provider.js';
import { isGitRepo } from '../../git/index.js';
import { getApiKey, zenoExists } from '../../utils/config.js';
import type { ZenoConfig } from '../../types/index.js';

export async function initCommand(options: { refresh?: boolean }): Promise<void> {
  const repoRoot = resolve(process.cwd());

  console.log(chalk.bold('\n  Zeno AI - Repository Scanner\n'));

  // Check if git repo
  if (!(await isGitRepo(repoRoot))) {
    console.log(chalk.red('  Error: Not a git repository. Run this from a git repo root.\n'));
    process.exit(1);
  }

  // Check if already initialized
  if (zenoExists(repoRoot) && !options.refresh) {
    console.log(chalk.yellow('  .zeno/ already exists. Use --refresh to re-scan.\n'));
    process.exit(0);
  }

  // Get API key
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (e) {
    console.log(chalk.red(`  ${(e as Error).message}\n`));
    process.exit(1);
  }

  const store = new MemoryStore(repoRoot);
  await store.initialize();

  // Step 1: Scan file tree and detect stack
  const scanSpinner = ora('  Scanning repository...').start();
  let scanResult;
  try {
    scanResult = await scanRepo(repoRoot);
    scanSpinner.succeed(`  Found ${scanResult.totalFiles} files`);
  } catch (e) {
    scanSpinner.fail(`  Scan failed: ${(e as Error).message}`);
    process.exit(1);
  }

  // Show scan results
  console.log(chalk.dim(`\n  Languages: ${Object.entries(scanResult.languages).map(([l, c]) => `${l}(${c})`).join(', ')}`));
  console.log(chalk.dim(`  Stack: ${[...scanResult.stack.frameworks, ...scanResult.stack.databases].join(', ') || 'none detected'}`));
  console.log(chalk.dim(`  Testing: ${scanResult.stack.testing.join(', ') || 'none detected'}`));

  // Save basic scan results
  await store.saveScanResult(scanResult);

  // Step 2: AI analysis
  const aiSpinner = ora('  Analyzing patterns and architecture with AI...').start();
  try {
    const llm = createProvider('claude', { apiKey });
    const stackSummary = `Languages: ${scanResult.stack.languages.join(', ')}\nFrameworks: ${scanResult.stack.frameworks.join(', ')}\nDatabases: ${scanResult.stack.databases.join(', ')}`;

    const analysis = await analyzeWithAI(repoRoot, scanResult.files, stackSummary, llm);

    await store.savePatterns(analysis.patterns);
    await store.saveConventions(analysis.conventions);
    await store.saveDomain(analysis.domain);
    await store.saveArchitectureDoc(analysis.architecture);

    aiSpinner.succeed(`  Extracted ${analysis.patterns.length} patterns, ${analysis.conventions.length} conventions`);
  } catch (e) {
    aiSpinner.warn(`  AI analysis skipped: ${(e as Error).message}`);
  }

  // Save config
  const config: ZenoConfig = {
    version: '0.1.0',
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    createdAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
  };
  await store.saveConfig(config);

  console.log(chalk.green(`\n  Done! .zeno/ directory created.\n`));
  console.log(chalk.dim('  Next steps:'));
  console.log(chalk.dim('  - Review .zeno/docs/architecture.md'));
  console.log(chalk.dim('  - Review .zeno/patterns/'));
  console.log(chalk.dim('  - Run: zeno task "your task here"\n'));
}
