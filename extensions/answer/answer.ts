/**
 * Q&A extraction extension — extracts questions from assistant responses
 * and presents an interactive TUI for answering them.
 *
 * Usage: /answer command or Ctrl+. shortcut
 *
 * Flow:
 * 1. Finds the last assistant message on the current branch
 * 2. Sends it to a cheap extraction model to identify questions
 * 3. Presents an interactive Q&A component to answer each question
 * 4. Submits the compiled answers back to the conversation
 */

import type { UserMessage } from '@earendil-works/pi-ai';
import { complete } from '@earendil-works/pi-ai';
import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { BorderedLoader } from '@earendil-works/pi-coding-agent';

import {
  EXTRACTION_SYSTEM_PROMPT,
  extractTextFromContentParts,
  findLastAssistantText,
  parseExtractionResult,
  selectExtractionModel,
} from './extraction.ts';
import { QnAComponent } from './qna-component.ts';
import type { ExtractionResult } from './types.ts';

export default (pi: ExtensionAPI) => {
  const answerHandler = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI) {
      ctx.ui.notify('answer requires interactive mode', 'error');
      return;
    }

    if (!ctx.model) {
      ctx.ui.notify('No model selected', 'error');
      return;
    }

    // Find the last assistant message
    const branch = ctx.sessionManager.getBranch();
    const lastMessage = findLastAssistantText(branch);

    if ('error' in lastMessage) {
      ctx.ui.notify(lastMessage.error, 'error');
      return;
    }

    const extractionModel = selectExtractionModel(ctx.model, ctx.modelRegistry);

    // Extract questions with a loading spinner
    const extractionResult = await ctx.ui.custom<ExtractionResult | null>(
      (tui, theme, _kb, done) => {
        const loader = new BorderedLoader(
          tui,
          theme,
          `Extracting questions using ${extractionModel.id}...`,
        );
        loader.onAbort = () => done(null);

        const runExtraction = async () => {
          const auth =
            await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
          if (!auth.ok) {
            throw new Error(auth.error);
          }

          const message: UserMessage = {
            content: [{ text: lastMessage.text, type: 'text' }],
            role: 'user',
            timestamp: Date.now(),
          };

          const response = await complete(
            extractionModel,
            { messages: [message], systemPrompt: EXTRACTION_SYSTEM_PROMPT },
            {
              apiKey: auth.apiKey,
              headers: auth.headers,
              signal: loader.signal,
            },
          );

          if (response.stopReason === 'aborted') {
            return null;
          }

          const responseText = extractTextFromContentParts(response.content);
          return parseExtractionResult(responseText);
        };

        runExtraction()
          .then(done)
          .catch(() => done(null));

        return loader;
      },
    );

    if (extractionResult === null) {
      ctx.ui.notify('Cancelled', 'info');
      return;
    }

    if (extractionResult.questions.length === 0) {
      ctx.ui.notify('No questions found in the last message', 'info');
      return;
    }

    // Present the interactive Q&A component
    const formattedAnswers = await ctx.ui.custom<string | null>(
      (tui, _theme, _kb, done) => {
        return new QnAComponent(extractionResult.questions, tui, done);
      },
    );

    if (formattedAnswers === null) {
      ctx.ui.notify('Cancelled', 'info');
      return;
    }

    pi.sendMessage(
      {
        content: `I answered your questions in the following way:\n\n${formattedAnswers}`,
        customType: 'answers',
        display: true,
      },
      { triggerTurn: true },
    );
  };

  pi.registerCommand('answer', {
    description:
      'Extract questions from last assistant message into interactive Q&A',
    handler: (_args, ctx) => answerHandler(ctx),
  });

  pi.registerShortcut('ctrl+.', {
    description: 'Extract and answer questions',
    handler: answerHandler,
  });
};
