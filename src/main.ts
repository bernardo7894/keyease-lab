import "./style.css";
import {
  clearTrials,
  downloadFile,
  generateTargets,
  levenshteinDistance,
  loadTrials,
  saveTrials,
  trialsToCsv,
} from "./helpers";
import type { GeneratorSettings, KeydownEventRecord, TrialRecord } from "./types";

const DEFAULT_SETTINGS: GeneratorSettings = {
  generationMode: "wordLike",
  length: 12,
  includeLowercase: true,
  includeUppercase: true,
  includeDigits: true,
  includeSymbols: false,
  trialCount: 20,
};

interface ActiveTrial {
  target: string;
  startedAtEpochMs: number | null;
  backspaceCount: number;
  keydownEvents: KeydownEventRecord[];
}

let settings: GeneratorSettings = { ...DEFAULT_SETTINGS };
let targets: string[] = [];
let targetIndex = 0;
let completedTrials: TrialRecord[] = loadTrials();
let activeTrial: ActiveTrial | null = null;
let lastTrial: TrialRecord | null = completedTrials.at(-1) ?? null;
let elapsedTimer: number | undefined;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

app.innerHTML = `
  <main class="shell">
    <section class="intro" aria-labelledby="title">
      <div>
        <p class="eyebrow">Local typing study</p>
        <h1 id="title">KeyEase Lab</h1>
        <p class="lede">Type generated strings to collect personal typing-effort data. Do not type real passwords.</p>
      </div>
      <p class="privacy-note">This tool is for generated test strings only. Do not type real passwords. Everything stays local in this browser until you export it.</p>
    </section>

    <section class="workspace" aria-label="Typing trial">
      <div class="target-panel">
        <span class="panel-label">Target string</span>
        <div class="target" id="targetText">Press Start session</div>
      </div>

      <label class="input-label" for="typingInput">Your typed string</label>
      <input id="typingInput" class="typing-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" disabled />

      <div class="button-row" aria-label="Session actions">
        <button id="startButton" type="button">Start session</button>
        <button id="skipButton" type="button" disabled>Skip string</button>
        <button id="finishButton" type="button" disabled>Finish trial</button>
        <button id="exportJsonButton" type="button">Export JSON</button>
        <button id="exportCsvButton" type="button">Export CSV</button>
        <button id="clearButton" class="danger" type="button">Clear local data</button>
      </div>
    </section>

    <section class="settings" aria-labelledby="settingsTitle">
      <h2 id="settingsTitle">Generation Settings</h2>
      <div class="settings-grid">
        <label>
          <span>Style</span>
          <select id="generationModeInput">
            <option value="wordLike" selected>Word-like</option>
            <option value="random">Random</option>
          </select>
        </label>
        <label>
          <span>Length</span>
          <input id="lengthInput" type="number" min="1" max="64" value="${DEFAULT_SETTINGS.length}" />
        </label>
        <label>
          <span>Trials</span>
          <input id="trialCountInput" type="number" min="1" max="500" value="${DEFAULT_SETTINGS.trialCount}" />
        </label>
        <label class="check">
          <input id="lowercaseInput" type="checkbox" checked />
          <span>Lowercase</span>
        </label>
        <label class="check">
          <input id="uppercaseInput" type="checkbox" checked />
          <span>Uppercase</span>
        </label>
        <label class="check">
          <input id="digitsInput" type="checkbox" checked />
          <span>Digits</span>
        </label>
        <label class="check">
          <input id="symbolsInput" type="checkbox" />
          <span>Symbols</span>
        </label>
      </div>
    </section>

    <section class="stats" aria-labelledby="statsTitle" aria-live="polite">
      <h2 id="statsTitle">Live Stats</h2>
      <dl class="stats-grid">
        <div><dt>Current trial</dt><dd id="currentTrialStat">0 / 0</dd></div>
        <div><dt>Completed</dt><dd id="completedStat">0</dd></div>
        <div><dt>Elapsed</dt><dd id="elapsedStat">0 ms</dd></div>
        <div><dt>Exact match</dt><dd id="matchStat">No</dd></div>
        <div><dt>Backspaces</dt><dd id="backspaceStat">0</dd></div>
        <div><dt>Last duration</dt><dd id="lastDurationStat">None</dd></div>
        <div><dt>Last edit distance</dt><dd id="lastDistanceStat">None</dd></div>
      </dl>
    </section>
  </main>
`;

