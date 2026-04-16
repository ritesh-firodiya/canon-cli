import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { StackInfo, FileEntry } from '../types/index.js';

interface DetectionRule {
  file: string;
  detect: (content: string, files: FileEntry[]) => Partial<StackInfo>;
}

const DETECTION_RULES: DetectionRule[] = [
  {
    file: 'package.json',
    detect: (content) => {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const info: Partial<StackInfo> = {
        languages: [],
        frameworks: [],
        buildTools: [],
        packageManagers: [],
        testing: [],
        linting: [],
      };

      // Frameworks
      if (allDeps['react']) info.frameworks!.push('react');
      if (allDeps['next']) info.frameworks!.push('nextjs');
      if (allDeps['vue']) info.frameworks!.push('vue');
      if (allDeps['nuxt']) info.frameworks!.push('nuxt');
      if (allDeps['svelte']) info.frameworks!.push('svelte');
      if (allDeps['express']) info.frameworks!.push('express');
      if (allDeps['fastify']) info.frameworks!.push('fastify');
      if (allDeps['nestjs'] || allDeps['@nestjs/core']) info.frameworks!.push('nestjs');
      if (allDeps['hono']) info.frameworks!.push('hono');
      if (allDeps['remix'] || allDeps['@remix-run/node']) info.frameworks!.push('remix');
      if (allDeps['astro']) info.frameworks!.push('astro');

      // Build tools
      if (allDeps['vite']) info.buildTools!.push('vite');
      if (allDeps['webpack']) info.buildTools!.push('webpack');
      if (allDeps['esbuild']) info.buildTools!.push('esbuild');
      if (allDeps['rollup']) info.buildTools!.push('rollup');
      if (allDeps['turbo'] || allDeps['@turbo/gen']) info.buildTools!.push('turborepo');
      if (allDeps['tsx']) info.buildTools!.push('tsx');

      // Testing
      if (allDeps['jest']) info.testing!.push('jest');
      if (allDeps['vitest']) info.testing!.push('vitest');
      if (allDeps['mocha']) info.testing!.push('mocha');
      if (allDeps['cypress']) info.testing!.push('cypress');
      if (allDeps['playwright'] || allDeps['@playwright/test']) info.testing!.push('playwright');

      // Linting
      if (allDeps['eslint']) info.linting!.push('eslint');
      if (allDeps['prettier']) info.linting!.push('prettier');
      if (allDeps['biome'] || allDeps['@biomejs/biome']) info.linting!.push('biome');

      // Databases
      const databases: string[] = [];
      if (allDeps['prisma'] || allDeps['@prisma/client']) databases.push('prisma');
      if (allDeps['mongoose'] || allDeps['mongodb']) databases.push('mongodb');
      if (allDeps['pg'] || allDeps['postgres']) databases.push('postgresql');
      if (allDeps['mysql2']) databases.push('mysql');
      if (allDeps['redis'] || allDeps['ioredis']) databases.push('redis');
      if (allDeps['drizzle-orm']) databases.push('drizzle');
      if (allDeps['typeorm']) databases.push('typeorm');
      if (allDeps['sequelize']) databases.push('sequelize');
      if (databases.length > 0) info.databases = databases;

      // Languages
      if (allDeps['typescript']) info.languages!.push('typescript');
      info.languages!.push('javascript');

      return info;
    },
  },
  {
    file: 'requirements.txt',
    detect: (content) => {
      const info: Partial<StackInfo> = { languages: ['python'], frameworks: [], testing: [] };
      if (content.includes('django')) info.frameworks!.push('django');
      if (content.includes('flask')) info.frameworks!.push('flask');
      if (content.includes('fastapi')) info.frameworks!.push('fastapi');
      if (content.includes('pytest')) info.testing!.push('pytest');
      return info;
    },
  },
  {
    file: 'go.mod',
    detect: (content) => {
      const info: Partial<StackInfo> = { languages: ['go'], frameworks: [] };
      if (content.includes('gin-gonic')) info.frameworks!.push('gin');
      if (content.includes('echo')) info.frameworks!.push('echo');
      if (content.includes('fiber')) info.frameworks!.push('fiber');
      return info;
    },
  },
  {
    file: 'Cargo.toml',
    detect: (content) => {
      const info: Partial<StackInfo> = { languages: ['rust'], frameworks: [] };
      if (content.includes('actix')) info.frameworks!.push('actix');
      if (content.includes('axum')) info.frameworks!.push('axum');
      if (content.includes('rocket')) info.frameworks!.push('rocket');
      return info;
    },
  },
  {
    file: 'Gemfile',
    detect: (content) => {
      const info: Partial<StackInfo> = { languages: ['ruby'], frameworks: [] };
      if (content.includes('rails')) info.frameworks!.push('rails');
      if (content.includes('sinatra')) info.frameworks!.push('sinatra');
      return info;
    },
  },
];

