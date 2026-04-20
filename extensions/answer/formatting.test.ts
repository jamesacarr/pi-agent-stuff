import { describe, expect, it } from 'vitest';

import { formatAnswers } from './formatting.ts';

describe('formatAnswers', () => {
  it('formats a single question and answer', () => {
    const result = formatAnswers(
      [{ question: 'What database?' }],
      ['PostgreSQL'],
    );
    expect(result).toBe('**Q:** What database?\n**A:** PostgreSQL');
  });

  it('formats multiple questions and answers', () => {
    const result = formatAnswers(
      [{ question: 'Language?' }, { question: 'Framework?' }],
      ['TypeScript', 'React'],
    );
    expect(result).toBe(
      '**Q:** Language?\n**A:** TypeScript\n\n**Q:** Framework?\n**A:** React',
    );
  });

  it('includes context when present', () => {
    const result = formatAnswers(
      [{ context: 'Only MySQL or Postgres supported', question: 'Which DB?' }],
      ['Postgres'],
    );
    expect(result).toBe(
      '**Q:** Which DB?\n> Only MySQL or Postgres supported\n\n**A:** Postgres',
    );
  });

  it('uses "(no answer)" for empty answers', () => {
    const result = formatAnswers([{ question: 'Colour?' }], ['']);
    expect(result).toBe('**Q:** Colour?\n**A:** (no answer)');
  });

  it('uses "(no answer)" for whitespace-only answers', () => {
    const result = formatAnswers([{ question: 'Colour?' }], ['   ']);
    expect(result).toBe('**Q:** Colour?\n**A:** (no answer)');
  });

  it('uses "(no answer)" when answer is missing from array', () => {
    const result = formatAnswers(
      [{ question: 'First?' }, { question: 'Second?' }],
      ['Yes'],
    );
    expect(result).toBe(
      '**Q:** First?\n**A:** Yes\n\n**Q:** Second?\n**A:** (no answer)',
    );
  });

  it('trims whitespace from answers', () => {
    const result = formatAnswers([{ question: 'Name?' }], ['  James  ']);
    expect(result).toBe('**Q:** Name?\n**A:** James');
  });

  it('separates context blockquote from the answer with a blank line', () => {
    // Regression: without the blank line, CommonMark lazy continuation
    // folds the `A:` line into the preceding `>` blockquote, making the
    // answer render as if it were part of the quoted agent context.
    const result = formatAnswers(
      [{ context: 'quoted agent context', question: 'Q?' }],
      ['my answer'],
    );
    expect(result).toContain('> quoted agent context\n\n**A:** my answer');
  });
});