const targetText = getElement<HTMLDivElement>("targetText");
const typingInput = getElement<HTMLInputElement>("typingInput");
const startButton = getElement<HTMLButtonElement>("startButton");
const skipButton = getElement<HTMLButtonElement>("skipButton");
const finishButton = getElement<HTMLButtonElement>("finishButton");
const exportJsonButton = getElement<HTMLButtonElement>("exportJsonButton");
const exportCsvButton = getElement<HTMLButtonElement>("exportCsvButton");
const clearButton = getElement<HTMLButtonElement>("clearButton");
const generationModeInput = getElement<HTMLSelectElement>("generationModeInput");
const lengthInput = getElement<HTMLInputElement>("lengthInput");
const trialCountInput = getElement<HTMLInputElement>("trialCountInput");
const lowercaseInput = getElement<HTMLInputElement>("lowercaseInput");
const uppercaseInput = getElement<HTMLInputElement>("uppercaseInput");
const digitsInput = getElement<HTMLInputElement>("digitsInput");
const symbolsInput = getElement<HTMLInputElement>("symbolsInput");
const currentTrialStat = getElement<HTMLElement>("currentTrialStat");
const completedStat = getElement<HTMLElement>("completedStat");
const elapsedStat = getElement<HTMLElement>("elapsedStat");
const matchStat = getElement<HTMLElement>("matchStat");
const backspaceStat = getElement<HTMLElement>("backspaceStat");
const lastDurationStat = getElement<HTMLElement>("lastDurationStat");
const lastDistanceStat = getElement<HTMLElement>("lastDistanceStat");

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}.`);
  }

  return element as T;
}

function readSettings(): GeneratorSettings {
  return {
    generationMode: generationModeInput.value === "random" ? "random" : "wordLike",
    length: clampNumber(lengthInput.valueAsNumber, 1, 64),
    includeLowercase: lowercaseInput.checked,
    includeUppercase: uppercaseInput.checked,
    includeDigits: digitsInput.checked,
    includeSymbols: symbolsInput.checked,
    trialCount: clampNumber(trialCountInput.valueAsNumber, 1, 500),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function startSession(): void {
  settings = readSettings();
  targets = generateTargets(settings);
  targetIndex = 0;
  setActiveTarget(targets[targetIndex]);
  typingInput.disabled = false;
  skipButton.disabled = false;
  finishButton.disabled = false;
  typingInput.focus();
  render();
}

function setActiveTarget(target: string): void {
  activeTrial = {
    target,
    startedAtEpochMs: null,
    backspaceCount: 0,
    keydownEvents: [],
  };
  typingInput.value = "";
  targetText.classList.add("is-active");
  targetText.innerHTML = renderTarget(target);
}

function skipString(): void {
  if (!targets.length) {
    return;
  }

  moveToNextTarget();
}

function startTrialIfNeeded(event: KeyboardEvent): void {
  if (!activeTrial || activeTrial.startedAtEpochMs !== null) {
    return;
  }

  const now = Date.now();
  activeTrial.startedAtEpochMs = now;
  recordKeydown(event, now);
  startElapsedTimer();
}

function recordKeydown(event: KeyboardEvent, timestampMs = Date.now()): void {
  if (!activeTrial || activeTrial.startedAtEpochMs === null) {
    return;
  }

  if (event.key === "Backspace") {
    activeTrial.backspaceCount += 1;
  }

  activeTrial.keydownEvents.push({
    key: event.key,
    code: event.code,
    timestampMs,
    relativeTimestampMs: timestampMs - activeTrial.startedAtEpochMs,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  });
}

function finishTrial(): void {
  if (!activeTrial) {
    return;
  }

  const endedAtEpochMs = Date.now();
  const startedAtEpochMs = activeTrial.startedAtEpochMs ?? endedAtEpochMs;
  const typed = typingInput.value;
  const editDistance = levenshteinDistance(activeTrial.target, typed);
  const record: TrialRecord = {
    trialId: crypto.randomUUID(),
    target: activeTrial.target,
    typed,
    startedAtEpochMs,
    endedAtEpochMs,
    durationMs: endedAtEpochMs - startedAtEpochMs,
    success: typed === activeTrial.target,
    backspaceCount: activeTrial.backspaceCount,
    editDistance,
    keydownEvents: activeTrial.keydownEvents,
  };

  completedTrials = [...completedTrials, record];
  lastTrial = record;
  saveTrials(completedTrials);
  moveToNextTarget();
}

function moveToNextTarget(): void {
  stopElapsedTimer();
  targetIndex += 1;

  if (targetIndex >= targets.length) {
    activeTrial = null;
    typingInput.value = "";
    typingInput.disabled = true;
    skipButton.disabled = true;
    finishButton.disabled = true;
    targetText.classList.remove("is-active");
    targetText.textContent = "Session complete. Export your data or start another session.";
    render();
    return;
  }

  setActiveTarget(targets[targetIndex]);
  typingInput.focus();
  render();
}

function startElapsedTimer(): void {
  stopElapsedTimer();
  elapsedTimer = window.setInterval(render, 100);
}

function stopElapsedTimer(): void {
  if (elapsedTimer !== undefined) {
    window.clearInterval(elapsedTimer);
    elapsedTimer = undefined;
  }
}

function exportJson(): void {
  downloadFile(
    `keyease-lab-${new Date().toISOString()}.json`,
    JSON.stringify(completedTrials, null, 2),
    "application/json",
  );
}

function exportCsv(): void {
  downloadFile(`keyease-lab-${new Date().toISOString()}.csv`, trialsToCsv(completedTrials), "text/csv");
}

function clearLocalData(): void {
  const confirmed = window.confirm("Clear all locally stored KeyEase Lab trial data?");

  if (!confirmed) {
    return;
  }

  completedTrials = [];
  lastTrial = null;
  clearTrials();
  render();
}

function render(): void {
  const currentTrialNumber = activeTrial ? targetIndex + 1 : 0;
  const elapsed =
    activeTrial?.startedAtEpochMs === null || !activeTrial
      ? 0
      : Math.max(0, Date.now() - activeTrial.startedAtEpochMs);
  const exactMatch = activeTrial ? typingInput.value === activeTrial.target : false;

  currentTrialStat.textContent = `${currentTrialNumber} / ${targets.length}`;
  completedStat.textContent = String(completedTrials.length);
  elapsedStat.textContent = `${elapsed} ms`;
  matchStat.textContent = exactMatch ? "Yes" : "No";
  matchStat.dataset.match = String(exactMatch);
  backspaceStat.textContent = String(activeTrial?.backspaceCount ?? 0);
  lastDurationStat.textContent = lastTrial ? `${lastTrial.durationMs} ms` : "None";
  lastDistanceStat.textContent = lastTrial ? String(lastTrial.editDistance) : "None";
}

function renderTarget(target: string): string {
  return Array.from(target)
    .map((character) => {
      const hint = getCharacterHint(character);
      const hintMarkup = hint ? `<span class="char-hint">${hint}</span>` : "";

      return `
        <span class="target-char${hint ? " is-ambiguous" : ""}" aria-label="${getCharacterLabel(character)}">
          <span class="char-value">${escapeHtml(character)}</span>
          ${hintMarkup}
        </span>
      `;
    })
    .join("");
}

function getCharacterHint(character: string): string {
  if (character === "0") return "zero";
  if (character === "O") return "cap O";
  if (character === "o") return "low o";

  return "";
}

function getCharacterLabel(character: string): string {
  const hint = getCharacterHint(character);

  return hint ? `${hint}: ${character}` : character;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

startButton.addEventListener("click", startSession);
skipButton.addEventListener("click", skipString);
finishButton.addEventListener("click", finishTrial);
exportJsonButton.addEventListener("click", exportJson);
exportCsvButton.addEventListener("click", exportCsv);
clearButton.addEventListener("click", clearLocalData);

typingInput.addEventListener("keydown", (event) => {
  if (!activeTrial) {
    return;
  }

  if (activeTrial.startedAtEpochMs === null) {
    startTrialIfNeeded(event);
  } else {
    recordKeydown(event);
  }

  if (event.key === "Enter") {
    event.preventDefault();
    finishTrial();
  }

  window.requestAnimationFrame(render);
});

typingInput.addEventListener("input", render);

render();
