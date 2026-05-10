import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from '@earendil-works/pi-coding-agent';

// ---------------------------------------------------------------------------
// Sensitive patterns — redact tokens, keys, and credentials from tool output
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  // Provider API keys
  {
    pattern: /\b(sk-ant-api03-[a-zA-Z0-9_-]{80,})\b/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
  },
  {
    pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g,
    replacement: '[OPENAI_KEY_REDACTED]',
  },
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
  },
  {
    pattern: /\b(gho_[a-zA-Z0-9]{36,})\b/g,
    replacement: '[GITHUB_OAUTH_REDACTED]',
  },
  {
    pattern: /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g,
    replacement: '[GITLAB_TOKEN_REDACTED]',
  },
  {
    pattern: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g,
    replacement: '[SLACK_TOKEN_REDACTED]',
  },
  { pattern: /\b(AKIA[A-Z0-9]{16})\b/g, replacement: '[AWS_KEY_REDACTED]' },
  {
    pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    replacement: '[GOOGLE_KEY_REDACTED]',
  },
  {
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    replacement: '[STRIPE_KEY_REDACTED]',
  },
  {
    pattern: /\b(rk_live_[a-zA-Z0-9]{24,})\b/g,
    replacement: '[STRIPE_KEY_REDACTED]',
  },
  { pattern: /\b(SK[a-f0-9]{32})\b/g, replacement: '[TWILIO_KEY_REDACTED]' },
  {
    pattern: /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/g,
    replacement: '[SENDGRID_KEY_REDACTED]',
  },
  {
    pattern: /\b(npm_[a-zA-Z0-9]{36})\b/g,
    replacement: '[NPM_TOKEN_REDACTED]',
  },

  // Auth headers and tokens (before generic key/value to avoid re-redaction)
  {
    pattern: /\b(bearer)\s+([a-zA-Z0-9._-]{20,})\b/gi,
    replacement: 'Bearer [REDACTED]',
  },
  {
    pattern: /\b(basic)\s+([A-Za-z0-9+/=]{20,})\b/gi,
    replacement: 'Basic [REDACTED]',
  },
  {
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/g,
    replacement: '[JWT_REDACTED]',
  },

  // Generic key/value assignments
  //
  // Key side: common credential field names including compound variants.
  // Value side: 12+ chars, excluding brackets to avoid re-redacting
  // values already replaced by specific patterns above.
  {
    pattern:
      /\b(\w*(?:api[_-]?key|secret|token|password|passwd|pwd|auth[_-]?key|access[_-]?key|private[_-]?key|credentials?))\s*[=:]\s*['"]?([^\s'"[]{12,})['"]?/gi,
    replacement: '$1=[REDACTED]',
  },

  // Connection strings (redact password portion)
  {
    pattern: /(mongodb(\+srv)?:\/\/[^:]+:)[^@]+(@)/gi,
    replacement: '$1[REDACTED]$3',
  },
  {
    pattern: /(postgres(ql)?:\/\/[^:]+:)[^@]+(@)/gi,
    replacement: '$1[REDACTED]$3',
  },
  { pattern: /(mysql:\/\/[^:]+:)[^@]+(@)/gi, replacement: '$1[REDACTED]$2' },
  { pattern: /(redis:\/\/[^:]+:)[^@]+(@)/gi, replacement: '$1[REDACTED]$2' },
  { pattern: /(amqps?:\/\/[^:]+:)[^@]+(@)/gi, replacement: '$1[REDACTED]$2' },

  // Private keys
  {
    pattern:
      /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
  },
];

// ---------------------------------------------------------------------------
// Sensitive files — fully redact contents when read
// ---------------------------------------------------------------------------

const SENSITIVE_FILES = [
  /\.env$/,
  /\.env\.(?!example$)[^/]+$/,
  /\.dev\.vars($|\.[^/]+$)/,
  /secrets?\.(json|ya?ml|toml)$/i,
  /(?:^|\/)\.?credentials(?:\.[^/]*)?$/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TextContent = { type: 'text'; text: string };

/** Matches the shape returned by tool_result handlers. */
type FilterResult = {
  content?: Array<{ type: 'text'; text: string }>;
  details?: unknown;
  isError?: boolean;
};

const notify = (
  ctx: ExtensionContext,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
) => {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  }
};

