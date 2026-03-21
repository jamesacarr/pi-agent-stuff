import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from '@mariozechner/pi-coding-agent';

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

const findTextContent = (
  content: ToolResultEvent['content'],
): TextContent | undefined =>
  content.find((c): c is TextContent => c.type === 'text');

const notify = (ctx: ExtensionContext, message: string) => {
  if (ctx.hasUI) {
    ctx.ui.notify(message, 'info');
  }
};

/** Skip pattern scanning above this threshold — rely on sensitive file detection instead. */
const MAX_SCAN_BYTES = 100 * 1024;

const redactText = (text: string): { modified: boolean; text: string } => {
  if (text.length > MAX_SCAN_BYTES) {
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

/** JS/TS source files — skip pattern redaction to avoid false positives in code. */
const CODE_FILE = /\.[cm]?[jt]sx?$/;

const filterReadOutput = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
): FilterResult | undefined => {
  const filePath = typeof event.input.path === 'string' ? event.input.path : '';

  // Don't redact .env.example files
  if (/(^|\/)\.env\.example$/i.test(filePath)) {
    return;
  }

  // Don't redact JS/TS source files — too many false positives in code
  if (CODE_FILE.test(filePath)) {
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

const redactToolOutput = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
): FilterResult | undefined => {
  const textContent = findTextContent(event.content);

  if (!textContent) {
    return;
  }

  const { text, modified } = redactText(textContent.text);

  if (modified) {
    notify(ctx, '🔒 Sensitive data redacted from output');
    return { content: [{ text, type: 'text' }] };
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

    return redactToolOutput(event, ctx);
  });
};
