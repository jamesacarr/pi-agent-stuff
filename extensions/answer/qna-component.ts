import type { Component, EditorTheme, TUI } from '@earendil-works/pi-tui';
import {
  Editor,
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';

import { formatAnswers } from './formatting.ts';
import type { ExtractedQuestion } from './types.ts';

// ANSI colour helpers
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

/**
 * Interactive TUI component for navigating and answering extracted questions.
 *
 * Navigation: Tab/Enter to advance, Shift+Tab to go back, Esc to cancel.
 * On the last question, Enter triggers a submit confirmation.
 */
export class QnAComponent implements Component {
  private questions: ExtractedQuestion[];
  private answers: string[];
  private currentIndex = 0;
  private editor: Editor;
  private tui: TUI;
  private onDone: (result: string | null) => void;
  private showingConfirmation = false;

  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    questions: ExtractedQuestion[],
    tui: TUI,
    onDone: (result: string | null) => void,
  ) {
    this.questions = questions;
    this.answers = questions.map(() => '');
    this.tui = tui;
    this.onDone = onDone;

    const editorTheme: EditorTheme = {
      borderColor: dim,
      selectList: {
        description: gray,
        noMatch: dim,
        scrollInfo: dim,
        selectedPrefix: cyan,
        selectedText: bold,
      },
    };

    this.editor = new Editor(tui, editorTheme);
    this.editor.disableSubmit = true;
    this.editor.onChange = () => {
      this.invalidate();
      this.tui.requestRender();
    };
  }

  // ── State management ──────────────────────────────────────────────

  private saveCurrentAnswer = (): void => {
    this.answers[this.currentIndex] = this.editor.getText();
  };

  private navigateTo = (index: number): void => {
    if (index < 0 || index >= this.questions.length) {
      return;
    }
    this.saveCurrentAnswer();
    this.currentIndex = index;
    this.editor.setText(this.answers[index] || '');
    this.invalidate();
  };

  private submit = (): void => {
    this.saveCurrentAnswer();
    this.onDone(formatAnswers(this.questions, this.answers));
  };

  invalidate = (): void => {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  };

  // ── Input handling ────────────────────────────────────────────────

  handleInput = (keyData: string): void => {
    if (this.showingConfirmation) {
      this.handleConfirmationInput(keyData);
      return;
    }

    if (matchesKey(keyData, Key.escape) || matchesKey(keyData, Key.ctrl('c'))) {
      this.onDone(null);
      return;
    }

    if (this.handleNavigationInput(keyData)) {
      return;
    }

    // Plain Enter: advance to next question or trigger confirmation on last
    if (
      matchesKey(keyData, Key.enter) &&
      !matchesKey(keyData, Key.shift('enter'))
    ) {
      this.saveCurrentAnswer();
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
      } else {
        this.showingConfirmation = true;
      }
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    // Everything else goes to the editor (including Shift+Enter for newlines)
    this.editor.handleInput(keyData);
    this.invalidate();
    this.tui.requestRender();
  };

  private handleConfirmationInput = (keyData: string): void => {
    if (matchesKey(keyData, Key.enter) || keyData.toLowerCase() === 'y') {
      this.submit();
      return;
    }
    if (
      matchesKey(keyData, Key.escape) ||
      matchesKey(keyData, Key.ctrl('c')) ||
      keyData.toLowerCase() === 'n'
    ) {
      this.showingConfirmation = false;
      this.invalidate();
      this.tui.requestRender();
    }
  };

  /**
   * Handle Tab, Shift+Tab, and arrow key navigation.
   * Returns true if the input was consumed.
   */
  private handleNavigationInput = (keyData: string): boolean => {
    if (
      matchesKey(keyData, Key.tab) &&
      this.currentIndex < this.questions.length - 1
    ) {
      this.navigateTo(this.currentIndex + 1);
      this.tui.requestRender();
      return true;
    }
    if (matchesKey(keyData, Key.shift('tab')) && this.currentIndex > 0) {
      this.navigateTo(this.currentIndex - 1);
      this.tui.requestRender();
      return true;
    }

    // Arrow keys navigate questions only when the editor is empty
    const editorIsEmpty = this.editor.getText() === '';
    if (editorIsEmpty && matchesKey(keyData, Key.up) && this.currentIndex > 0) {
      this.navigateTo(this.currentIndex - 1);
      this.tui.requestRender();
      return true;
    }
    if (
      editorIsEmpty &&
      matchesKey(keyData, Key.down) &&
      this.currentIndex < this.questions.length - 1
    ) {
      this.navigateTo(this.currentIndex + 1);
      this.tui.requestRender();
      return true;
    }

    return false;
  };

  // ── Rendering ─────────────────────────────────────────────────────

  render = (width: number): string[] => {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const boxWidth = Math.min(width - 4, 120);
    const contentWidth = boxWidth - 4;

    const horizontalRule = (count: number) => '─'.repeat(count);

    const boxLine = (content: string, leftPad = 2): string => {
      const paddedContent = ' '.repeat(leftPad) + content;
      const rightPad = Math.max(0, boxWidth - visibleWidth(paddedContent) - 2);
      return dim('│') + paddedContent + ' '.repeat(rightPad) + dim('│');
    };

    const emptyLine = (): string =>
      dim('│') + ' '.repeat(boxWidth - 2) + dim('│');

    const padRight = (line: string): string =>
      line + ' '.repeat(Math.max(0, width - visibleWidth(line)));

    const lines: string[] = [];

    // Title bar
    lines.push(padRight(dim(`╭${horizontalRule(boxWidth - 2)}╮`)));
    const title = `${bold(cyan('Questions'))} ${dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
    lines.push(padRight(boxLine(title)));
    lines.push(padRight(dim(`├${horizontalRule(boxWidth - 2)}┤`)));

    // Progress dots
    const progressDots = this.questions.map((_, i) => {
      if (i === this.currentIndex) {
        return cyan('●');
      }
      if ((this.answers[i]?.trim() || '').length > 0) {
        return green('●');
      }
      return dim('○');
    });
    lines.push(padRight(boxLine(progressDots.join(' '))));
    lines.push(padRight(emptyLine()));

    // Current question
    const currentQuestion = this.questions[this.currentIndex];
    for (const line of wrapTextWithAnsi(
      `${bold('Q:')} ${currentQuestion.question}`,
      contentWidth,
    )) {
      lines.push(padRight(boxLine(line)));
    }

    // Context (if present)
    if (currentQuestion.context) {
      lines.push(padRight(emptyLine()));
      for (const line of wrapTextWithAnsi(
        gray(`> ${currentQuestion.context}`),
        contentWidth - 2,
      )) {
        lines.push(padRight(boxLine(line)));
      }
    }

    lines.push(padRight(emptyLine()));

    // Editor (answer input) — skip the editor's own border lines
    const editorWidth = contentWidth - 4 - 3; // padding + "A: " prefix width
    const editorLines = this.editor.render(editorWidth);
    for (let i = 1; i < editorLines.length - 1; i++) {
      const prefix = i === 1 ? bold('A: ') : '   ';
      lines.push(padRight(boxLine(prefix + editorLines[i])));
    }

    lines.push(padRight(emptyLine()));

    // Footer — confirmation or controls
    lines.push(padRight(dim(`├${horizontalRule(boxWidth - 2)}┤`)));
    const footerContent = this.showingConfirmation
      ? `${yellow('Submit all answers?')} ${dim('(Enter/y to confirm, Esc/n to cancel)')}`
      : `${dim('Tab/Enter')} next · ${dim('Shift+Tab')} prev · ${dim('Shift+Enter')} newline · ${dim('Esc')} cancel`;
    lines.push(padRight(boxLine(truncateToWidth(footerContent, contentWidth))));
    lines.push(padRight(dim(`╰${horizontalRule(boxWidth - 2)}╯`)));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  };
}
