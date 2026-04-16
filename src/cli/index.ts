#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { taskCommand } from './commands/task.js';

const program = new Command();

program
  .name('zeno')
  .description('AI-powered autonomous development workflow')
  .version('0.1.0');

program
  .command('init')
  .description('Scan the current repo and build the .zeno/ memory')
  .option('--refresh', 'Force re-scan even if .zeno/ exists')
  .action(initCommand);

program
  .command('sync')
  .description('Update .zeno/ memory with latest code changes')
  .action(syncCommand);

program
  .command('task')
  .description('Submit a development task for the AI to complete')
  .argument('<description>', 'What you want the AI to do')
  .option('--evaluate-only', 'Only evaluate feasibility, do not execute')
  .action(taskCommand);

program.parse();
