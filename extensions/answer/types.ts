export interface ExtractedQuestion {
  question: string;
  context?: string;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
}
