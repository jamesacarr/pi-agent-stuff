import { describe, expect, it } from 'vitest';

import { formatAnswers } from './formatting.ts';

describe('formatAnswers', () => {
  it('formats a single question and answer', () => {
    const result = formatAnswers(
      [{ question: 'What database?' }],
      ['PostgreSQL'],
    );
    expect(result).toBe('Q: What database?\nA: PostgreSQL');
  });

  it('formats multiple questions and answers', () => {
    const result = formatAnswers(
      [{ question: 'Language?' }, { question: 'Framework?' }],
      ['TypeScript', 'React'],
    );
    expect(result).toBe(
      'Q: Language?\nA: TypeScript\n\nQ: Framework?\nA: React',
    );
  });

  it('includes context when present', () => {
    const result = formatAnswers(
      [{ context: 'Only MySQL or Postgres supported', question: 'Which DB?' }],
      ['Postgres'],
    );
    expect(result).toBe(
      'Q: Which DB?\n> Only MySQL or Postgres supported\nA: Postgres',
    );
  });

  it('uses "(no answer)" for empty answers', () => {
    const result = formatAnswers([{ question: 'Colour?' }], ['']);
    expect(result).toBe('Q: Colour?\nA: (no answer)');
  });

  it('uses "(no answer)" for whitespace-only answers', () => {
    const result = formatAnswers([{ question: 'Colour?' }], ['   ']);
    expect(result).toBe('Q: Colour?\nA: (no answer)');
  });

  it('uses "(no answer)" when answer is missing from array', () => {
    const result = formatAnswers(
      [{ question: 'First?' }, { question: 'Second?' }],
      ['Yes'],
    );
    expect(result).toBe('Q: First?\nA: Yes\n\nQ: Second?\nA: (no answer)');
  });

  it('trims whitespace from answers', () => {
    const result = formatAnswers([{ question: 'Name?' }], ['  James  ']);
    expect(result).toBe('Q: Name?\nA: James');
  });
});
