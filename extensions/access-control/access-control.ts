import * as path from 'node:path';

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from '@mariozechner/pi-coding-agent';
import { isToolCallEventType } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Dangerous commands (bash only — confirmation prompt)
// ---------------------------------------------------------------------------

const DANGEROUS_COMMANDS = [
  { desc: 'recursive delete', pattern: /\brm\s+(-[^\s]*r|--recursive)/ },
  { desc: 'find -delete', pattern: /\bfind\b.*-delete\b/ },
  { desc: 'shred', pattern: /\bshred\b/ },
  { desc: 'truncate', pattern: /\btruncate\b/ },
  { desc: 'remote code execution', pattern: /\b(curl|wget)\b.*\|\s*(ba)?sh\b/ },
  { desc: 'broad process kill', pattern: /\b(pkill|killall)\b/ },
  { desc: 'git clean', pattern: /\bgit\s+clean\b.*-[^\s]*f/ },
  { desc: 'sudo command', pattern: /\bsudo\b/ },
  { desc: 'dangerous permissions', pattern: /\b(chmod|chown)\b.*777/ },
  { desc: 'filesystem format', pattern: /\b(mkfs|wipefs)\b/ },
  { desc: 'partition table', pattern: /\b(fdisk|parted|gdisk)\b/ },
  { desc: 'raw device write', pattern: /\bdd\b.*\bof=\/dev\// },
  { desc: 'raw device overwrite', pattern: />\s*\/dev\/sd[a-z]/ },
  { desc: 'kill all processes', pattern: /\bkill\s+-9\s+-1\b/ },
  { desc: 'fork bomb', pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/ },
];

// ---------------------------------------------------------------------------
// Protected paths (single source of truth)
// ---------------------------------------------------------------------------

type ProtectedPath = {
  desc: string;
  pattern: RegExp;
  /** Block reads (secrets leaking into LLM context). */
  blockReads?: boolean;
  /** Detect as bash write target via redirect/cp/mv/tee extraction. */
  blockBashWrites?: boolean;
};

const PROTECTED_PATHS: ProtectedPath[] = [
  {
    blockBashWrites: true,
    blockReads: true,
    desc: 'environment file',
    pattern: /\.env($|\.(?!example))/,
  },
  {
    blockBashWrites: true,
    blockReads: true,
    desc: 'dev vars file',
    pattern: /\.dev\.vars($|\.[^/]+$)/,
  },
  { desc: 'node_modules', pattern: /node_modules\// },
  { desc: 'git directory', pattern: /^\.git\/|\/\.git\// },
  {
    blockBashWrites: true,
    blockReads: true,
    desc: 'private key file',
    pattern: /\.pem$|\.key$/,
  },
  { blockReads: true, desc: 'SSH key', pattern: /id_rsa|id_ed25519|id_ecdsa/ },
  { blockReads: true, desc: '.ssh directory', pattern: /\.ssh\// },
  {
    blockBashWrites: true,
    blockReads: true,
    desc: 'secrets file',
    pattern: /secrets?\.(json|ya?ml|toml)$/i,
  },
  {
    blockReads: true,
    desc: 'credentials file',
    pattern: /(?:^|\/)\.?credentials(?:\.[^/]*)?$/i,
  },
];

const SOFT_PROTECTED_PATHS = [
  { desc: 'package-lock.json', pattern: /package-lock\.json$/ },
  { desc: 'yarn.lock', pattern: /yarn\.lock$/ },
  { desc: 'pnpm-lock.yaml', pattern: /pnpm-lock\.yaml$/ },
];

// ---------------------------------------------------------------------------
// Bash write target extraction
//
// Best-effort heuristic — variable indirection, subshells, and encoding
// can bypass detection. This is defence in depth, not a security boundary.
// ---------------------------------------------------------------------------

const extractBashWriteTargets = (command: string): string[] => {
  // Patterns that capture a single target in group 1
  const singleTargetPatterns = [
    />\s*(\S+)/g,
    /\bcp\s+(?:-\S+\s+)*\S+\s+(\S+)/g,
    /\bmv\s+(?:-\S+\s+)*\S+\s+(\S+)/g,
    /\binstall\s+.*\s(\S+)\s*$/g,
    /\bln\s+(?:-\S+\s+)*\S+\s+(\S+)/g,
    /\bscp\s+(?:-\S+\s+)*\S+\s+(\S+)/g,
    /\brsync\s+(?:-\S+\s+)*\S+\s+(\S+)/g,
    /\bsed\s+(?:-\S+\s+)*(?:"[^"]*"|'[^']*'|\S+)\s+(\S+)/g,
    /\bperl\s+(?:-\S+\s+)*(?:"[^"]*"|'[^']*'|\S+)\s+(\S+)/g,
    /\bcurl\s+(?:-\S+\s+)*(?:-[A-Za-z]*o|--output)\s+(\S+)/g,
    /\bwget\s+(?:-\S+\s+)*(?:-[A-Za-z]*O|--output-document)\s+(\S+)/g,
  ];

  // tee captures all trailing non-option arguments
  const teePattern = /\btee\s+(.*)/;

  const targets: string[] = [];

  for (const pattern of singleTargetPatterns) {
    for (const match of command.matchAll(pattern)) {
      if (match[1]) {
        targets.push(match[1]);
      }
    }
  }

  const teeMatch = command.match(teePattern);
  if (teeMatch) {
    const args = teeMatch[1].split(/\s+/).filter(Boolean);
    for (const arg of args) {
      if (!arg.startsWith('-')) {
        targets.push(arg);
      }
    }
  }

  return targets;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Matches the shape returned by tool_call handlers. */
type BlockResult = {
  block?: boolean;
  reason?: string;
};

type AuditLogger = (tool: string, reason: string) => void;

const BLOCK_SUFFIX =
  '\n\nDO NOT attempt to work around this restriction. DO NOT retry with alternative commands, paths, or approaches that achieve the same result. Report this block to the user exactly as stated and ask how they would like to proceed.';

const findProtectedPath = (
  filePath: string,
  filter: (p: ProtectedPath) => boolean,
): ProtectedPath | undefined => {
  const normalised = path.normalize(filePath);
  return PROTECTED_PATHS.filter(filter).find(p => p.pattern.test(normalised));
};

const block = (
  ctx: ExtensionContext,
  reason: string,
  notification?: string,
): BlockResult => {
  if (ctx.hasUI && notification) {
    ctx.ui.notify(notification, 'warning');
  }

  return { block: true, reason: reason + BLOCK_SUFFIX };
};

// ---------------------------------------------------------------------------
// Per-tool guards
// ---------------------------------------------------------------------------

const guardSearch = (
  filePath: string,
  ctx: ExtensionContext,
): BlockResult | undefined => {
  const hit = findProtectedPath(filePath, p => p.blockReads === true);

  if (hit) {
    return block(
      ctx,
      `Search over protected path: ${hit.desc}`,
      `🛡️ Blocked search over ${hit.desc}: ${filePath}`,
    );
  }
};

const guardBash = async (
  command: string,
  ctx: ExtensionContext,
): Promise<BlockResult | undefined> => {
  // Dangerous commands — collect all matches, prompt once
  const matches = DANGEROUS_COMMANDS.filter(({ pattern }) =>
    pattern.test(command),
  );

  if (matches.length > 0) {
    const descriptions = matches.map(m => m.desc).join(', ');

    if (!ctx.hasUI) {
      return block(ctx, `Blocked: ${descriptions} (no UI to confirm)`);
    }

    const ok = await ctx.ui.confirm(
      `⚠️ Dangerous command: ${descriptions}`,
      command,
    );

    if (!ok) {
      return block(ctx, `Blocked by user: ${descriptions}`);
    }
  }

  // Bash write targets — test against protected paths
  for (const target of extractBashWriteTargets(command)) {
    const hit = findProtectedPath(target, p => p.blockBashWrites === true);

    if (hit) {
      return block(
        ctx,
        `Bash write to protected path: ${hit.desc}`,
        `🛡️ Blocked bash write to ${hit.desc}: ${target}`,
      );
    }
  }
};

const guardRead = (
  filePath: string,
  ctx: ExtensionContext,
): BlockResult | undefined => {
  const hit = findProtectedPath(filePath, p => p.blockReads === true);

  if (hit) {
    return block(
      ctx,
      `Protected path: ${hit.desc}`,
      `🛡️ Blocked read of ${hit.desc}: ${filePath}`,
    );
  }
};

const guardWrite = async (
  filePath: string,
  ctx: ExtensionContext,
): Promise<BlockResult | undefined> => {
  const hit = findProtectedPath(filePath, () => true);

  if (hit) {
    return block(
      ctx,
      `Protected path: ${hit.desc}`,
      `🛡️ Blocked write to ${hit.desc}: ${filePath}`,
    );
  }

  for (const { pattern, desc } of SOFT_PROTECTED_PATHS) {
    if (!pattern.test(path.normalize(filePath))) {
      continue;
    }

    if (!ctx.hasUI) {
      return block(ctx, `Protected path (no UI): ${desc}`);
    }

    const ok = await ctx.ui.confirm(
      `⚠️ Modifying ${desc}`,
      `Are you sure you want to modify ${filePath}?`,
    );

    if (!ok) {
      return block(ctx, `User blocked write to ${desc}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

type GuardResult = BlockResult | undefined;

const guardToolCall = (
  event: ToolCallEvent,
  ctx: ExtensionContext,
): Promise<GuardResult> | GuardResult => {
  if (isToolCallEventType('bash', event)) {
    return guardBash(event.input.command, ctx);
  }
  if (isToolCallEventType('read', event)) {
    return guardRead(event.input.path, ctx);
  }
  if (isToolCallEventType('edit', event)) {
    return guardWrite(event.input.path, ctx);
  }
  if (isToolCallEventType('write', event)) {
    return guardWrite(event.input.path, ctx);
  }
  if (isToolCallEventType('grep', event)) {
    return guardSearch(event.input.path ?? '.', ctx);
  }
  if (isToolCallEventType('find', event)) {
    return guardSearch(event.input.path ?? '.', ctx);
  }
  if (isToolCallEventType('ls', event)) {
    return guardSearch(event.input.path ?? '.', ctx);
  }
};

export default (pi: ExtensionAPI) => {
  const log: AuditLogger = (tool, reason) => {
    pi.appendEntry('access-control-log', { reason, tool });
  };

  pi.on('tool_call', async (event, ctx) => {
    const result = await guardToolCall(event, ctx);

    if (result?.block) {
      log(event.toolName, result.reason ?? 'unknown');
    }

    return result;
  });
};