const FILE_INDICATORS: Record<string, (info: Partial<StackInfo>) => void> = {
  'Dockerfile': (info) => { info.containerization = [...(info.containerization || []), 'docker']; },
  'docker-compose.yml': (info) => { info.containerization = [...(info.containerization || []), 'docker-compose']; },
  'docker-compose.yaml': (info) => { info.containerization = [...(info.containerization || []), 'docker-compose']; },
  '.github/workflows': (info) => { info.ci = [...(info.ci || []), 'github-actions']; },
  '.gitlab-ci.yml': (info) => { info.ci = [...(info.ci || []), 'gitlab-ci']; },
  'Jenkinsfile': (info) => { info.ci = [...(info.ci || []), 'jenkins']; },
  '.circleci/config.yml': (info) => { info.ci = [...(info.ci || []), 'circleci']; },
  'vercel.json': (info) => { info.ci = [...(info.ci || []), 'vercel']; },
  'netlify.toml': (info) => { info.ci = [...(info.ci || []), 'netlify']; },
  'pnpm-workspace.yaml': (info) => { info.packageManagers = [...(info.packageManagers || []), 'pnpm']; },
  'yarn.lock': (info) => { info.packageManagers = [...(info.packageManagers || []), 'yarn']; },
  'pnpm-lock.yaml': (info) => { info.packageManagers = [...(info.packageManagers || []), 'pnpm']; },
  'bun.lockb': (info) => { info.packageManagers = [...(info.packageManagers || []), 'bun']; },
};

export async function detectStack(repoRoot: string, files: FileEntry[]): Promise<StackInfo> {
  const result: StackInfo = {
    languages: [],
    frameworks: [],
    buildTools: [],
    packageManagers: [],
    databases: [],
    testing: [],
    linting: [],
    ci: [],
    containerization: [],
    detected: {},
  };

  // Run detection rules
  for (const rule of DETECTION_RULES) {
    const filePath = join(repoRoot, rule.file);
    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const detected = rule.detect(content, files);
        result.detected[rule.file] = Object.values(detected).flat().filter(Boolean).join(', ');
        mergeStackInfo(result, detected);
      } catch {
        // Skip files that can't be parsed
      }
    }
  }

  // Check file indicators
  for (const [file, apply] of Object.entries(FILE_INDICATORS)) {
    if (existsSync(join(repoRoot, file))) {
      apply(result);
      result.detected[file] = 'present';
    }
  }

  // Default package manager for JS projects
  if (result.languages.includes('javascript') || result.languages.includes('typescript')) {
    if (result.packageManagers.length === 0) {
      if (existsSync(join(repoRoot, 'package-lock.json'))) {
        result.packageManagers.push('npm');
      }
    }
  }

  // Deduplicate all arrays
  for (const key of Object.keys(result) as (keyof StackInfo)[]) {
    if (Array.isArray(result[key])) {
      (result[key] as string[]) = [...new Set(result[key] as string[])];
    }
  }

  return result;
}

function mergeStackInfo(target: StackInfo, source: Partial<StackInfo>): void {
  for (const key of Object.keys(source) as (keyof StackInfo)[]) {
    const val = source[key];
    if (Array.isArray(val)) {
      (target[key] as string[]).push(...val);
    }
  }
}
