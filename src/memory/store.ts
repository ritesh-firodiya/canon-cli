import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  ensureZenoDir,
  getZenoDir,
  readJsonFile,
  writeJsonFile,
  writeMarkdownFile,
} from '../utils/config.js';
import type {
  ZenoConfig,
  StackInfo,
  FileEntry,
  PatternInfo,
  ConventionInfo,
  DomainConcept,
  SkillsInfo,
  PlansIndex,
  PlanMeta,
} from '../types/index.js';
import type { ScanResult } from '../scanner/index.js';

export class MemoryStore {
  private zenoDir: string;

  constructor(private repoRoot: string) {
    this.zenoDir = getZenoDir(repoRoot);
  }

  async initialize(): Promise<void> {
    await ensureZenoDir(this.repoRoot);
  }

  // Config
  async getConfig(): Promise<ZenoConfig | null> {
    return readJsonFile(join(this.zenoDir, 'config.json'));
  }

  async saveConfig(config: ZenoConfig): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'config.json'), config);
  }

  // Stack
  async getStack(): Promise<StackInfo | null> {
    return readJsonFile(join(this.zenoDir, 'memory', 'stack.json'));
  }

  async saveStack(stack: StackInfo): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'memory', 'stack.json'), stack);
  }

  // Files
  async getFiles(): Promise<FileEntry[] | null> {
    return readJsonFile(join(this.zenoDir, 'memory', 'files.json'));
  }

  async saveFiles(files: FileEntry[]): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'memory', 'files.json'), files);
  }

  // Patterns
  async getPatterns(): Promise<PatternInfo[] | null> {
    return readJsonFile(join(this.zenoDir, 'patterns', 'patterns.json'));
  }

  async savePatterns(patterns: PatternInfo[]): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'patterns', 'patterns.json'), patterns);
  }

  // Conventions
  async getConventions(): Promise<ConventionInfo[] | null> {
    return readJsonFile(join(this.zenoDir, 'patterns', 'conventions.json'));
  }

  async saveConventions(conventions: ConventionInfo[]): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'patterns', 'conventions.json'), conventions);
  }

  // Domain
  async getDomain(): Promise<DomainConcept[] | null> {
    return readJsonFile(join(this.zenoDir, 'memory', 'domain.json'));
  }

  async saveDomain(domain: DomainConcept[]): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'memory', 'domain.json'), domain);
  }

  // Skills
  async getSkills(): Promise<SkillsInfo | null> {
    return readJsonFile(join(this.zenoDir, 'skills', 'skills.json'));
  }

  async saveSkills(skills: SkillsInfo): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'skills', 'skills.json'), skills);
  }

  // Architecture doc
  async saveArchitectureDoc(content: string): Promise<void> {
    await writeMarkdownFile(join(this.zenoDir, 'docs', 'architecture.md'), content);
  }

  async getArchitectureDoc(): Promise<string | null> {
    const filePath = join(this.zenoDir, 'docs', 'architecture.md');
    if (!existsSync(filePath)) return null;
    return readFile(filePath, 'utf-8');
  }

  // Plans
  async getPlansIndex(): Promise<PlansIndex> {
    const index = await readJsonFile<PlansIndex>(join(this.zenoDir, 'plans', 'plans-index.json'));
    return index ?? { plans: [], nextId: 1 };
  }

  async savePlansIndex(index: PlansIndex): Promise<void> {
    await writeJsonFile(join(this.zenoDir, 'plans', 'plans-index.json'), index);
  }

  async createPlan(title: string, requirement: string): Promise<PlanMeta> {
    const index = await this.getPlansIndex();
    const id = String(index.nextId).padStart(3, '0');

    const plan: PlanMeta = {
      id,
      title,
      status: 'pending',
      created: new Date().toISOString().split('T')[0],
      related: [],
      summary: requirement,
    };

    index.plans.push(plan);
    index.nextId++;
    await this.savePlansIndex(index);

    // Write plan markdown file
    const planContent = `---
id: ${id}
title: ${title}
status: pending
created: ${plan.created}
branch:
related: []
---

## Requirement
${requirement}

## Clarifications

## Technical Plan

## Outcome
`;
    await writeMarkdownFile(join(this.zenoDir, 'plans', `${id}-${slugify(title)}.md`), planContent);

    return plan;
  }

  async updatePlanStatus(id: string, status: PlanMeta['status'], branch?: string): Promise<void> {
    const index = await this.getPlansIndex();
    const plan = index.plans.find((p) => p.id === id);
    if (plan) {
      plan.status = status;
      if (branch) plan.branch = branch;
      await this.savePlansIndex(index);
    }
  }

  // Save entire scan result
  async saveScanResult(scan: ScanResult): Promise<void> {
    await this.saveFiles(scan.files);
    await this.saveStack(scan.stack);

    // Derive skills from stack
    const skills: SkillsInfo = {
      languages: scan.stack.languages,
      frameworks: scan.stack.frameworks,
      tools: [...scan.stack.buildTools, ...scan.stack.linting, ...scan.stack.testing],
      domains: [],
    };
    await this.saveSkills(skills);
  }

  // Get a summary of all memory for LLM context
  async getSummary(): Promise<string> {
    const config = await this.getConfig();
    const stack = await this.getStack();
    const files = await this.getFiles();
    const patterns = await this.getPatterns();
    const conventions = await this.getConventions();
    const arch = await this.getArchitectureDoc();

    const parts: string[] = [];

    if (config) {
      parts.push(`## Project Config\nLast scanned: ${config.lastSyncAt}`);
    }

    if (stack) {
      parts.push(`## Tech Stack\n- Languages: ${stack.languages.join(', ')}\n- Frameworks: ${stack.frameworks.join(', ')}\n- Databases: ${stack.databases.join(', ')}\n- Testing: ${stack.testing.join(', ')}\n- Build: ${stack.buildTools.join(', ')}`);
    }

    if (files) {
      parts.push(`## File Structure\n${files.length} files total\nTop directories: ${[...new Set(files.map((f) => f.path.split('/')[0]))].slice(0, 20).join(', ')}`);
    }

    if (patterns && patterns.length > 0) {
      parts.push(`## Patterns\n${patterns.map((p) => `- ${p.category}: ${p.description}`).join('\n')}`);
    }

    if (conventions && conventions.length > 0) {
      parts.push(`## Conventions\n${conventions.map((c) => `- ${c.category}: ${c.rule}`).join('\n')}`);
    }

    if (arch) {
      parts.push(`## Architecture\n${arch}`);
    }

    return parts.join('\n\n');
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
