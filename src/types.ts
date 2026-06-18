export type GenerationMode = "easyWord" | "wordLike" | "random";
export type SourceMode =
  | "random_lowercase"
  | "pseudo_words"
  | "pseudo_words_digits"
  | "real_words"
  | "sentences"
  | "mixed_case_digits"
  | "mixed_case_digits_symbols";
export type CharacterMode =
  | "lowercase"
  | "lowercase_digits"
  | "mixed_case"
  | "mixed_case_digits"
  | "mixed_case_digits_symbols";

export interface TargetFeatures {
  length: number;
  lowercaseCount: number;
  uppercaseCount: number;
  digitCount: number;
  symbolCount: number;
  caseTransitionCount: number;
  uppercaseRunCount: number;
  sameHandBigramCount: number;
  sameFingerBigramCount: number;
  leftHandCount: number;
  rightHandCount: number;
  handImbalance: number;
  qwertyTravelDistanceEstimate: number;
}

export interface KeydownEventRecord {
  key: string;
  code: string;
  timestampMs: number;
  relativeTimestampMs: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface TrialRecord {
  trialId: string;
  sessionId: string;
  sourceMode: SourceMode;
  characterMode: CharacterMode;
  generatorConfig: GeneratorSettings;
  target: string;
  targetFeatures: TargetFeatures;
  typed: string;
  startedAtEpochMs: number;
  endedAtEpochMs: number;
  durationMs: number;
  success: boolean;
  backspaceCount: number;
  editDistance: number;
  subjectiveDifficulty?: number;
  possiblePause: boolean;
  skipped: boolean;
  keydownEvents: KeydownEventRecord[];
}

export interface GeneratorSettings {
  generationMode: GenerationMode;
  sourceMode: SourceMode;
  characterMode: CharacterMode;
  length: number;
  sentenceMaxLength: number;
  punctuationEnabled: boolean;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
  trialCount: number;
}
