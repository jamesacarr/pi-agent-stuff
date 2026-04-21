import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
} from '@mariozechner/pi-coding-agent';
import { describe, expect, it } from 'vitest';

// Minimal stubs ----------------------------------------------------------

const stubCtx = (hasUI = true): ExtensionContext =>
  ({
    hasUI,
    ui: { notify: () => {} },
  }) as unknown as ExtensionContext;

const textContent = (text: string) => [{ text, type: 'text' as const }];

const toolResult = (
  toolName: string,
  text: string,
  input: Record<string, unknown> = {},
): ToolResultEvent =>
  ({
    content: textContent(text),
    input,
    isError: false,
    toolName,
  }) as unknown as ToolResultEvent;

const readResult = (path: string, text: string): ToolResultEvent =>
  toolResult('read', text, { path });

const bashResult = (text: string): ToolResultEvent => toolResult('bash', text);

// Capture the tool_result handler ----------------------------------------

type Handler = (
  event: ToolResultEvent,
  ctx: ExtensionContext,
) =>
  | { content?: Array<{ text: string; type: string }>; isError?: boolean }
  | undefined;

let handler: Handler;

const fakePi = {
  on: (eventName: string, h: Handler) => {
    if (eventName === 'tool_result') {
      handler = h;
    }
  },
};

const mod = await import('./redact-output.ts');
mod.default(fakePi as unknown as ExtensionAPI);

// Helpers ----------------------------------------------------------------

const getRedactedText = (result: ReturnType<Handler>): string | undefined =>
  result?.content?.[0]?.text;

// Tests ------------------------------------------------------------------

