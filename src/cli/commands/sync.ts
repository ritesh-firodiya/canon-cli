import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { scanRepo } from '../../scanner/index.js';
import { analyzeWithAI } from '../../scanner/pattern-extractor.js';
import { MemoryStore } from '../../memory/store.js';
import { createProvider } from '../../llm/provider.js';
import { getApiKey, zenoExists } from '../../utils/config.js';

export async function syncCommand(): Promise<void> {
  const repoRoot = resolve(process.cwd());

  console.log(chalk.bold('\n  Zeno AI - Sync Memory\n'));

  if (!zenoExists(repoRoot)) {
    console.log(chalk.red('  .zeno/ not found. Run `zeno init` first.\n'));
    process.exit(1);
  }

  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (e) {
    console.log(chalk.red(`  ${(e as Error).message}\n`));
    process.exit(1);
  }

  const store = new MemoryStore(repoRoot);

  // Re-scan
  const scanSpinner = ora('  Scanning repository...').start();
  const scanResult = await scanRepo(repoRoot);
  scanSpinner.succeed(`  Found ${scanResult.totalFiles} files`);

  await store.saveScanResult(scanResult);

  // Re-analyze with AI
  const aiSpinner = ora('  Re-analyzing patterns...').start();
  try {
    const llm = createProvider('claude', { apiKey });
    const stackSummary = `Languages: ${scanResult.stack.languages.join(', ')}\nFrameworks: ${scanResult.stack.frameworks.join(', ')}\nDatabases: ${scanResult.stack.databases.join(', ')}`;

    const analysis = await analyzeWithAI(repoRoot, scanResult.files, stackSummary, llm);
    await store.savePatterns(analysis.patterns);
    await store.saveConventions(analysis.conventions);
    await store.saveDomain(analysis.domain);
    await store.saveArchitectureDoc(analysis.architecture);

    aiSpinner.succeed(`  Updated ${analysis.patterns.length} patterns, ${analysis.conventions.length} conventions`);
  } catch (e) {
    aiSpinner.warn(`  AI analysis skipped: ${(e as Error).message}`);
  }

  // Update config timestamp
  const config = await store.getConfig();
  if (config) {
    config.lastSyncAt = new Date().toISOString();
    await store.saveConfig(config);
  }

  console.log(chalk.green('\n  Sync complete.\n'));
}
