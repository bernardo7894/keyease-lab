import type { GeneratorSettings, TargetFeatures, TrialRecord } from "./types";

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/|~";
const EASY_DIGITS = "111222333000456789";
const EASY_SYMBOLS = "#$@'";
const STORAGE_KEY = "keyease-lab-trials-v1";
const ONSETS = [
  "b",
  "br",
  "c",
  "ch",
  "d",
  "dr",
  "f",
  "g",
  "gr",
  "h",
  "j",
  "k",
  "l",
  "m",
  "n",
  "p",
  "pr",
  "qu",
  "r",
  "s",
  "sh",
  "t",
  "tr",
  "v",
  "w",
  "z",
];
const VOWELS = ["a", "e", "i", "o", "u", "ai", "ee", "oa"];
const CODAS = ["", "", "", "b", "d", "g", "k", "l", "m", "n", "p", "r", "s", "t"];
const KEY_POSITIONS: Record<string, { x: number; y: number; hand: "left" | "right"; finger: string }> = {
  q: { x: 0, y: 1, hand: "left", finger: "left-pinky" },
  w: { x: 1, y: 1, hand: "left", finger: "left-ring" },
  e: { x: 2, y: 1, hand: "left", finger: "left-middle" },
  r: { x: 3, y: 1, hand: "left", finger: "left-index" },
  t: { x: 4, y: 1, hand: "left", finger: "left-index" },
  y: { x: 5, y: 1, hand: "right", finger: "right-index" },
  u: { x: 6, y: 1, hand: "right", finger: "right-index" },
  i: { x: 7, y: 1, hand: "right", finger: "right-middle" },
  o: { x: 8, y: 1, hand: "right", finger: "right-ring" },
  p: { x: 9, y: 1, hand: "right", finger: "right-pinky" },
  a: { x: 0.25, y: 2, hand: "left", finger: "left-pinky" },
  s: { x: 1.25, y: 2, hand: "left", finger: "left-ring" },
  d: { x: 2.25, y: 2, hand: "left", finger: "left-middle" },
  f: { x: 3.25, y: 2, hand: "left", finger: "left-index" },
  g: { x: 4.25, y: 2, hand: "left", finger: "left-index" },
  h: { x: 5.25, y: 2, hand: "right", finger: "right-index" },
  j: { x: 6.25, y: 2, hand: "right", finger: "right-index" },
  k: { x: 7.25, y: 2, hand: "right", finger: "right-middle" },
  l: { x: 8.25, y: 2, hand: "right", finger: "right-ring" },
  z: { x: 0.75, y: 3, hand: "left", finger: "left-pinky" },
  x: { x: 1.75, y: 3, hand: "left", finger: "left-ring" },
  c: { x: 2.75, y: 3, hand: "left", finger: "left-middle" },
  v: { x: 3.75, y: 3, hand: "left", finger: "left-index" },
  b: { x: 4.75, y: 3, hand: "left", finger: "left-index" },
  n: { x: 5.75, y: 3, hand: "right", finger: "right-index" },
  m: { x: 6.75, y: 3, hand: "right", finger: "right-index" },
  "1": { x: 0, y: 0, hand: "left", finger: "left-pinky" },
  "2": { x: 1, y: 0, hand: "left", finger: "left-ring" },
  "3": { x: 2, y: 0, hand: "left", finger: "left-middle" },
  "4": { x: 3, y: 0, hand: "left", finger: "left-index" },
  "5": { x: 4, y: 0, hand: "left", finger: "left-index" },
  "6": { x: 5, y: 0, hand: "right", finger: "right-index" },
  "7": { x: 6, y: 0, hand: "right", finger: "right-index" },
  "8": { x: 7, y: 0, hand: "right", finger: "right-middle" },
  "9": { x: 8, y: 0, hand: "right", finger: "right-ring" },
  "0": { x: 9, y: 0, hand: "right", finger: "right-pinky" },
  "#": { x: 3, y: 0, hand: "left", finger: "left-index" },
  "$": { x: 4, y: 0, hand: "left", finger: "left-index" },
  "@": { x: 1, y: 0, hand: "left", finger: "left-ring" },
  "'": { x: 10.25, y: 2, hand: "right", finger: "right-pinky" },
};

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

  return Array.from({ length: count }, () =>
    settings.generationMode === "easyWord"
      ? generateEasyWordString(settings)
      : settings.generationMode === "wordLike"
        ? generateWordLikeString(settings)
        : generateRandomString(settings.length, alphabet),
  );
}

export function generateEasyWordString(settings: GeneratorSettings): string {
  const safeLength = Math.max(1, Math.floor(settings.length));
  const digitCount = settings.includeDigits && safeLength > 3 ? Math.min(2, Math.max(1, Math.floor(safeLength / 6))) : 0;
  const symbolCount = settings.includeSymbols && safeLength - digitCount > 4 ? 1 : 0;
  const coreLength = Math.max(1, safeLength - digitCount - symbolCount);
  const core = applyEasyUppercase(generateWordCore(coreLength), settings);
  const digits = digitCount > 0 ? generateRandomString(digitCount, EASY_DIGITS) : "";
  const symbols = symbolCount > 0 ? generateRandomString(symbolCount, EASY_SYMBOLS) : "";

  return `${core}${digits}${symbols}`.slice(0, safeLength);
}

