import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';
import { MemoryStore } from '../../memory/store.js';
import { createProvider } from '../../llm/provider.js';
import { evaluateTask } from '../../agent/evaluator.js';
import { executeTask } from '../../agent/executor.js';
import { getApiKey, zenoExists } from '../../utils/config.js';
import { getCurrentBranch, switchBranch } from '../../git/index.js';

function askQuestion(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function taskCommand(
  description: string,
  options: { evaluateOnly?: boolean }
): Promise<void> {
  const repoRoot = resolve(process.cwd());

  console.log(chalk.bold('\n  Zeno AI - Task Runner\n'));

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

  const llm = createProvider('claude', { apiKey });
  const store = new MemoryStore(repoRoot);

  console.log(chalk.dim(`  Task: ${description}\n`));

  // Step 1: Evaluate
  const evalSpinner = ora('  Evaluating task...').start();
  const evaluation = await evaluateTask(description, store, llm);
  evalSpinner.stop();

  // Show evaluation
  const complexityColors = {
    small: chalk.green,
    medium: chalk.yellow,
    large: chalk.red,
    'too-large': chalk.bgRed.white,
  };
  const colorFn = complexityColors[evaluation.estimatedComplexity];

  console.log(`  ${chalk.bold('Feasibility:')} ${evaluation.feasible ? chalk.green('Yes') : chalk.red('No')} (${Math.round(evaluation.confidence * 100)}% confidence)`);
  console.log(`  ${chalk.bold('Complexity:')} ${colorFn(evaluation.estimatedComplexity)}`);
  console.log(`  ${chalk.bold('Reason:')} ${evaluation.reason}`);

  if (evaluation.duplicateOf) {
    console.log(chalk.yellow(`\n  Warning: This may duplicate plan #${evaluation.duplicateOf}`));
  }

  if (evaluation.conflictsWith && evaluation.conflictsWith.length > 0) {
    console.log(chalk.yellow(`\n  Warning: Conflicts with plans: ${evaluation.conflictsWith.join(', ')}`));
  }

  if (evaluation.estimatedComplexity === 'too-large' && evaluation.subtasks) {
    console.log(chalk.yellow('\n  Suggested subtasks:'));
    evaluation.subtasks.forEach((s, i) => console.log(chalk.dim(`    ${i + 1}. ${s}`)));
  }

  if (evaluation.suggestedQuestions.length > 0) {
    console.log(chalk.cyan('\n  Questions:'));
    for (const q of evaluation.suggestedQuestions) {
      console.log(chalk.cyan(`    ? ${q}`));
    }
    const answer = await askQuestion(chalk.cyan('\n  Answer (or press Enter to skip): '));
    if (answer.trim()) {
      description += `\n\nAdditional context: ${answer}`;
    }
  }

  if (options.evaluateOnly) {
    console.log(chalk.dim('\n  (evaluate-only mode, not executing)\n'));
    return;
  }

  if (!evaluation.feasible) {
    const proceed = await askQuestion(chalk.yellow('\n  Task may not be feasible. Proceed anyway? (y/N): '));
    if (proceed.toLowerCase() !== 'y') {
      console.log(chalk.dim('\n  Task cancelled.\n'));
      return;
    }
  }

  // Step 2: Create plan
  const plan = await store.createPlan(description.slice(0, 80), description);
  console.log(chalk.dim(`\n  Created plan #${plan.id}`));

  // Step 3: Execute
  const originalBranch = await getCurrentBranch(repoRoot);
  console.log(chalk.bold('\n  Executing task...\n'));

  const result = await executeTask({
    repoRoot,
    llm,
    store,
    task: description,
    planId: plan.id,
    onToolCall: (name, input) => {
      const summary = name === 'write_file' || name === 'edit_file'
        ? (input.path as string)
        : name === 'run_command'
        ? (input.command as string).slice(0, 60)
        : name === 'read_file'
        ? (input.path as string)
        : JSON.stringify(input).slice(0, 60);
      console.log(chalk.dim(`  [${name}] ${summary}`));
    },
    onThinking: (text) => {
      // Show first line of thinking
      const firstLine = text.split('\n')[0].slice(0, 100);
      if (firstLine.trim()) {
        console.log(chalk.blue(`  > ${firstLine}`));
      }
    },
    onAskUser: async (question) => {
      return askQuestion(chalk.cyan(`\n  AI asks: ${question}\n  Your answer: `));
    },
  });

  // Show result
  console.log('');
  if (result.success) {
    console.log(chalk.green(`  Task completed successfully!`));
    console.log(chalk.dim(`  Branch: ${result.branch}`));
    if (result.commitHash) {
      console.log(chalk.dim(`  Commit: ${result.commitHash}`));
    }

    const tokenCost = (result.agentResult.totalTokens.input * 3 + result.agentResult.totalTokens.output * 15) / 1_000_000;
    console.log(chalk.dim(`  Tokens: ${result.agentResult.totalTokens.input + result.agentResult.totalTokens.output} (~$${tokenCost.toFixed(2)})`));
  } else {
    console.log(chalk.red(`  Task did not complete successfully.`));
    console.log(chalk.dim(`  Output: ${result.agentResult.output.slice(0, 200)}`));

    // Switch back to original branch
    try {
      await switchBranch(repoRoot, originalBranch);
    } catch {
      // Ignore
    }
  }

  console.log(chalk.dim(`\n  Plan saved to .zeno/plans/\n`));
}
