export type GenerationMode = "easyWord" | "wordLike" | "random";
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
  characterMode: CharacterMode;
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
  keydownEvents: KeydownEventRecord[];
}

export interface GeneratorSettings {
  generationMode: GenerationMode;
  characterMode: CharacterMode;
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
  trialCount: number;
}
