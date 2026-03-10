import { execFileSync } from 'node:child_process';

const output = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
  {
    encoding: 'utf8',
  },
);

const files = output
  .split('\0')
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith('.husky/_/'));

if (files.length === 0) {
  process.exit(0);
}

// Auto-format staged files and re-stage so commits are never blocked by style.
execFileSync(
  'pnpm',
  ['exec', 'prettier', '--write', '--ignore-unknown', ...files],
  {
    stdio: 'inherit',
  },
);
execFileSync('git', ['add', ...files]);
