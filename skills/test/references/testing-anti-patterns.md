# Testing Anti-Patterns

> Mock pitfalls, test-only methods, and over-mocking patterns. Reference for agents writing or evaluating tests.

## Testing Mock Behavior

**Bad:**
```typescript
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```
You're verifying the mock exists, not that the component works.

**Fix:**
```typescript
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

**Gate:** "Am I testing real behavior or mock existence?" If mock existence → delete the assertion or unmock.

## Over-Mocking Simple Dependencies

**Bad:**
```typescript
test('retries 3 times', async () => {
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValueOnce('ok');
  await retry(fn);
  expect(fn).toHaveBeenCalledTimes(3);
});
```
Tests mock wiring and call counts. Breaks if implementation changes internals.

**Fix:**
```typescript
test('retries 3 times then succeeds', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    if (attempts < 3) throw new Error('not yet');
    return 'ok';
  };
  const result = await retry(fn);
  expect(result).toBe('ok');
  expect(attempts).toBe(3);
});
```
Real function, real counter, tests actual behavior.

**Gate:** "Can I write this as a real function instead of a mock chain?" If yes → use the real function.

## Test-Only Methods in Production

**Bad:**
```typescript
class Session {
  async destroy() {  // Only used in tests!
    await this._workspaceManager?.destroyWorkspace(this.id);
  }
}
```

**Fix:** Move to test utilities:
```typescript
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) await workspaceManager.destroyWorkspace(workspace.id);
}
```

**Gate:** "Is this method only called from test files?" If yes → it belongs in test utilities.

## Mocking Without Understanding

**Bad:**
```typescript
vi.mock('ToolCatalog', () => ({
  discoverAndCacheTools: vi.fn().mockResolvedValue(undefined)
}));
await addServer(config);
await addServer(config);  // Should throw but doesn't — mock killed the side effect
```

**Fix:** Mock only the slow/external part. Let side effects the test depends on run.

**Gate:** Before mocking: (1) What side effects does the real method have? (2) Does my test depend on any of them?

## Incomplete Mocks

**Bad:**
```typescript
const mockUser = { id: 1, name: 'Alice' };
// Downstream code accesses user.email — undefined, silent bug
renderProfile(mockUser);
```

**Fix:**
```typescript
const mockUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
renderProfile(mockUser);
```
Include all fields downstream code reads, not necessarily every field the API returns.

**Gate:** "Does my mock cover every field the code under test actually accesses?" If unsure → check the real API response shape.

## Spying on Framework Internals

**Bad:**
```typescript
const spy = vi.spyOn(global, 'setTimeout');
// ... run code ...
expect(spy).toHaveBeenCalledWith(expect.any(Function), 100);
```
Coupled to implementation. Breaks if delay mechanism changes.

**Fix:** Test the observable timing behavior:
```typescript
test('waits between retries', async () => {
  const start = Date.now();
  await retry(failThenSucceed, 2, 50);
  expect(Date.now() - start).toBeGreaterThanOrEqual(50);
});
```

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| Assert on mock elements | Test real behavior or unmock |
| Mock simple dependencies | Use real functions |
| Call count assertions | Use real counters or assert on output |
| Test-only production methods | Move to test utilities |
| Mock without understanding | Know what side effects you're killing |
| Incomplete mocks | Mirror real API structure |
| Spy on framework internals | Test observable timing/behavior |

**Red flags:** `toHaveBeenCalledTimes` as primary assertion, `vi.spyOn(global, ...)`, mock setup longer than test logic, assertions on `*-mock` test IDs, can't explain why mock is needed.
