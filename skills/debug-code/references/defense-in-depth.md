# Defense in Depth

> Add validation at EVERY layer data passes through. Make the bug structurally impossible, not just patched at one point.

- Single validation: "We fixed the bug"
- Multiple layers: "We made the bug impossible"

## Layers

**Layer 1: Entry Point Validation** — Reject obviously invalid input at API boundary
```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
}
```

**Layer 2: Business Logic Validation** — Ensure data makes sense for this operation
```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
}
```

**Layer 3: Environment Guards** — Prevent dangerous operations in specific contexts
```typescript
async function gitInit(directory: string) {
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));
    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
}
```

**Layer 4: Debug Instrumentation** — Capture context for forensics
```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', { directory, cwd: process.cwd(), stack });
}
```

## Process

When you find a bug:

1. **Trace the data flow** — Where does bad value originate? Where used?
2. **Map all checkpoints** — List every point data passes through
3. **Add validation at each layer** — Entry, business, environment, debug
4. **Test each layer** — Try to bypass layer 1, verify layer 2 catches it

## Why All Four Layers

All four layers are necessary. During testing, each layer catches bugs the others miss:
- Different code paths bypass entry validation
- Mocks bypass business logic checks
- Edge cases on different platforms need environment guards
- Debug logging identifies structural misuse

**Don't stop at one validation point.** Add checks at every layer.
