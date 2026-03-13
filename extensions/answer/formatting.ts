import type { ExtractedQuestion } from './types.ts';

/**
 * Format questions and answers into a readable Q&A text block.
 */
export const formatAnswers = (
  questions: ExtractedQuestion[],
  answers: string[],
): string => {
  const parts: string[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const answer = answers[i]?.trim() || '(no answer)';

    parts.push(`Q: ${question.question}`);
    if (question.context) {
      parts.push(`> ${question.context}`);
    }
    parts.push(`A: ${answer}`);
    parts.push('');
  }

  return parts.join('\n').trim();
};