/** Skip pattern scanning above this threshold — regex cost becomes significant. */
const MAX_SCAN_BYTES = 10 * 1024 * 1024;

const redactText = (
  text: string,
  ctx: ExtensionContext,
): { modified: boolean; text: string } => {
  if (text.length > MAX_SCAN_BYTES) {
    notify(
      ctx,
      `⚠️  Output exceeds ${MAX_SCAN_BYTES} bytes — skipping pattern redaction`,
      'warning',
    );
    return { modified: false, text };
  }

  let modified = false;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexes reused across calls
    pattern.lastIndex = 0;
    const result = text.replace(pattern, replacement);

    if (result !== text) {
      modified = true;
      text = result;
    }
  }

  return { modified, text };
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Files where pattern redaction is skipped — false positives outweigh risk. */
const NON_SENSITIVE_FILES = [
  /\.[cm]?[jt]sx?$/, // JS/TS source — code literals trip generic patterns
  /\.md$/i, // Markdown — documentation, not secrets
];

const filterReadOutput = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
): FilterResult | undefined => {
  const filePath = typeof event.input.path === 'string' ? event.input.path : '';

  // Don't redact .env.example files
  if (/(^|\/)\.env\.example$/i.test(filePath)) {
    return;
  }

  // Skip pattern redaction for files where false positives outweigh risk
  if (NON_SENSITIVE_FILES.some(pattern => pattern.test(filePath))) {
    return;
  }

  // Fully redact known sensitive files
  for (const pattern of SENSITIVE_FILES) {
    if (pattern.test(filePath)) {
      notify(ctx, `🔒 Redacted contents of sensitive file: ${filePath}`);
      return {
        content: [
          {
            text: `[Contents of ${filePath} redacted for security]`,
            type: 'text',
          },
        ],
      };
    }
  }

  // Pattern-based redaction on file contents
  return redactToolOutput(event, ctx);
};

// ---------------------------------------------------------------------------
// Bash guard — best-effort detection of commands that read sensitive files
// ---------------------------------------------------------------------------

/** Tokenise a bash command for path inspection. Best-effort, not a shell parser. */
const tokeniseCommand = (command: string): string[] =>
  command.split(/[\s"'`;|&<>()=]+/).filter(Boolean);

const commandReferencesSensitiveFile = (command: string): boolean => {
  const tokens = tokeniseCommand(command);

  return tokens.some(token => {
    if (/(^|\/)\.env\.example$/i.test(token)) {
      return false;
    }
    return SENSITIVE_FILES.some(pattern => pattern.test(token));
  });
};

const filterBashOutput = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
): FilterResult | undefined => {
  const command =
    typeof event.input.command === 'string' ? event.input.command : '';

  if (commandReferencesSensitiveFile(command)) {
    notify(ctx, `🔒 Redacted output of command referencing sensitive file`);
    return {
      content: [
        {
          text: '[Output redacted for security: command references a sensitive file]',
          type: 'text',
        },
      ],
    };
  }

  return redactToolOutput(event, ctx);
};

const redactToolOutput = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
): FilterResult | undefined => {
  const textBlocks = event.content.filter(
    (c): c is TextContent => c.type === 'text',
  );

  if (textBlocks.length === 0) {
    return;
  }

  let anyModified = false;
  const redactedBlocks: TextContent[] = textBlocks.map(block => {
    const { text, modified } = redactText(block.text, ctx);
    if (modified) {
      anyModified = true;
    }
    return { text, type: 'text' };
  });

  if (anyModified) {
    notify(ctx, '🔒 Sensitive data redacted from output');
    return { content: redactedBlocks };
  }
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default (pi: ExtensionAPI) => {
  pi.on('tool_result', (event, ctx) => {
    if (event.isError) {
      return;
    }

    if (event.toolName === 'read') {
      return filterReadOutput(event, ctx);
    }

    if (event.toolName === 'bash') {
      return filterBashOutput(event, ctx);
    }

    return redactToolOutput(event, ctx);
  });
};
