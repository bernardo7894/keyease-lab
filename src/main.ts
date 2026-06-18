import "./style.css";
import {
  clearTrials,
  computeTargetFeatures,
  downloadFile,
  generateTargets,
  levenshteinDistance,
  loadTrials,
  median,
  saveTrials,
  settingsForSourceMode,
  trialsToCsv,
} from "./helpers";
import type { CharacterMode, GeneratorSettings, KeydownEventRecord, SourceMode, TrialRecord } from "./types";

const DEFAULT_SETTINGS: GeneratorSettings = {
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
  trialCount: 20,
};

interface ActiveTrial {
  target: string;
  startedAtEpochMs: number | null;
  backspaceCount: number;
  keydownEvents: KeydownEventRecord[];
}

let settings: GeneratorSettings = { ...DEFAULT_SETTINGS };
let currentSessionId = "";
let targets: string[] = [];
let targetIndex = 0;
let completedTrials: TrialRecord[] = loadTrials();
let currentSessionTrials: TrialRecord[] = [];
let activeTrial: ActiveTrial | null = null;
let lastTrial: TrialRecord | null = completedTrials.at(-1) ?? null;
let pendingRatingTrialId: string | null = null;
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
          <span>Source mode</span>
          <select id="sourceModeInput">
            <option value="random_lowercase">Random lowercase</option>
            <option value="pseudo_words">Pseudo words</option>
            <option value="pseudo_words_digits" selected>Pseudo words + digits</option>
            <option value="real_words">Real words</option>
            <option value="sentences">Sentences</option>
            <option value="mixed_case_digits">Mixed case + digits</option>
            <option value="mixed_case_digits_symbols">Mixed case + digits + symbols</option>
          </select>
        </label>
        <label>
          <span>Length</span>
          <input id="lengthInput" type="number" min="1" max="64" value="${DEFAULT_SETTINGS.length}" />
        </label>
        <label>
          <span>Sentence max length</span>
          <input id="sentenceMaxLengthInput" type="number" min="8" max="96" value="${DEFAULT_SETTINGS.sentenceMaxLength}" />
        </label>
        <label>
          <span>Trials</span>
          <input id="trialCountInput" type="number" min="1" max="500" value="${DEFAULT_SETTINGS.trialCount}" />
        </label>
        <label class="check">
          <input id="punctuationInput" type="checkbox" />
          <span>Punctuation</span>
        </label>
      </div>
    </section>

    <section class="rating-panel" id="ratingPanel" aria-labelledby="ratingTitle" hidden>
      <h2 id="ratingTitle">Post-trial rating</h2>
      <p>How annoying was this string to type?</p>
      <div class="rating-row" aria-label="Subjective difficulty">
        <button type="button" data-rating="1">1</button>
        <button type="button" data-rating="2">2</button>
        <button type="button" data-rating="3">3</button>
        <button type="button" data-rating="4">4</button>
        <button type="button" data-rating="5">5</button>
        <button id="skipRatingButton" type="button">Skip</button>
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

    <section class="dashboard" aria-labelledby="dashboardTitle">
      <h2 id="dashboardTitle">Dashboard</h2>
      <div class="filter-row">
        <label>
          <span>Session filter</span>
          <select id="sessionFilterInput">
            <option value="all">All sessions</option>
          </select>
        </label>
        <label>
          <span>Source filter</span>
          <select id="sourceFilterInput">
            <option value="all">All source modes</option>
          </select>
        </label>
      </div>
      <dl class="stats-grid">
        <div><dt>Median duration</dt><dd id="dashboardMedian">None</dd></div>
        <div><dt>Success rate</dt><dd id="dashboardSuccess">None</dd></div>
        <div><dt>Avg backspaces</dt><dd id="dashboardBackspaces">None</dd></div>
      </dl>
      <div class="dashboard-grid">
        <section>
          <h3>Slowest 5 targets</h3>
          <ol id="slowestTargets"></ol>
        </section>
        <section>
          <h3>Most error-prone 5 targets</h3>
          <ol id="errorProneTargets"></ol>
        </section>
        <section>
          <h3>Average duration by characterMode</h3>
          <ol id="durationByMode"></ol>
        </section>
        <section>
          <h3>Comparison by sourceMode</h3>
          <ol id="sourceModeComparison"></ol>
        </section>
      </div>
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
const sourceModeInput = getElement<HTMLSelectElement>("sourceModeInput");
const lengthInput = getElement<HTMLInputElement>("lengthInput");
const sentenceMaxLengthInput = getElement<HTMLInputElement>("sentenceMaxLengthInput");
const trialCountInput = getElement<HTMLInputElement>("trialCountInput");
const punctuationInput = getElement<HTMLInputElement>("punctuationInput");
const ratingPanel = getElement<HTMLElement>("ratingPanel");
const skipRatingButton = getElement<HTMLButtonElement>("skipRatingButton");
const currentTrialStat = getElement<HTMLElement>("currentTrialStat");
const completedStat = getElement<HTMLElement>("completedStat");
const elapsedStat = getElement<HTMLElement>("elapsedStat");
const matchStat = getElement<HTMLElement>("matchStat");
const backspaceStat = getElement<HTMLElement>("backspaceStat");
const lastDurationStat = getElement<HTMLElement>("lastDurationStat");
const lastDistanceStat = getElement<HTMLElement>("lastDistanceStat");
const dashboardMedian = getElement<HTMLElement>("dashboardMedian");
const dashboardSuccess = getElement<HTMLElement>("dashboardSuccess");
const dashboardBackspaces = getElement<HTMLElement>("dashboardBackspaces");
const slowestTargets = getElement<HTMLOListElement>("slowestTargets");
const errorProneTargets = getElement<HTMLOListElement>("errorProneTargets");
const durationByMode = getElement<HTMLOListElement>("durationByMode");
const sourceModeComparison = getElement<HTMLOListElement>("sourceModeComparison");
const sessionFilterInput = getElement<HTMLSelectElement>("sessionFilterInput");
const sourceFilterInput = getElement<HTMLSelectElement>("sourceFilterInput");

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}.`);
  }

  return element as T;
}

function readSettings(): GeneratorSettings {
  return settingsForSourceMode({
    generationMode: getGenerationMode(),
    sourceMode: getSourceMode(),
    characterMode: "lowercase_digits",
    length: clampNumber(lengthInput.valueAsNumber, 1, 64),
    sentenceMaxLength: clampNumber(sentenceMaxLengthInput.valueAsNumber, 8, 96),
    punctuationEnabled: punctuationInput.checked,
    includeLowercase: true,
    includeUppercase: false,
    includeDigits: true,
    includeSymbols: false,
    trialCount: clampNumber(trialCountInput.valueAsNumber, 1, 500),
  });
}

function getGenerationMode(): GeneratorSettings["generationMode"] {
  if (sourceModeInput.value === "random_lowercase") {
    return "random";
  }

  if (sourceModeInput.value === "mixed_case_digits" || sourceModeInput.value === "mixed_case_digits_symbols") {
    return "easyWord";
  }

  if (sourceModeInput.value === "pseudo_words" || sourceModeInput.value === "pseudo_words_digits") {
    return "wordLike";
  }

  return "easyWord";
}

function getSourceMode(): SourceMode {
  const value = sourceModeInput.value;
  const sourceModes: SourceMode[] = [
    "random_lowercase",
    "pseudo_words",
    "pseudo_words_digits",
    "real_words",
    "sentences",
    "mixed_case_digits",
    "mixed_case_digits_symbols",
  ];

  return sourceModes.includes(value as SourceMode) ? (value as SourceMode) : "pseudo_words_digits";
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function startSession(): void {
  settings = readSettings();
  currentSessionId = crypto.randomUUID();
  targets = generateTargets(settings);
  currentSessionTrials = [];
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
  if (!targets.length || !activeTrial) {
    return;
  }

  storeSkippedTrial();
  moveToNextTarget();
}

function storeSkippedTrial(): void {
  if (!activeTrial) return;

  const now = Date.now();
  const record: TrialRecord = {
    trialId: crypto.randomUUID(),
    sessionId: currentSessionId,
    sourceMode: settings.sourceMode,
    characterMode: settings.characterMode,
    generatorConfig: settings,
    target: activeTrial.target,
    targetFeatures: computeTargetFeatures(activeTrial.target),
    typed: "",
    startedAtEpochMs: now,
    endedAtEpochMs: now,
    durationMs: 0,
    success: false,
    backspaceCount: 0,
    editDistance: activeTrial.target.length,
    possiblePause: false,
    skipped: true,
    keydownEvents: [],
  };

  completedTrials = [...completedTrials, record];
  saveTrials(completedTrials);
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

  if (activeTrial.startedAtEpochMs === null) {
    return;
  }

  const endedAtEpochMs = Date.now();
  const startedAtEpochMs = activeTrial.startedAtEpochMs ?? endedAtEpochMs;
  const typed = typingInput.value;
  const editDistance = levenshteinDistance(activeTrial.target, typed);
  const sessionMedianDuration = median(currentSessionTrials.map((trial) => trial.durationMs));
  const durationMs = endedAtEpochMs - startedAtEpochMs;
  const record: TrialRecord = {
    trialId: crypto.randomUUID(),
    sessionId: currentSessionId,
    sourceMode: settings.sourceMode,
    characterMode: settings.characterMode,
    generatorConfig: settings,
    target: activeTrial.target,
    targetFeatures: computeTargetFeatures(activeTrial.target),
    typed,
    startedAtEpochMs,
    endedAtEpochMs,
    durationMs,
    success: typed === activeTrial.target,
    backspaceCount: activeTrial.backspaceCount,
    editDistance,
    possiblePause: currentSessionTrials.length >= 3 && sessionMedianDuration > 0 && durationMs > sessionMedianDuration * 3,
    skipped: false,
    keydownEvents: activeTrial.keydownEvents,
  };

  completedTrials = [...completedTrials, record];
  currentSessionTrials = [...currentSessionTrials, record];
  lastTrial = record;
  pendingRatingTrialId = record.trialId;
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
  currentSessionTrials = [];
  lastTrial = null;
  pendingRatingTrialId = null;
  clearTrials();
  render();
}

function ratePendingTrial(rating: number): void {
  if (!pendingRatingTrialId) {
    return;
  }

  completedTrials = completedTrials.map((trial) =>
    trial.trialId === pendingRatingTrialId ? { ...trial, subjectiveDifficulty: rating } : trial,
  );
  currentSessionTrials = currentSessionTrials.map((trial) =>
    trial.trialId === pendingRatingTrialId ? { ...trial, subjectiveDifficulty: rating } : trial,
  );
  lastTrial = completedTrials.at(-1) ?? null;
  pendingRatingTrialId = null;
  saveTrials(completedTrials);
  render();
}

function skipPendingRating(): void {
  pendingRatingTrialId = null;
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
  ratingPanel.hidden = pendingRatingTrialId === null;
  renderDashboard();
}

function renderDashboard(): void {
  syncFilters();
  const trials = getFilteredTrials().filter((trial) => !trial.skipped);
  const durations = trials.map((trial) => trial.durationMs);
  const successCount = trials.filter((trial) => trial.success).length;
  const backspaceTotal = trials.reduce((total, trial) => total + trial.backspaceCount, 0);

  dashboardMedian.textContent = durations.length ? `${Math.round(median(durations))} ms` : "None";
  dashboardSuccess.textContent = trials.length ? `${Math.round((successCount / trials.length) * 100)}%` : "None";
  dashboardBackspaces.textContent = trials.length ? (backspaceTotal / trials.length).toFixed(2) : "None";
  slowestTargets.innerHTML = renderTrialList([...trials].sort((left, right) => right.durationMs - left.durationMs).slice(0, 5));
  errorProneTargets.innerHTML = renderTrialList(
    [...trials]
      .sort((left, right) => right.editDistance - left.editDistance || right.backspaceCount - left.backspaceCount)
      .slice(0, 5),
  );
  durationByMode.innerHTML = renderDurationByMode(trials);
  sourceModeComparison.innerHTML = renderSourceModeComparison(trials);
}

function syncFilters(): void {
  const selectedSession = sessionFilterInput.value;
  const selectedSource = sourceFilterInput.value;
  const sessionIds = uniqueValues(completedTrials.map((trial) => trial.sessionId).filter(Boolean));
  const sourceModes = uniqueValues(completedTrials.map((trial) => trial.sourceMode).filter(Boolean));

  sessionFilterInput.innerHTML = `<option value="all">All sessions</option>${sessionIds
    .map((sessionId) => `<option value="${escapeHtml(sessionId)}">${escapeHtml(sessionId.slice(0, 8))}</option>`)
    .join("")}`;
  sourceFilterInput.innerHTML = `<option value="all">All source modes</option>${sourceModes
    .map((sourceMode) => `<option value="${escapeHtml(sourceMode)}">${escapeHtml(sourceMode)}</option>`)
    .join("")}`;
  sessionFilterInput.value = sessionIds.includes(selectedSession) ? selectedSession : "all";
  sourceFilterInput.value = sourceModes.includes(selectedSource) ? selectedSource : "all";
}

function getFilteredTrials(): TrialRecord[] {
  return completedTrials.filter((trial) => {
    const sessionMatches = sessionFilterInput.value === "all" || trial.sessionId === sessionFilterInput.value;
    const sourceMatches = sourceFilterInput.value === "all" || trial.sourceMode === sourceFilterInput.value;

    return sessionMatches && sourceMatches;
  });
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function renderTrialList(trials: TrialRecord[]): string {
  if (!trials.length) {
    return "<li>None</li>";
  }

  return trials
    .map(
      (trial) =>
        `<li><code>${escapeHtml(trial.target)}</code> <span>${trial.durationMs} ms, ${trial.editDistance} edits, ${trial.backspaceCount} backs</span></li>`,
    )
    .join("");
}

function renderDurationByMode(trials: TrialRecord[]): string {
  const modes: CharacterMode[] = [
    "lowercase",
    "lowercase_digits",
    "mixed_case",
    "mixed_case_digits",
    "mixed_case_digits_symbols",
  ];
  const rows = modes
    .map((mode) => {
      const modeTrials = trials.filter((trial) => trial.characterMode === mode);
      const average =
        modeTrials.reduce((total, trial) => total + trial.durationMs, 0) / Math.max(1, modeTrials.length);

      return modeTrials.length ? `<li><code>${mode}</code> <span>${Math.round(average)} ms</span></li>` : "";
    })
    .filter(Boolean);

  return rows.length ? rows.join("") : "<li>None</li>";
}

function renderSourceModeComparison(trials: TrialRecord[]): string {
  const sourceModes: SourceMode[] = [
    "random_lowercase",
    "pseudo_words",
    "pseudo_words_digits",
    "real_words",
    "sentences",
    "mixed_case_digits",
    "mixed_case_digits_symbols",
  ];
  const rows = sourceModes
    .map((sourceMode) => {
      const modeTrials = trials.filter((trial) => trial.sourceMode === sourceMode);
      if (!modeTrials.length) return "";

      const durationMedian = median(modeTrials.map((trial) => trial.durationMs));
      const msPerCharMedian = median(
        modeTrials.map((trial) => trial.durationMs / Math.max(1, trial.targetFeatures?.length ?? trial.target.length)),
      );
      const successRate = (modeTrials.filter((trial) => trial.success).length / modeTrials.length) * 100;
      const averageBackspaces = modeTrials.reduce((total, trial) => total + trial.backspaceCount, 0) / modeTrials.length;
      const averageEditDistance = modeTrials.reduce((total, trial) => total + trial.editDistance, 0) / modeTrials.length;

      return `<li><code>${sourceMode}</code> <span>${modeTrials.length} trials, ${Math.round(durationMedian)} ms med, ${Math.round(msPerCharMedian)} ms/char, ${Math.round(successRate)}% ok, ${averageBackspaces.toFixed(2)} backs, ${averageEditDistance.toFixed(2)} edits</span></li>`;
    })
    .filter(Boolean);

  return rows.length ? rows.join("") : "<li>None</li>";
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
  if (character === " ") return "space";
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
  if (value === " ") {
    return "&nbsp;";
  }

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
sessionFilterInput.addEventListener("change", render);
sourceFilterInput.addEventListener("change", render);
skipRatingButton.addEventListener("click", skipPendingRating);
ratingPanel.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement) || !target.dataset.rating) {
    return;
  }

  ratePendingTrial(Number(target.dataset.rating));
});

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