describe('redact-output', () => {
  describe('provider API keys', () => {
    const cases = [
      [
        'Anthropic',
        `key: sk-ant-api03-${'a'.repeat(80)}`,
        'ANTHROPIC_KEY_REDACTED',
      ],
      ['OpenAI', `key: sk-${'a'.repeat(20)}`, 'OPENAI_KEY_REDACTED'],
      ['GitHub PAT', `token: ghp_${'a'.repeat(36)}`, 'GITHUB_TOKEN_REDACTED'],
      ['GitHub OAuth', `token: gho_${'a'.repeat(36)}`, 'GITHUB_OAUTH_REDACTED'],
      ['GitLab', `token: glpat-${'a'.repeat(20)}`, 'GITLAB_TOKEN_REDACTED'],
      ['Slack', `token: xoxb-${'a'.repeat(10)}`, 'SLACK_TOKEN_REDACTED'],
      ['AWS', 'key: AKIAIOSFODNN7EXAMPLE', 'AWS_KEY_REDACTED'],
      ['Google', `key: AIzaSyA${'a'.repeat(32)}`, 'GOOGLE_KEY_REDACTED'],
      [
        'Stripe secret',
        `key: sk_live_${'a'.repeat(24)}`,
        'STRIPE_KEY_REDACTED',
      ],
      [
        'Stripe restricted',
        `key: rk_live_${'a'.repeat(24)}`,
        'STRIPE_KEY_REDACTED',
      ],
      ['Twilio', `key: SK${'a'.repeat(32)}`, 'TWILIO_KEY_REDACTED'],
      [
        'SendGrid',
        `key: SG.${'a'.repeat(22)}.${'a'.repeat(43)}`,
        'SENDGRID_KEY_REDACTED',
      ],
      ['npm', `token: npm_${'a'.repeat(36)}`, 'NPM_TOKEN_REDACTED'],
    ];

    it.each(cases)('redacts %s key', (_provider, input, expectedTag) => {
      const result = handler(bashResult(input), stubCtx());
      expect(getRedactedText(result)).toContain(expectedTag);
    });
  });

  describe('generic key/value assignments', () => {
    const redacted = [
      'password: "super-secret-password-123"',
      'api_key=abcdef123456789012345',
      'DB_PASSWORD=MyS3cretP@ssw0rd!',
      'client_secret: "a1b2c3d4e5f6g7h8"',
      'auth_token=eyJhbGciOiJIUzI1',
      'access_key: "AKIAIOSFODNN7EXAM"',
      'private_key=some_long_key_value_here',
    ];

    it.each(redacted)('redacts `%s`', input => {
      const result = handler(bashResult(input), stubCtx());
      expect(getRedactedText(result)).toContain('[REDACTED]');
      expect(getRedactedText(result)).not.toContain(
        input.split(/[=:]\s*['"]?/)[1]?.replace(/['"]$/, ''),
      );
    });

    const notRedacted = [
      'token: "short"',
      'password: "changeme"',
      'some_variable: "hello world"',
      'description: "This is a long description that should not be redacted"',
    ];

    it.each(notRedacted)('does not redact `%s`', input => {
      const result = handler(bashResult(input), stubCtx());
      expect(result).toBeUndefined();
    });
  });

  describe('auth headers and tokens', () => {
    it('redacts Bearer tokens', () => {
      const result = handler(
        bashResult(
          'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        ),
        stubCtx(),
      );
      expect(getRedactedText(result)).toContain('Bearer [REDACTED]');
    });

    it('redacts Basic auth', () => {
      const result = handler(
        bashResult('Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=aa'),
        stubCtx(),
      );
      expect(getRedactedText(result)).toContain('Basic [REDACTED]');
    });

    it('redacts JWTs', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = handler(bashResult(`token: ${jwt}`), stubCtx());
      expect(getRedactedText(result)).toContain('[JWT_REDACTED]');
      expect(getRedactedText(result)).not.toContain(jwt);
    });
  });

  describe('connection strings', () => {
    const cases = [
      ['MongoDB', 'mongodb://admin:s3cret@localhost:27017/db'],
      ['MongoDB SRV', 'mongodb+srv://admin:s3cret@cluster.example.com/db'],
      ['PostgreSQL', 'postgresql://user:password@host:5432/db'],
      ['Postgres short', 'postgres://user:password@host:5432/db'],
      ['MySQL', 'mysql://root:password@localhost:3306/db'],
      ['Redis', 'redis://default:password@redis:6379'],
      ['AMQP', 'amqp://guest:guest@localhost:5672'],
      ['AMQPS', 'amqps://user:pass@rabbit.example.com'],
    ];

    it.each(
      cases,
    )('redacts password in %s connection string', (_name, connStr) => {
      const result = handler(bashResult(connStr), stubCtx());
      const text = getRedactedText(result);
      expect(text).toContain('[REDACTED]');
      expect(text).not.toContain('s3cret');
      expect(text).not.toContain('password');
      expect(text).toContain('@');
    });
  });

  describe('private keys', () => {
    it('redacts RSA private keys', () => {
      const key =
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
      const result = handler(bashResult(key), stubCtx());
      expect(getRedactedText(result)).toBe('[PRIVATE_KEY_REDACTED]');
    });

    it('redacts generic private keys', () => {
      const key =
        '-----BEGIN PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END PRIVATE KEY-----';
      const result = handler(bashResult(key), stubCtx());
      expect(getRedactedText(result)).toBe('[PRIVATE_KEY_REDACTED]');
    });

    it('redacts OPENSSH private keys', () => {
      const key =
        '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk...\n-----END OPENSSH PRIVATE KEY-----';
      const result = handler(bashResult(key), stubCtx());
      expect(getRedactedText(result)).toBe('[PRIVATE_KEY_REDACTED]');
    });
  });

  describe('sensitive file redaction', () => {
    const sensitiveFiles = [
      '.env',
      '.env.local',
      '.env.production',
      '.dev.vars',
      'secrets.json',
      'secret.yaml',
      'secret.toml',
      'credentials',
      'credentials.json',
      '.credentials',
      'path/to/credentials.yaml',
    ];

    it.each(sensitiveFiles)('fully redacts contents of `%s`', filePath => {
      const result = handler(
        readResult(filePath, 'API_KEY=super_secret_123'),
        stubCtx(),
      );
      const text = getRedactedText(result);
      expect(text).toContain('redacted for security');
      expect(text).not.toContain('super_secret_123');
    });

    it('does not redact .env.example', () => {
      const result = handler(
        readResult('.env.example', 'API_KEY=placeholder'),
        stubCtx(),
      );
      expect(result).toBeUndefined();
    });

    const normalFiles = [
      'src/config.ts',
      'README.md',
      'package.json',
      'credentials-helper.ts',
    ];

    it.each(
      normalFiles,
    )('pattern-scans but does not fully redact `%s`', filePath => {
      const result = handler(
        readResult(filePath, 'nothing sensitive here'),
        stubCtx(),
      );
      expect(result).toBeUndefined();
    });

    const codeFiles = [
      'src/config.ts',
      'src/config.js',
      'src/config.tsx',
      'src/config.jsx',
      'src/config.mts',
      'src/config.mjs',
      'src/config.cts',
      'src/config.cjs',
    ];

    it.each(
      codeFiles,
    )('does not redact secrets in code file `%s`', filePath => {
      const result = handler(
        readResult(filePath, `const key = "sk-${'a'.repeat(20)}"`),
        stubCtx(),
      );
      expect(result).toBeUndefined();
    });

    it('still pattern-redacts secrets in non-code files', () => {
      const result = handler(
        readResult('config.yaml', `key: sk-${'a'.repeat(20)}`),
        stubCtx(),
      );
      expect(getRedactedText(result)).toContain('OPENAI_KEY_REDACTED');
    });

    const markdownFiles = [
      'README.md',
      'docs/guide.md',
      'notes.MD',
      'path/to/CHANGELOG.md',
    ];

    it.each(
      markdownFiles,
    )('does not redact secrets in Markdown file `%s`', filePath => {
      const result = handler(
        readResult(filePath, `key: sk-${'a'.repeat(20)}`),
        stubCtx(),
      );
      expect(result).toBeUndefined();
    });
  });

  describe('large output threshold', () => {
    it('skips pattern scanning for outputs over 100KB', () => {
      const largeOutput = `sk-${'a'.repeat(20)} ${'x'.repeat(100 * 1024)}`;
      const result = handler(bashResult(largeOutput), stubCtx());
      expect(result).toBeUndefined();
    });

    it('still fully redacts sensitive files regardless of size', () => {
      const largeContent = 'x'.repeat(200 * 1024);
      const result = handler(readResult('.env', largeContent), stubCtx());
      expect(getRedactedText(result)).toContain('redacted for security');
    });
  });

  describe('error results', () => {
    it('skips error results', () => {
      const event = {
        ...toolResult('bash', 'password: "leaked_secret_value"'),
        isError: true,
      } as unknown as ToolResultEvent;
      const result = handler(event, stubCtx());
      expect(result).toBeUndefined();
    });
  });

  describe('no UI', () => {
    it('still redacts without UI', () => {
      const result = handler(
        bashResult(`key: sk-${'a'.repeat(20)}`),
        stubCtx(false),
      );
      expect(getRedactedText(result)).toContain('OPENAI_KEY_REDACTED');
    });
  });
});
