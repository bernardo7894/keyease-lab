import { describe, expect, it } from "vitest";
import {
  computeTargetFeatures,
  csvEscape,
  generateEasyWordString,
  generateWordLikeString,
  levenshteinDistance,
  median,
  trialsToCsv,
} from "./helpers";
import type { TrialRecord } from "./types";

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
      characterMode: "mixed_case_digits",
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
      generationMode: "wordLike",
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
      generationMode: "easyWord",
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
      generationMode: "easyWord",
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
      generationMode: "easyWord",
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
