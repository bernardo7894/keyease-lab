import { describe, expect, it } from "vitest";
import {
  computeTargetFeatures,
  csvEscape,
  generateEasyWordString,
  generateTargets,
  generateWordLikeString,
  levenshteinDistance,
  median,
  trialsToCsv,
} from "./helpers";
import type { GeneratorSettings, TrialRecord } from "./types";

const BASE_SETTINGS: GeneratorSettings = {
  generationMode: "easyWord",
  sourceMode: "pseudo_words_digits",
  characterMode: "lowercase_digits",
  length: 12,
  sentenceMaxLength: 36,
  punctuationEnabled: false,
  includeLowercase: true,
  includeUppercase: false,
  includeDigits: true,
  includeSymbols: false,
  trialCount: 1,
};

describe("levenshteinDistance", () => {
  it("handles exact matches", () => {
    expect(levenshteinDistance("abc123", "abc123")).toBe(0);
  });

  it("counts insertions, deletions, and substitutions", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("abc", "ab")).toBe(1);
    expect(levenshteinDistance("", "test")).toBe(4);
  });
});

describe("csvEscape", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvEscape('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("leaves simple fields unquoted", () => {
    expect(csvEscape("abc123")).toBe("abc123");
  });
});

describe("trialsToCsv", () => {
  it("serializes one row per trial", () => {
    const trial: TrialRecord = {
      trialId: "trial-1",
      sessionId: "session-1",
      sourceMode: "mixed_case_digits",
      characterMode: "mixed_case_digits",
      generatorConfig: { ...BASE_SETTINGS, sourceMode: "mixed_case_digits", characterMode: "mixed_case_digits" },
      target: "Abc123",
      targetFeatures: computeTargetFeatures("Abc123"),
      typed: "Abc12",
      startedAtEpochMs: 100,
      endedAtEpochMs: 250,
      durationMs: 150,
      success: false,
      backspaceCount: 1,
      editDistance: 1,
      possiblePause: false,
      skipped: false,
      keydownEvents: [
        {
          key: "A",
          code: "KeyA",
          timestampMs: 100,
          relativeTimestampMs: 0,
          altKey: false,
          ctrlKey: false,
          shiftKey: true,
          metaKey: false,
        },
      ],
    };

    const csv = trialsToCsv([trial]);

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("trial-1");
    expect(csv).toContain("session-1");
    expect(csv).toContain("mixed_case_digits");
    expect(csv).toContain("mixed_case_digits");
    expect(csv).toContain('"[{""key"":""A""');
  });
});

describe("computeTargetFeatures", () => {
  it("counts character classes, case transitions, and keyboard estimates", () => {
    const features = computeTargetFeatures("Abc123#");

    expect(features.length).toBe(7);
    expect(features.lowercaseCount).toBe(2);
    expect(features.uppercaseCount).toBe(1);
    expect(features.digitCount).toBe(3);
    expect(features.symbolCount).toBe(1);
    expect(features.caseTransitionCount).toBe(1);
    expect(features.uppercaseRunCount).toBe(1);
    expect(features.leftHandCount + features.rightHandCount).toBeGreaterThan(0);
    expect(features.qwertyTravelDistanceEstimate).toBeGreaterThan(0);
  });

  it("includes spaces in length without counting them as symbols", () => {
    const features = computeTargetFeatures("blue door");

    expect(features.length).toBe(9);
    expect(features.symbolCount).toBe(0);
  });
});

describe("median", () => {
  it("handles odd, even, and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 10, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("generateWordLikeString", () => {
  it("keeps the requested length while producing a letter-heavy candidate", () => {
    const candidate = generateWordLikeString({
      ...BASE_SETTINGS,
      generationMode: "wordLike",
      sourceMode: "mixed_case_digits",
      characterMode: "mixed_case_digits",
      length: 12,
      includeLowercase: true,
      includeUppercase: true,
      includeDigits: true,
      includeSymbols: false,
      trialCount: 1,
    });

    expect(candidate).toHaveLength(12);
    expect(candidate).toMatch(/[a-zA-Z]/);
    expect(candidate).toMatch(/\d/);
  });
});

describe("generateEasyWordString", () => {
  it("keeps candidates lowercase with trailing digits when digits are enabled", () => {
    const candidate = generateEasyWordString({
      ...BASE_SETTINGS,
      generationMode: "easyWord",
      sourceMode: "pseudo_words_digits",
      characterMode: "lowercase_digits",
      length: 12,
      includeLowercase: true,
      includeUppercase: false,
      includeDigits: true,
      includeSymbols: false,
      trialCount: 1,
    });

    expect(candidate).toHaveLength(12);
    expect(candidate).toMatch(/^[a-z]+\d{2}$/);
  });

  it("uses only easy symbols when symbols are enabled", () => {
    const candidate = generateEasyWordString({
      ...BASE_SETTINGS,
      generationMode: "easyWord",
      sourceMode: "mixed_case_digits_symbols",
      characterMode: "mixed_case_digits_symbols",
      length: 12,
      includeLowercase: true,
      includeUppercase: false,
      includeDigits: true,
      includeSymbols: true,
      trialCount: 1,
    });

    expect(candidate).toHaveLength(12);
    expect(candidate).toMatch(/^[a-z]+\d{2}[#$@']$/);
  });

  it("uses a single leading uppercase letter when uppercase is enabled", () => {
    const candidate = generateEasyWordString({
      ...BASE_SETTINGS,
      generationMode: "easyWord",
      sourceMode: "mixed_case_digits",
      characterMode: "mixed_case_digits",
      length: 12,
      includeLowercase: true,
      includeUppercase: true,
      includeDigits: true,
      includeSymbols: false,
      trialCount: 1,
    });

    expect(candidate).toHaveLength(12);
    expect(candidate).toMatch(/^[A-Z][a-z]+\d{2}$/);
  });
});

describe("generateTargets", () => {
  it("generates real-word targets with spaces", () => {
    const [target] = generateTargets({
      ...BASE_SETTINGS,
      sourceMode: "real_words",
      characterMode: "lowercase",
      includeDigits: false,
    });

    expect(target.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(target).toMatch(/^[a-z]+( [a-z]+){1,3}$/);
  });

  it("generates lowercase sentence targets without punctuation by default", () => {
    const [target] = generateTargets({
      ...BASE_SETTINGS,
      sourceMode: "sentences",
      characterMode: "lowercase",
      sentenceMaxLength: 40,
      includeDigits: false,
    });

    expect(target.length).toBeLessThanOrEqual(40);
    expect(target).toMatch(/^[a-z\s]+$/);
  });
});
