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
  target: string;
  typed: string;
  startedAtEpochMs: number;
  endedAtEpochMs: number;
  durationMs: number;
  success: boolean;
  backspaceCount: number;
  editDistance: number;
  keydownEvents: KeydownEventRecord[];
}

export interface GeneratorSettings {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
  trialCount: number;
}
