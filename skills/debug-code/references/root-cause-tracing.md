# Root Cause Tracing

> Trace bugs backward through the call chain until you find the original trigger. Fix at the source, not the symptom.

## When to Use

- Error happens deep in execution (not at entry point)
- Stack trace shows long call chain
- Unclear where invalid data originated
- Need to find which test/code triggers the problem

## Process

**1. Observe the Symptom**
```
Error: git init failed in /Users/jesse/project/packages/core
```

**2. Find Immediate Cause — What code directly causes this?**
```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

**3. Ask: What Called This?**
```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → called by Session.initializeWorkspace()
  → called by Session.create()
  → called by test at Project.create()
```

**4. Keep Tracing Up — What value was passed?**
- `projectDir = ''` (empty string!)
- Empty string as `cwd` resolves to `process.cwd()`
- That's the source code directory!

**5. Find Original Trigger — Where did empty string come from?**
```typescript
const context = setupCoreTest(); // Returns { tempDir: '' }
Project.create('name', context.tempDir); // Accessed before beforeEach!
```

## Using Stack Traces

When you can't trace manually, add instrumentation:

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    stack,
  });
  await execFileAsync('git', ['init'], { cwd: directory });
}
```

**Tips:**
- Use `console.error()` in tests — logger may be suppressed
- Log BEFORE the dangerous operation, not after failure
- Include: directory, cwd, environment variables, timestamps
- `new Error().stack` shows complete call chain

**Run and capture:**
```bash
npm test 2>&1 | grep 'DEBUG git init'
```

## Finding Test Polluters

If something appears during tests but you don't know which test:

Use the bisection script `scripts/find-polluter.sh`:
```bash
./find-polluter.sh '.git' 'src/**/*.test.ts'
```

Runs tests one-by-one, stops at first polluter.

## Example

**Symptom:** `.git` created in `packages/core/` (source code)

**Trace chain:**
1. `git init` runs in `process.cwd()` ← empty cwd parameter
2. WorktreeManager called with empty projectDir
3. Session.create() passed empty string
4. Test accessed `context.tempDir` before beforeEach
5. setupCoreTest() returns `{ tempDir: '' }` initially

**Root cause:** Top-level variable initialisation accessing empty value

**Fix:** Made tempDir a getter that throws if accessed before beforeEach

**Also added defence-in-depth** (see `references/defense-in-depth.md`):
- Layer 1: Project.create() validates directory
- Layer 2: WorkspaceManager validates not empty
- Layer 3: NODE_ENV guard refuses git init outside tmpdir
- Layer 4: Stack trace logging before git init

## Key Principle

**NEVER fix just where the error appears.** Trace back to find the original trigger.