function applyEasyUppercase(value: string, settings: GeneratorSettings): string {
  if (!settings.includeUppercase || value.length === 0) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`;
}

export function generateWordLikeString(settings: GeneratorSettings): string {
  const hasLetters = settings.includeLowercase || settings.includeUppercase;

  if (!hasLetters) {
    return generateRandomString(settings.length, buildAlphabet(settings));
  }

  const safeLength = Math.max(1, Math.floor(settings.length));
  const symbolCount = settings.includeSymbols && safeLength > 4 ? 1 : 0;
  const digitCount = settings.includeDigits && safeLength > 3 ? Math.min(2, Math.max(1, Math.floor(safeLength / 6))) : 0;
  const coreLength = Math.max(1, safeLength - symbolCount - digitCount);
  const core = applyLetterCase(generateWordCore(coreLength), settings);
  const digits = digitCount > 0 ? generateRandomString(digitCount, DIGITS) : "";
  const symbols = symbolCount > 0 ? generateRandomString(symbolCount, SYMBOLS) : "";

  return `${core}${digits}${symbols}`.slice(0, safeLength);
}

function generateWordCore(length: number): string {
  let result = "";

  while (result.length < length) {
    result += randomItem(ONSETS) + randomItem(VOWELS) + randomItem(CODAS);
  }

  return result.slice(0, length);
}

function applyLetterCase(value: string, settings: GeneratorSettings): string {
  if (settings.includeUppercase && !settings.includeLowercase) {
    return value.toUpperCase();
  }

  if (!settings.includeUppercase) {
    return value.toLowerCase();
  }

  const characters = value.toLowerCase().split("");
  const uppercaseCount = Math.min(Math.max(1, Math.floor(characters.length / 5)), 3);

  for (const index of uniqueRandomIndices(characters.length, uppercaseCount)) {
    characters[index] = characters[index].toUpperCase();
  }

  return characters.join("");
}

function randomItem(items: string[]): string {
  return items[randomInteger(items.length)];
}

function randomInteger(exclusiveMax: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);

  return value[0] % exclusiveMax;
}

function uniqueRandomIndices(length: number, count: number): number[] {
  const indices = new Set<number>();

  while (indices.size < count && indices.size < length) {
    indices.add(randomInteger(length));
  }

  return [...indices];
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

export function computeTargetFeatures(target: string): TargetFeatures {
  const characters = Array.from(target);
  let lowercaseCount = 0;
  let uppercaseCount = 0;
  let digitCount = 0;
  let symbolCount = 0;
  let caseTransitionCount = 0;
  let uppercaseRunCount = 0;
  let sameHandBigramCount = 0;
  let sameFingerBigramCount = 0;
  let leftHandCount = 0;
  let rightHandCount = 0;
  let qwertyTravelDistanceEstimate = 0;
  let inUppercaseRun = false;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const previousCharacter = characters[index - 1];
    const position = KEY_POSITIONS[character.toLowerCase()];

    if (/[a-z]/.test(character)) lowercaseCount += 1;
    else if (/[A-Z]/.test(character)) uppercaseCount += 1;
    else if (/\d/.test(character)) digitCount += 1;
    else symbolCount += 1;

    if (/[A-Z]/.test(character) && !inUppercaseRun) {
      uppercaseRunCount += 1;
      inUppercaseRun = true;
    } else if (!/[A-Z]/.test(character)) {
      inUppercaseRun = false;
    }

    if (position?.hand === "left") leftHandCount += 1;
    if (position?.hand === "right") rightHandCount += 1;

    if (previousCharacter) {
      const previousPosition = KEY_POSITIONS[previousCharacter.toLowerCase()];

      if (isLetter(character) && isLetter(previousCharacter) && isUppercase(character) !== isUppercase(previousCharacter)) {
        caseTransitionCount += 1;
      }

      if (position && previousPosition) {
        if (position.hand === previousPosition.hand) sameHandBigramCount += 1;
        if (position.finger === previousPosition.finger) sameFingerBigramCount += 1;
        qwertyTravelDistanceEstimate += Math.hypot(position.x - previousPosition.x, position.y - previousPosition.y);
      }
    }
  }

  return {
    length: characters.length,
    lowercaseCount,
    uppercaseCount,
    digitCount,
    symbolCount,
    caseTransitionCount,
    uppercaseRunCount,
    sameHandBigramCount,
    sameFingerBigramCount,
    leftHandCount,
    rightHandCount,
    handImbalance: Math.abs(leftHandCount - rightHandCount),
    qwertyTravelDistanceEstimate: Number(qwertyTravelDistanceEstimate.toFixed(3)),
  };
}

export function median(values: number[]): number {
  if (!values.length) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function isLetter(character: string): boolean {
  return /[a-z]/i.test(character);
}

function isUppercase(character: string): boolean {
  return /[A-Z]/.test(character);
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
    "subjectiveDifficulty",
    "possiblePause",
    "characterMode",
    "targetFeatures",
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
      trial.subjectiveDifficulty ?? "",
      trial.possiblePause ?? false,
      trial.characterMode ?? "",
      JSON.stringify(trial.targetFeatures ?? {}),
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
