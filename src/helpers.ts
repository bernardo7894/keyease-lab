import type { GeneratorSettings, TrialRecord } from "./types";

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/|~";
const STORAGE_KEY = "keyease-lab-trials-v1";

export function buildAlphabet(settings: GeneratorSettings): string {
  let alphabet = "";

  if (settings.includeLowercase) alphabet += LOWERCASE;
  if (settings.includeUppercase) alphabet += UPPERCASE;
  if (settings.includeDigits) alphabet += DIGITS;
  if (settings.includeSymbols) alphabet += SYMBOLS;

  return alphabet || LOWERCASE;
}

export function generateRandomString(length: number, alphabet: string): string {
  const safeLength = Math.max(1, Math.floor(length));
  const randomValues = new Uint32Array(safeLength);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
}

export function generateTargets(settings: GeneratorSettings): string[] {
  const alphabet = buildAlphabet(settings);
  const count = Math.max(1, Math.floor(settings.trialCount));

  return Array.from({ length: count }, () => generateRandomString(settings.length, alphabet));
}

export function levenshteinDistance(left: string, right: string): number {
  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      currentRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + cost,
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return previousRow[right.length];
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replaceAll('"', '""');

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function trialsToCsv(trials: TrialRecord[]): string {
  const headers = [
    "trialId",
    "target",
    "typed",
    "startedAtEpochMs",
    "endedAtEpochMs",
    "durationMs",
    "success",
    "backspaceCount",
    "editDistance",
    "keydownEvents",
  ];

  const rows = trials.map((trial) =>
    [
      trial.trialId,
      trial.target,
      trial.typed,
      trial.startedAtEpochMs,
      trial.endedAtEpochMs,
      trial.durationMs,
      trial.success,
      trial.backspaceCount,
      trial.editDistance,
      JSON.stringify(trial.keydownEvents),
    ]
      .map(csvEscape)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export function loadTrials(): TrialRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrialRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveTrials(trials: TrialRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trials));
}

export function clearTrials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function downloadFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
