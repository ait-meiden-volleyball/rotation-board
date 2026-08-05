const POSITIONS = ["backLeft", "backCenter", "backRight", "frontLeft", "frontCenter", "frontRight"];
const FRONT = ["frontLeft", "frontCenter", "frontRight"];
const BACK = ["backLeft", "backCenter", "backRight"];
const POSITION_LABELS = {
  backLeft: "後左",
  backCenter: "後中",
  backRight: "後右",
  frontLeft: "前左",
  frontCenter: "前中",
  frontRight: "前右",
};

const DEFAULT_DATA = {
  serveStart: "opponent",
  teams: {
    meiden: {
      teamName: "清風",
      players: [
        { name: "澤田\nL", number: "1" },
        { name: "石川\nMB\nJ", number: "2" },
        { name: "田原\nMB\nJ", number: "3" },
        { name: "西村\nOH\nJ", number: "4" },
        { name: "伊藤\nOP\nJ", number: "5" },
        { name: "森田\nS\nJF", number: "6" },
        { name: "池ノ上\nMB\nJF", number: "7" },
        { name: "森脇\nMB\nHB", number: "8" },
        { name: "出口\nOH\nJF", number: "9" },
        { name: "田中\nOH\nJF", number: "10" },
        { name: "", number: "" },
        { name: "", number: "" },
      ],
      selected: ["meiden-4", "meiden-1", "meiden-9", "meiden-3", "meiden-2", "meiden-5"],
      aces: ["meiden-3"],
      blockers: ["meiden-2"],
      setter: "meiden-5",
      keyRote: "",
      court: {
        frontLeft: "meiden-4",
        frontCenter: "meiden-1",
        frontRight: "meiden-9",
        backLeft: "meiden-3",
        backCenter: "meiden-2",
        backRight: "meiden-5",
      },
    },
    opponent: {
      teamName: "駿台",
      players: [
        { name: "小布施\nMB\nJF", number: "1" },
        { name: "今淵\nMB\nJF", number: "2" },
        { name: "落合\nOH\nJ", number: "3" },
        { name: "畠\nOP\nJ(左)", number: "4" },
        { name: "竹内 祐\nOH\nJ", number: "5" },
        { name: "イ\nS\nJF", number: "6" },
        { name: "井上\nL", number: "7" },
        { name: "竹内 颯\nS,OH\nHB", number: "8" },
        { name: "前田\nOH\nJ", number: "9" },
        { name: "清野\nS\nJF", number: "10" },
        { name: "野中\nMB\nJF", number: "11" },
        { name: "", number: "" },
      ],
      selected: ["opponent-3", "opponent-0", "opponent-4", "opponent-2", "opponent-10", "opponent-5"],
      aces: ["opponent-4"],
      blockers: ["opponent-0"],
      setter: "opponent-5",
      keyRote: "",
      court: {
        backLeft: "opponent-3",
        backCenter: "opponent-0",
        backRight: "opponent-4",
        frontLeft: "opponent-2",
        frontCenter: "opponent-10",
        frontRight: "opponent-5",
      },
    },
  },
};
const DEFAULT_SETUP = DEFAULT_DATA.teams;
const defaultOpponentPlayers = DEFAULT_SETUP.opponent.players;
const roster = DEFAULT_SETUP.meiden.players;
const state = {
  selectedOpponent: new Set(DEFAULT_SETUP.opponent.selected),
  selectedMeiden: new Set(DEFAULT_SETUP.meiden.selected),
  opponentAces: new Set(DEFAULT_SETUP.opponent.aces),
  opponentBlockers: new Set(DEFAULT_SETUP.opponent.blockers),
  meidenAces: new Set(DEFAULT_SETUP.meiden.aces),
  meidenBlockers: new Set(DEFAULT_SETUP.meiden.blockers),
  opponentSetter: DEFAULT_SETUP.opponent.setter,
  meidenSetter: DEFAULT_SETUP.meiden.setter,
  opponentKeyRote: "",
  meidenKeyRote: "",
  config: null,
  rotationProgressInitialized: false,
  meidenOffset: 0,
  opponentOffset: 0,
  serveMarkerSide: DEFAULT_DATA.serveStart,
  serveStep: 0,
  setupPersistenceReady: false,
  manualCourtInput: {
    opponent: false,
    meiden: false,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const ROTATION_PROGRESS_KEY = "rotationBoardProgressV2";
const SETUP_STATE_KEY = "rotationBoardSetupV2";
const LEGACY_ROTATION_PROGRESS_KEYS = ["rotationBoardProgressV1"];
const LEGACY_SETUP_STATE_KEYS = ["rotationBoardSetupV1"];
const MAX_NAME_LINES = 3;

function normalizeOffset(value) {
  return ((value % 6) + 6) % 6;
}

function signedOffset(value) {
  const normalized = normalizeOffset(value);
  if (normalized === 0) return "±0";
  if (normalized <= 3) return `+${normalized}`;
  return `-${6 - normalized}`;
}

function saveRotationProgress() {
  try {
    localStorage.setItem(
      ROTATION_PROGRESS_KEY,
      JSON.stringify({
        homeRotationOffset: state.meidenOffset,
        awayRotationOffset: state.opponentOffset,
        serveTeam: state.serveMarkerSide,
        serveStep: state.serveStep,
        rotationProgressInitialized: state.rotationProgressInitialized,
      }),
    );
  } catch {
    // localStorage may be unavailable in private browsing or restricted embeds.
  }
}

function removeStoredKeys(keys) {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage may be unavailable in private browsing or restricted embeds.
  }
}

function restoreRotationProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROTATION_PROGRESS_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    const homeOffset = saved.homeRotationOffset ?? saved.meidenOffset;
    const awayOffset = saved.awayRotationOffset ?? saved.opponentOffset;
    const serveTeam = saved.serveTeam ?? saved.serveMarkerSide;
    const hasSavedProgress =
      Number.isFinite(homeOffset) ||
      Number.isFinite(awayOffset) ||
      serveTeam === "meiden" ||
      serveTeam === "opponent" ||
      Number.isFinite(saved.serveStep);
    if (Number.isFinite(homeOffset)) state.meidenOffset = homeOffset;
    if (Number.isFinite(awayOffset)) state.opponentOffset = awayOffset;
    if (serveTeam === "meiden" || serveTeam === "opponent") {
      state.serveMarkerSide = serveTeam;
    }
    if (Number.isFinite(saved.serveStep)) state.serveStep = saved.serveStep;
    state.rotationProgressInitialized = Boolean(saved.rotationProgressInitialized ?? saved.hasStartedAnalysis ?? hasSavedProgress);
  } catch {
    // Ignore corrupt saved progress and continue with defaults.
  }
}

function clearRotationProgress() {
  state.config = null;
  state.rotationProgressInitialized = false;
  state.meidenOffset = 0;
  state.opponentOffset = 0;
  state.serveMarkerSide = $("input[name='serveStart']:checked")?.value || "meiden";
  state.serveStep = 0;
  removeStoredKeys([ROTATION_PROGRESS_KEY, ...LEGACY_ROTATION_PROGRESS_KEYS]);
}

function initializeRotationProgress(serveTeam) {
  state.meidenOffset = 0;
  state.opponentOffset = 0;
  state.serveMarkerSide = serveTeam;
  state.serveStep = 0;
  state.rotationProgressInitialized = true;
  saveRotationProgress();
}

function markRotationProgressChanged() {
  state.rotationProgressInitialized = true;
  saveRotationProgress();
}

function sanitizePlayerName(value) {
  return value.replace(/\r\n?/g, "\n").split("\n").slice(0, MAX_NAME_LINES).join("\n");
}

function canInsertNameLineBreak(input) {
  const value = input.value.replace(/\r\n?/g, "\n");
  const selectionStart = input.selectionStart ?? value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const selectedLineBreaks = (selectedText.match(/\n/g) || []).length;
  const currentLineBreaks = (value.match(/\n/g) || []).length;
  return currentLineBreaks - selectedLineBreaks < MAX_NAME_LINES - 1;
}

function insertNameLineBreak(input, refresh) {
  if (!canInsertNameLineBreak(input)) return;
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  if (typeof input.setRangeText === "function") {
    input.setRangeText("\n", selectionStart, selectionEnd, "end");
  } else {
    input.value = `${input.value.slice(0, selectionStart)}\n${input.value.slice(selectionEnd)}`;
    input.selectionStart = input.selectionEnd = selectionStart + 1;
  }
  input.value = sanitizePlayerName(input.value);
  refresh();
}

function bindNameInput(input, refresh) {
  let enterHandled = false;
  let enterResetTimer = 0;
  const handleEnter = (event) => {
    event.preventDefault();
    if (!enterHandled) {
      insertNameLineBreak(input, refresh);
      enterHandled = true;
      window.clearTimeout(enterResetTimer);
      enterResetTimer = window.setTimeout(() => {
        enterHandled = false;
      }, 0);
    }
  };

  input.addEventListener("beforeinput", (event) => {
    if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph" || event.data === "\n") {
      handleEnter(event);
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    handleEnter(event);
  });
  input.addEventListener("keypress", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    handleEnter(event);
  });
  input.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      enterHandled = false;
    }
  });
  input.addEventListener("input", () => {
    enterHandled = false;
    const limited = sanitizePlayerName(input.value);
    if (input.value !== limited) input.value = limited;
    refresh();
  });
}

function createNameTextarea(value, ariaLabel, refresh) {
  const input = document.createElement("textarea");
  input.value = sanitizePlayerName(value || "");
  input.placeholder = "Name";
  input.rows = MAX_NAME_LINES;
  input.enterKeyHint = "enter";
  input.inputMode = "text";
  input.wrap = "soft";
  input.ariaLabel = ariaLabel;
  input.dataset.field = "name";
  bindNameInput(input, refresh);
  return input;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function multilineNameHtml(value) {
  const lines = sanitizePlayerName(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
}

function teamInputData(team) {
  const selector = team === "opponent" ? "#opponentInputs .role-player-card" : "#meidenRoster .role-player-card";
  return $$(selector).map((card) => ({
    name: sanitizePlayerName(card.querySelector('[data-field="name"]')?.value || ""),
    number: normalizeNumberText(card.querySelector('input[data-field="number"]')?.value || ""),
  }));
}

function courtData(team) {
  const court = {};
  $$(`select[data-team="${team}"]`).forEach((select) => {
    court[select.dataset.position] = select.value;
  });
  return court;
}

function saveSetupState() {
  if (!state.setupPersistenceReady) return;
  try {
    localStorage.setItem(
      SETUP_STATE_KEY,
      JSON.stringify({
        teamNames: {
          meiden: $("#homeTeamName")?.value || "",
          opponent: $("#opponentTeamName")?.value || "",
        },
        players: {
          meiden: teamInputData("meiden"),
          opponent: teamInputData("opponent"),
        },
        selected: {
          meiden: Array.from(state.selectedMeiden),
          opponent: Array.from(state.selectedOpponent),
        },
        roles: {
          meidenAces: Array.from(state.meidenAces),
          meidenBlockers: Array.from(state.meidenBlockers),
          opponentAces: Array.from(state.opponentAces),
          opponentBlockers: Array.from(state.opponentBlockers),
          meidenSetter: state.meidenSetter,
          opponentSetter: state.opponentSetter,
          meidenKeyRote: state.meidenKeyRote,
          opponentKeyRote: state.opponentKeyRote,
        },
        court: {
          meiden: courtData("meiden"),
          opponent: courtData("opponent"),
        },
        serveStart: $("input[name='serveStart']:checked")?.value || "opponent",
      }),
    );
  } catch {
    // localStorage may be unavailable in private browsing or restricted embeds.
  }
}

function restoreSetupState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_STATE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;

    setTeamName("meiden", saved.teamNames?.meiden || "");
    setTeamName("opponent", saved.teamNames?.opponent || "");
    if (Array.isArray(saved.players?.meiden)) setTeamInputs("meiden", saved.players.meiden);
    if (Array.isArray(saved.players?.opponent)) setTeamInputs("opponent", saved.players.opponent);

    state.selectedMeiden = new Set(Array.isArray(saved.selected?.meiden) ? saved.selected.meiden : []);
    state.selectedOpponent = new Set(Array.isArray(saved.selected?.opponent) ? saved.selected.opponent : []);
    state.meidenAces = new Set(Array.isArray(saved.roles?.meidenAces) ? saved.roles.meidenAces : []);
    state.meidenBlockers = new Set(Array.isArray(saved.roles?.meidenBlockers) ? saved.roles.meidenBlockers : []);
    state.opponentAces = new Set(Array.isArray(saved.roles?.opponentAces) ? saved.roles.opponentAces : []);
    state.opponentBlockers = new Set(Array.isArray(saved.roles?.opponentBlockers) ? saved.roles.opponentBlockers : []);
    state.meidenSetter = saved.roles?.meidenSetter || "";
    state.opponentSetter = saved.roles?.opponentSetter || "";
    state.meidenKeyRote = saved.roles?.meidenKeyRote || "";
    state.opponentKeyRote = saved.roles?.opponentKeyRote || "";
    $("#meidenKeyRote").value = state.meidenKeyRote;
    $("#opponentKeyRote").value = state.opponentKeyRote;

    if (saved.serveStart === "meiden" || saved.serveStart === "opponent") {
      const serveRadio = $(`input[name="serveStart"][value="${saved.serveStart}"]`);
      if (serveRadio) serveRadio.checked = true;
    }

    refreshOpponentSelects();
    refreshMeidenSelects();
    if (saved.court?.opponent) renderCourtSelects("opponent", Object.values(saved.court.opponent), { autofill: false, court: saved.court.opponent });
    if (saved.court?.meiden) renderCourtSelects("meiden", Object.values(saved.court.meiden), { autofill: false, court: saved.court.meiden });
    renderRoleSelects();
    updateRoleCards("opponent");
    updateRoleCards("meiden");
  } catch {
    // Ignore corrupt saved setup state and continue with defaults.
  }
}

function startRotationLabel(value) {
  return `R${normalizeOffset(value) + 1}`;
}

function rotateCourt(court, steps) {
  let current = { ...court };
  for (let i = 0; i < normalizeOffset(steps); i += 1) {
    current = {
      backLeft: current.backCenter,
      backCenter: current.backRight,
      backRight: current.frontRight,
      frontLeft: current.backLeft,
      frontCenter: current.frontLeft,
      frontRight: current.frontCenter,
    };
  }
  return current;
}

function getServer(court, rotationIndex) {
  return rotateCourt(court, rotationIndex).backRight;
}

function opponentSteps(index) {
  return -(state.opponentOffset + index);
}

function meidenSteps(index) {
  return state.meidenOffset + index;
}

function createOption(value, label = value) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function buildOpponentInputs() {
  const wrapper = $("#opponentInputs");
  wrapper.innerHTML = "";
  defaultOpponentPlayers.forEach((player, index) => {
    const id = `opponent-${index}`;
    const tile = document.createElement("div");
    tile.className = "role-player-card";
    tile.dataset.playerId = id;
    const nameInput = createNameTextarea(player.name, `相手選手名${index + 1}`, refreshOpponentSelects);
    const numberInput = document.createElement("input");
    numberInput.type = "text";
    numberInput.inputMode = "numeric";
    numberInput.value = player.number;
    numberInput.placeholder = "No.";
    numberInput.ariaLabel = `相手背番号${index + 1}`;
    numberInput.dataset.field = "number";
    numberInput.dataset.previousNumber = player.number;
    numberInput.addEventListener("input", refreshOpponentSelects);
    bindUniqueNumberInput("opponent", numberInput, refreshOpponentSelects);
    tile.append(nameInput, numberInput);
    tile.addEventListener("click", (event) => {
      if (event.target.matches("input, textarea")) return;
      toggleStarter("opponent", id);
    });
    wrapper.append(tile);
  });
}

function buildRoster() {
  const wrapper = $("#meidenRoster");
  wrapper.innerHTML = "";
  roster.forEach((player, index) => {
    const id = `meiden-${index}`;
    const tile = document.createElement("div");
    tile.className = "role-player-card";
    tile.dataset.playerId = id;
    const nameInput = createNameTextarea(player.name, `自チーム選手名${index + 1}`, refreshMeidenSelects);
    const numberInput = document.createElement("input");
    numberInput.type = "text";
    numberInput.inputMode = "numeric";
    numberInput.value = player.number;
    numberInput.placeholder = "No.";
    numberInput.ariaLabel = `自チーム背番号${index + 1}`;
    numberInput.dataset.field = "number";
    numberInput.dataset.previousNumber = player.number;
    numberInput.addEventListener("input", refreshMeidenSelects);
    bindUniqueNumberInput("meiden", numberInput, refreshMeidenSelects);
    tile.append(nameInput, numberInput);
    tile.addEventListener("click", (event) => {
      if (event.target.matches("input, textarea")) return;
      toggleStarter("meiden", id);
    });
    wrapper.append(tile);
  });
}

function defaultPlayersFor(team) {
  return team === "opponent" ? defaultOpponentPlayers : roster;
}

function setTeamName(team, value) {
  const input = team === "opponent" ? $("#opponentTeamName") : $("#homeTeamName");
  const mobileInput = team === "opponent" ? $("#mobileOpponentTeamName") : $("#mobileHomeTeamName");
  const label = team === "opponent" ? $("#setupOpponentCourtLabel") : $("#setupHomeCourtLabel");
  input.value = value;
  if (mobileInput) mobileInput.value = value;
  label.textContent = value || (team === "opponent" ? "AWAY TEAM" : "HOME TEAM");
}

function setDefaultServeStart() {
  const serveStart = DEFAULT_DATA.serveStart === "meiden" ? "meiden" : "opponent";
  const serveRadio = $(`input[name="serveStart"][value="${serveStart}"]`);
  if (serveRadio) serveRadio.checked = true;
  state.serveMarkerSide = serveStart;
  state.serveStep = 0;
}

function setTeamInputs(team, players) {
  const selector = team === "opponent" ? "#opponentInputs .role-player-card" : "#meidenRoster .role-player-card";
  $$(selector).forEach((card, index) => {
    const player = players[index] || { name: "", number: "" };
    const nameInput = card.querySelector('[data-field="name"]');
    const numberInput = card.querySelector('input[data-field="number"]');
    nameInput.value = sanitizePlayerName(player.name || "");
    numberInput.value = player.number;
    numberInput.dataset.previousNumber = player.number;
  });
}

function setDefaultRoles(team) {
  const defaults = DEFAULT_SETUP[team];
  if (team === "opponent") {
    state.selectedOpponent = new Set(defaults.selected);
    state.opponentAces = new Set(defaults.aces);
    state.opponentBlockers = new Set(defaults.blockers);
    state.opponentSetter = defaults.setter;
    state.opponentKeyRote = defaults.keyRote || "";
    state.opponentOffset = 0;
    $("#opponentKeyRote").value = state.opponentKeyRote;
  } else {
    state.selectedMeiden = new Set(defaults.selected);
    state.meidenAces = new Set(defaults.aces);
    state.meidenBlockers = new Set(defaults.blockers);
    state.meidenSetter = defaults.setter;
    state.meidenKeyRote = defaults.keyRote || "";
    state.meidenOffset = 0;
    $("#meidenKeyRote").value = state.meidenKeyRote;
  }
}

function numberInputs(team) {
  const selector = team === "opponent" ? "#opponentInputs" : "#meidenRoster";
  return $$(`${selector} input[data-field="number"]`);
}

function normalizeNumberText(value) {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).trim();
}

function hasSameNumber(team, input, value) {
  if (!value) return false;
  return numberInputs(team).some((otherInput) => otherInput !== input && normalizeNumberText(otherInput.value) === value);
}

function bindUniqueNumberInput(team, input, refresh) {
  input.addEventListener("focus", () => {
    input.value = normalizeNumberText(input.value);
    input.dataset.previousNumber = input.value;
  });

  input.addEventListener("input", () => {
    const normalized = normalizeNumberText(input.value);
    if (input.value !== normalized) input.value = normalized;
  });

  input.addEventListener("change", () => {
    const value = normalizeNumberText(input.value);
    input.value = value;
    if (hasSameNumber(team, input, value)) {
      alert("同じチーム内で同じ背番号は登録できません。");
      input.value = input.dataset.previousNumber || "";
    } else {
      input.dataset.previousNumber = value;
    }
    refresh();
  });
}

function getPlayers(team) {
  const selector = team === "opponent" ? "#opponentInputs .role-player-card" : "#meidenRoster .role-player-card";
  return $$(selector)
    .map((card) => {
      const id = card.dataset.playerId;
      const nameInput = card.querySelector('[data-field="name"]');
      const name = sanitizePlayerName(nameInput.value);
      if (nameInput.value !== name) nameInput.value = name;
      const numberInput = card.querySelector('input[data-field="number"]');
      const number = normalizeNumberText(numberInput.value);
      if (numberInput.value !== number) numberInput.value = number;
      return {
        id,
        name,
        number,
        label: playerLabel({ name, number }),
      };
    })
    .filter((player) => player.name.trim() || player.number);
}

function playerLabel(player) {
  const name = sanitizePlayerName(player.name || "").trim().replace(/\n/g, " / ");
  if (name && player.number) return `${name} ${player.number}`;
  return name || player.number || "";
}

function playerMap(team) {
  return Object.fromEntries(getPlayers(team).map((player) => [player.id, player]));
}

function registeredIds(team) {
  return getPlayers(team).map((player) => player.id);
}

function getOpponentStarters() {
  const ids = registeredIds("opponent");
  return Array.from(state.selectedOpponent).filter((value) => ids.includes(value));
}

function getMeidenPlayers() {
  const ids = registeredIds("meiden");
  return Array.from(state.selectedMeiden).filter((value) => ids.includes(value));
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function replaceOptions(select, values) {
  const previous = select.value;
  select.innerHTML = "";
  values.forEach((value) => select.append(createOption(value)));
  if (values.includes(previous)) select.value = previous;
}

function replaceRoleOptions(select, players, selectedValue) {
  select.innerHTML = "";
  select.append(createOption("", "-"));
  players.forEach((player) => select.append(createOption(player.id, player.label)));
  select.value = players.some((player) => player.id === selectedValue) ? selectedValue : "";
}

function syncOpponentRoles() {
  const ids = registeredIds("opponent");
  state.opponentAces = new Set(Array.from(state.opponentAces).filter((value) => ids.includes(value)));
  state.opponentBlockers = new Set(Array.from(state.opponentBlockers).filter((value) => ids.includes(value)));
  if (!ids.includes(state.opponentSetter)) state.opponentSetter = "";

  if (state.opponentSetter) {
    state.opponentAces.delete(state.opponentSetter);
    state.opponentBlockers.delete(state.opponentSetter);
  }
  state.opponentAces.forEach((value) => state.opponentBlockers.delete(value));
}

function syncMeidenRoles() {
  const ids = registeredIds("meiden");
  state.meidenAces = new Set(Array.from(state.meidenAces).filter((value) => ids.includes(value)));
  state.meidenBlockers = new Set(Array.from(state.meidenBlockers).filter((value) => ids.includes(value)));
  if (!ids.includes(state.meidenSetter)) state.meidenSetter = "";

  if (state.meidenSetter) {
    state.meidenAces.delete(state.meidenSetter);
    state.meidenBlockers.delete(state.meidenSetter);
  }
  state.meidenAces.forEach((value) => state.meidenBlockers.delete(value));
}

function renderRoleSelects() {
  const opponentPlayers = getPlayers("opponent");
  const meidenPlayers = getPlayers("meiden");
  replaceRoleOptions($("#opponentSetterSelect"), opponentPlayers, state.opponentSetter);
  replaceRoleOptions($("#meidenSetterSelect"), meidenPlayers, state.meidenSetter);
  renderSetterPicker("opponentSetterMenu", "opponentSetterSummary", opponentPlayers, state.opponentSetter, (value) => {
    state.opponentSetter = value;
    if (state.opponentSetter && (state.selectedOpponent.has(state.opponentSetter) || state.selectedOpponent.size < 6)) {
      state.selectedOpponent.add(state.opponentSetter);
    }
    refreshOpponentSelects();
  });
  renderSetterPicker("meidenSetterMenu", "meidenSetterSummary", meidenPlayers, state.meidenSetter, (value) => {
    state.meidenSetter = value;
    if (state.meidenSetter && (state.selectedMeiden.has(state.meidenSetter) || state.selectedMeiden.size < 6)) {
      state.selectedMeiden.add(state.meidenSetter);
    }
    refreshMeidenSelects();
  });
  renderMultiRolePicker("aceMenu", "aceSummary", opponentPlayers, state.opponentAces, unavailableForAce("opponent"), refreshOpponentSelects);
  renderMultiRolePicker("blockerMenu", "blockerSummary", opponentPlayers, state.opponentBlockers, unavailableForBlocker("opponent"), refreshOpponentSelects);
  renderMultiRolePicker("meidenAceMenu", "meidenAceSummary", meidenPlayers, state.meidenAces, unavailableForAce("meiden"), refreshMeidenSelects);
  renderMultiRolePicker("meidenBlockerMenu", "meidenBlockerSummary", meidenPlayers, state.meidenBlockers, unavailableForBlocker("meiden"), refreshMeidenSelects);
}

function unavailableForAce(team) {
  const setter = team === "opponent" ? state.opponentSetter : state.meidenSetter;
  return new Set(setter ? [setter] : []);
}

function unavailableForBlocker(team) {
  const setter = team === "opponent" ? state.opponentSetter : state.meidenSetter;
  const aces = team === "opponent" ? state.opponentAces : state.meidenAces;
  return new Set([setter, ...aces].filter(Boolean));
}

function renderMultiRolePicker(menuId, summaryId, players, selectedSet, unavailableSet, refresh) {
  const menu = $(`#${menuId}`);
  menu.innerHTML = "";
  players.forEach((player) => {
    const label = document.createElement("label");
    label.className = "multi-option";
    const disabled = unavailableSet.has(player.id);
    label.classList.toggle("selected", selectedSet.has(player.id));
    label.classList.toggle("disabled", disabled);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedSet.has(player.id);
    checkbox.disabled = disabled;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedSet.add(player.id);
      else selectedSet.delete(player.id);
      refresh();
    });

    const text = document.createElement("span");
    text.textContent = player.label;
    label.append(checkbox, text);
    menu.append(label);
  });

  const labels = Array.from(selectedSet)
    .map((id) => players.find((player) => player.id === id)?.label)
    .filter(Boolean);
  $(`#${summaryId}`).textContent = labels.length ? labels.join("、") : "-";
}

function renderSetterPicker(menuId, summaryId, players, selectedValue, onSelect) {
  const menu = $(`#${menuId}`);
  menu.innerHTML = "";
  const options = [{ id: "", label: "-" }, ...players];

  options.forEach((player) => {
    const label = document.createElement("label");
    label.className = "multi-option";
    label.classList.toggle("selected", player.id === selectedValue);

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = menuId;
    radio.checked = player.id === selectedValue;
    radio.addEventListener("change", () => {
      onSelect(player.id);
      $$(".multi-select.open").forEach((element) => element.classList.remove("open"));
    });

    const text = document.createElement("span");
    text.textContent = player.label;
    label.append(radio, text);
    menu.append(label);
  });

  const selectedLabel = players.find((player) => player.id === selectedValue)?.label;
  $(`#${summaryId}`).textContent = selectedLabel || "-";
}

function toggleMultiSelect(pickerId) {
  const picker = $(`#${pickerId}`);
  const shouldOpen = !picker.classList.contains("open");
  $$(".multi-select.open").forEach((element) => element.classList.remove("open"));
  picker.classList.toggle("open", shouldOpen);
}

function refreshOpponentSelects() {
  const ids = registeredIds("opponent");
  state.selectedOpponent = new Set(Array.from(state.selectedOpponent).filter((value) => ids.includes(value)));
  syncOpponentRoles();
  renderRoleSelects();
  updateRoleCards("opponent");
  renderCourtSelects("opponent", getOpponentStarters());
  saveSetupState();
}

function refreshMeidenSelects() {
  const ids = registeredIds("meiden");
  state.selectedMeiden = new Set(Array.from(state.selectedMeiden).filter((value) => ids.includes(value)));
  syncMeidenRoles();
  renderRoleSelects();
  updateRoleCards("meiden");
  renderCourtSelects("meiden", getMeidenPlayers());
  saveSetupState();
}

function toggleStarter(team, value) {
  if (!value) return;
  const selectedSet = team === "opponent" ? state.selectedOpponent : state.selectedMeiden;
  if (selectedSet.has(value)) {
    selectedSet.delete(value);
  } else if (selectedSet.size < 6) {
    selectedSet.add(value);
  }
  if (team === "opponent") refreshOpponentSelects();
  else refreshMeidenSelects();
}

function roleCardClass(team, value) {
  if (team === "opponent" && state.opponentSetter === value) return "is-setter";
  if (team === "meiden" && state.meidenSetter === value) return "is-setter";
  if (team === "opponent" && state.opponentAces.has(value)) return "is-ace";
  if (team === "meiden" && state.meidenAces.has(value)) return "is-ace";
  if (team === "opponent" && state.opponentBlockers.has(value)) return "is-blocker";
  if (team === "meiden" && state.meidenBlockers.has(value)) return "is-blocker";
  if (team === "opponent" && state.selectedOpponent.has(value)) return "is-starter";
  if (team === "meiden" && state.selectedMeiden.has(value)) return "is-starter";
  return "is-normal";
}

function updateRoleCards(team) {
  const selector = team === "opponent" ? "#opponentInputs .role-player-card" : "#meidenRoster .role-player-card";
  $$(selector).forEach((card) => {
    const value = card.dataset.playerId;
    card.className = `role-player-card ${roleCardClass(team, value)}`;
  });
}

function renderCourtSelects(team, values = registeredIds(team), options = {}) {
  const shouldAutofill = options.autofill ?? !state.manualCourtInput[team];
  const players = getPlayers(team);
  const playersById = Object.fromEntries(players.map((player) => [player.id, player]));
  const previous = {};
  $$(`select[data-team="${team}"]`).forEach((select) => {
    previous[select.dataset.position] = select.value;
  });
  const selectedInCourt = options.court ? { ...options.court } : {};
  const seen = new Set();
  if (!options.court) {
    POSITIONS.forEach((position) => {
      const value = previous[position];
      if (playersById[value] && !seen.has(value)) {
        selectedInCourt[position] = value;
        seen.add(value);
      }
    });
  } else {
    POSITIONS.forEach((position) => {
      const value = selectedInCourt[position];
      if (!playersById[value] || seen.has(value)) {
        delete selectedInCourt[position];
      } else {
        seen.add(value);
      }
    });
  }
  const mapping =
    team === "opponent"
      ? [
          ["opponentBackRow", BACK],
          ["opponentFrontRow", FRONT],
        ]
      : [
          ["meidenFrontRow", FRONT],
          ["meidenBackRow", BACK],
        ];

  mapping.forEach(([id, positions]) => {
    const wrapper = $(`#${id}`);
    wrapper.innerHTML = "";
    positions.forEach((position) => {
      const slot = document.createElement("label");
      slot.className = "court-slot";
      const select = document.createElement("select");
      select.dataset.position = position;
      select.dataset.team = team;
      if (shouldAutofill && !selectedInCourt[position]) {
        const fallback = values.find((value) => playersById[value] && !Object.values(selectedInCourt).includes(value));
        if (fallback) selectedInCourt[position] = fallback;
      }
      const currentValue = selectedInCourt[position] || "";
      const usedByOtherPositions = new Set(
        Object.entries(selectedInCourt)
          .filter(([otherPosition]) => otherPosition !== position)
          .map(([, value]) => value),
      );
      if (!currentValue) select.append(createOption("", "-"));
      players
        .filter((player) => player.id === currentValue || !usedByOtherPositions.has(player.id))
        .forEach((player) => select.append(createOption(player.id, player.label)));
      select.value = playersById[currentValue] ? currentValue : "";
      select.addEventListener("change", () => {
        clearRotationProgress();
        renderCourtSelects(team);
        saveSetupState();
      });
      slot.append(select);
      wrapper.append(slot);
    });
  });
  const selectedValues = Object.values(selectedInCourt).filter(Boolean);
  if (team === "opponent") {
    state.selectedOpponent = new Set(selectedValues);
  } else {
    state.selectedMeiden = new Set(selectedValues);
  }
  updateRoleCards(team);
}

function setDefaultCourt(team) {
  const defaults = DEFAULT_SETUP[team];
  state.manualCourtInput[team] = true;
  if (team === "opponent") {
    state.selectedOpponent = new Set(Object.values(defaults.court));
  } else {
    state.selectedMeiden = new Set(Object.values(defaults.court));
  }
  renderCourtSelects(team, Object.values(defaults.court), { autofill: false, court: defaults.court });
}

function clearTeamRoles(team) {
  if (team === "opponent") {
    state.selectedOpponent = new Set();
    state.opponentAces = new Set();
    state.opponentBlockers = new Set();
    state.opponentSetter = "";
    state.opponentKeyRote = "";
    state.opponentOffset = 0;
    $("#opponentKeyRote").value = "";
  } else {
    state.selectedMeiden = new Set();
    state.meidenAces = new Set();
    state.meidenBlockers = new Set();
    state.meidenSetter = "";
    state.meidenKeyRote = "";
    state.meidenOffset = 0;
    $("#meidenKeyRote").value = "";
  }
}

function clearStartRotation(team) {
  state.manualCourtInput[team] = true;
  if (team === "opponent") {
    state.selectedOpponent = new Set();
  } else {
    state.selectedMeiden = new Set();
  }
  renderCourtSelects(team, registeredIds(team), { autofill: false, court: {} });
}

function applyTeamDefaults(team) {
  const defaults = DEFAULT_SETUP[team];
  setTeamName(team, defaults.teamName);
  setTeamInputs(team, defaultPlayersFor(team));
  setDefaultRoles(team);
  state.config = null;
  state.rotationProgressInitialized = false;
  state.manualCourtInput[team] = true;
  $$(".multi-select.open").forEach((element) => element.classList.remove("open"));
  if (team === "opponent") refreshOpponentSelects();
  else refreshMeidenSelects();
  setDefaultCourt(team);
  $("#setupError").textContent = "";
  $("#rotationCards").innerHTML = "";
  saveSetupState();
}

function resetStartRotation(team) {
  clearStartRotation(team);
  clearRotationProgress();
  $("#setupError").textContent = "";
  $("#rotationCards").innerHTML = "";
  saveSetupState();
}

function resetTeamSetup(team) {
  removeStoredKeys([SETUP_STATE_KEY, ...LEGACY_SETUP_STATE_KEYS]);
  clearRotationProgress();
  setDefaultServeStart();
  applyTeamDefaults(team);
  saveSetupState();
}

window.resetTeamSetup = resetTeamSetup;
window.resetStartRotation = resetStartRotation;

function readCourt(team) {
  const court = {};
  $$(`select[data-team="${team}"]`).forEach((select) => {
    court[select.dataset.position] = select.value;
  });
  return court;
}

function hasSixUnique(values) {
  return values.length === 6 && new Set(values).size === 6 && values.every(Boolean);
}

function hasDuplicateNumbers(players) {
  const numbers = players.map((player) => player.number).filter(Boolean);
  return numbers.length !== new Set(numbers).size;
}

function validateSetup() {
  const opponentPlayers = getPlayers("opponent");
  const meidenPlayers = getMeidenPlayers();
  const registeredMeidenPlayers = getPlayers("meiden");
  const opponentStarters = getOpponentStarters();
  const opponentCourt = readCourt("opponent");
  const meidenCourt = readCourt("meiden");

  if (opponentPlayers.length < 6) return "相手選手は最低6人、最大12人まで登録してください。";
  if (opponentPlayers.length > 12) return "相手選手は最大12人までです。";
  if (registeredMeidenPlayers.length < 6) return "自チーム選手は最低6人、最大12人まで登録してください。";
  if (registeredMeidenPlayers.length > 12) return "自チーム選手は最大12人までです。";
  if (hasDuplicateNumbers(opponentPlayers)) return "相手チーム内で背番号が重複しています。";
  if (hasDuplicateNumbers(registeredMeidenPlayers)) return "自チーム内で背番号が重複しています。";
  if (!hasSixUnique(opponentStarters)) return "相手の出場6人を選択してください。";
  if (!hasSixUnique(meidenPlayers)) return "自チームの出場6人を選択してください。";
  if (!hasSixUnique(Object.values(opponentCourt))) return "相手スタートローテは6人を重複なしで配置してください。";
  if (!hasSixUnique(Object.values(meidenCourt))) return "自チームスタートローテは6人を重複なしで配置してください。";
  if (state.opponentSetter && !Object.values(opponentCourt).includes(state.opponentSetter)) return "相手セッターは出場6人から選択してください。";
  if (state.meidenSetter && !Object.values(meidenCourt).includes(state.meidenSetter)) return "自チームセッターは出場6人から選択してください。";
  return "";
}

function switchScreen(name) {
  document.body.classList.toggle("analysis-mode", name === "analysis");
  $("#setupScreen").classList.toggle("active", name === "setup");
  $("#analysisScreen").classList.toggle("active", name === "analysis");
  $("#tabSetup").classList.toggle("active", name === "setup");
  $("#tabAnalysis").classList.toggle("active", name === "analysis");
  $("#mobileTabSetup")?.classList.toggle("active", name === "setup");
  $("#mobileTabAnalysis")?.classList.toggle("active", name === "analysis");
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function startAnalysis() {
  const error = validateSetup();
  $("#setupError").textContent = error;
  if (error) return;

  const shouldInitializeRotation = !state.rotationProgressInitialized;
  state.config = {
    homeTeamName: $("#homeTeamName").value.trim() || "HOME TEAM",
    opponentTeamName: $("#opponentTeamName").value.trim() || "AWAY TEAM",
    opponentAces: new Set(state.opponentAces),
    opponentBlockers: new Set(state.opponentBlockers),
    meidenAces: new Set(state.meidenAces),
    meidenBlockers: new Set(state.meidenBlockers),
    opponentSetter: state.opponentSetter,
    meidenSetter: state.meidenSetter,
    opponentKeyRote: state.opponentKeyRote,
    meidenKeyRote: state.meidenKeyRote,
    opponentPlayers: playerMap("opponent"),
    meidenPlayers: playerMap("meiden"),
    opponentCourt: readCourt("opponent"),
    meidenCourt: readCourt("meiden"),
    serveStart: $("input[name='serveStart']:checked").value,
  };
  if (shouldInitializeRotation) {
    initializeRotationProgress(state.config.serveStart);
  }
  renderAnalysis();
  switchScreen("analysis");
}

function tokenRole(value, team, config) {
  if (team === "opponent" && value === config.opponentSetter) return "setter";
  if (team === "opponent" && config.opponentAces.has(value)) return "ace";
  if (team === "opponent" && config.opponentBlockers.has(value)) return "blocker";
  if (team === "meiden" && value === config.meidenSetter) return "setter";
  if (team === "meiden" && config.meidenAces.has(value)) return "ace";
  if (team === "meiden" && config.meidenBlockers.has(value)) return "blocker";
  return "normal";
}

function token(value, team, config) {
  const players = team === "opponent" ? config.opponentPlayers : config.meidenPlayers;
  const player = players[value] || { name: "", number: "", label: value };
  const nameHtml = multilineNameHtml(player.name);
  const numberHtml = escapeHtml(player.number || "");
  const labelHtml = player.name ? nameHtml : escapeHtml(player.label || "");
  return `
    <div class="player-token role-${tokenRole(value, team, config)}">
      ${player.name && player.number
        ? `<span class="token-number">${numberHtml}</span><span class="token-name">${nameHtml}</span>`
        : `<strong class="${player.name ? "token-name-only" : ""}">${labelHtml}</strong>`}
    </div>
  `;
}

function zoneOf(court, value) {
  if (FRONT.some((position) => court[position] === value)) return "前衛";
  if (BACK.some((position) => court[position] === value)) return "後衛";
  return "-";
}

function zoneNumberOf(court, value) {
  const zoneByPosition = {
    backRight: 1,
    backCenter: 6,
    backLeft: 5,
    frontLeft: 4,
    frontCenter: 3,
    frontRight: 2,
  };
  const position = Object.keys(zoneByPosition).find((key) => court[key] === value);
  return position ? zoneByPosition[position] : "-";
}

function opponentZoneNumberOf(court, value) {
  const zoneByPosition = {
    backLeft: 1,
    backCenter: 6,
    backRight: 5,
    frontRight: 4,
    frontCenter: 3,
    frontLeft: 2,
  };
  const position = Object.keys(zoneByPosition).find((key) => court[key] === value);
  return position ? zoneByPosition[position] : "-";
}

function rowValues(court, positions) {
  return positions.map((position) => court[position]);
}

function renderCard(index, config) {
  const opponentRotation = rotateCourt(config.opponentCourt, opponentSteps(index));
  const meidenRotation = rotateCourt(config.meidenCourt, meidenSteps(index));
  const setterZoneLabel = `S${zoneNumberOf(meidenRotation, config.meidenSetter)}`;
  const opponentSetterZoneLabel = `S${opponentZoneNumberOf(opponentRotation, config.opponentSetter)}`;
  const highlightClasses = [
    config.meidenKeyRote && setterZoneLabel === config.meidenKeyRote ? "key-rote-home" : "",
    config.opponentKeyRote && opponentSetterZoneLabel === config.opponentKeyRote ? "key-rote-away" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const keyRoteFrames = [
    highlightClasses.includes("key-rote-away") ? '<div class="key-rote-frame key-rote-frame-away" aria-hidden="true"></div>' : "",
    highlightClasses.includes("key-rote-home") ? '<div class="key-rote-frame key-rote-frame-home" aria-hidden="true"></div>' : "",
  ].join("");
  const serveSide = state.serveMarkerSide;
  const serveMarker =
    index === 0
      ? `<div class="serve-marker serve-${serveSide}" aria-label="${serveSide === "opponent" ? "AWAY" : "HOME"} serve">SERVE</div>`
      : "";

  return `
    <article class="rotation-card ${highlightClasses}">
      <div class="card-header">
        <h3>${setterZoneLabel}</h3>
      </div>
      <div class="mini-court">
        ${keyRoteFrames}
        ${serveMarker}
        <div class="side-label opponent">${config.opponentTeamName}</div>
        <div class="court-row back">${rowValues(opponentRotation, BACK).map((value) => token(value, "opponent", config)).join("")}</div>
        <div class="court-row front">${rowValues(opponentRotation, FRONT).map((value) => token(value, "opponent", config)).join("")}</div>
        <div class="net">NET</div>
        <div class="court-row front">${rowValues(meidenRotation, FRONT).map((value) => token(value, "meiden", config)).join("")}</div>
        <div class="court-row back">${rowValues(meidenRotation, BACK).map((value) => token(value, "meiden", config)).join("")}</div>
        <div class="side-label meiden">${config.homeTeamName}</div>
      </div>
    </article>
  `;
}

function renderAnalysis() {
  if (!state.config) return;
  const homeStartCourt = rotateCourt(state.config.meidenCourt, meidenSteps(0));
  const opponentStartCourt = rotateCourt(state.config.opponentCourt, opponentSteps(0));
  const homeStartLabel = `S${zoneNumberOf(homeStartCourt, state.config.meidenSetter)}`;
  const opponentStartLabel = `S${opponentZoneNumberOf(opponentStartCourt, state.config.opponentSetter)}`;
  $("#meidenOffsetLabel").textContent = state.config.homeTeamName;
  $("#opponentOffsetLabel").textContent = state.config.opponentTeamName;
  $("#meidenStartLabel").textContent = `${state.config.homeTeamName} START ${homeStartLabel}`;
  $("#opponentStartLabel").textContent = `${state.config.opponentTeamName} START ${opponentStartLabel}`;
  $("#rotationCards").innerHTML = Array.from({ length: 6 }, (_, index) => renderCard(index, state.config)).join("");
}

function moveServeNext() {
  state.serveMarkerSide = state.serveMarkerSide === "meiden" ? "opponent" : "meiden";
  if (state.serveMarkerSide === "opponent") state.opponentOffset += 1;
  else state.meidenOffset += 1;
  state.serveStep += 1;
  markRotationProgressChanged();
  renderAnalysis();
}

function moveServeBack() {
  if (state.serveMarkerSide === "meiden") {
    state.meidenOffset -= 1;
    state.serveMarkerSide = "opponent";
  } else {
    state.opponentOffset -= 1;
    state.serveMarkerSide = "meiden";
  }
  state.serveStep -= 1;
  markRotationProgressChanged();
  renderAnalysis();
}

function bindEvents() {
  const syncTeamLabels = () => {
    $("#setupHomeCourtLabel").textContent = $("#homeTeamName").value.trim() || "HOME TEAM";
    $("#setupOpponentCourtLabel").textContent = $("#opponentTeamName").value.trim() || "AWAY TEAM";
  };
  const bindTeamNamePair = (primarySelector, mobileSelector) => {
    const primary = $(primarySelector);
    const mobile = $(mobileSelector);
    primary.addEventListener("input", () => {
      if (mobile) mobile.value = primary.value;
      syncTeamLabels();
      saveSetupState();
    });
    mobile?.addEventListener("input", () => {
      primary.value = mobile.value;
      syncTeamLabels();
      saveSetupState();
    });
  };
  bindTeamNamePair("#homeTeamName", "#mobileHomeTeamName");
  bindTeamNamePair("#opponentTeamName", "#mobileOpponentTeamName");
  $("#meidenKeyRote").addEventListener("change", (event) => {
    state.meidenKeyRote = event.target.value;
    saveSetupState();
    if (state.config) {
      state.config.meidenKeyRote = state.meidenKeyRote;
      renderAnalysis();
    }
  });
  $("#opponentKeyRote").addEventListener("change", (event) => {
    state.opponentKeyRote = event.target.value;
    saveSetupState();
    if (state.config) {
      state.config.opponentKeyRote = state.opponentKeyRote;
      renderAnalysis();
    }
  });
  $("#tabSetup").addEventListener("click", () => switchScreen("setup"));
  $("#tabAnalysis").addEventListener("click", () => {
    startAnalysis();
  });
  $("#mobileTabSetup")?.addEventListener("click", () => switchScreen("setup"));
  $("#mobileTabAnalysis")?.addEventListener("click", () => {
    startAnalysis();
  });
  document.addEventListener("click", (event) => {
    const resetButton = event.target.closest("[data-reset-team]");
    if (!resetButton) return;
    event.preventDefault();
    resetTeamSetup(resetButton.dataset.resetTeam);
  });
  $("#resetOpponentRotation").addEventListener("click", () => resetStartRotation("opponent"));
  $("#resetMeidenRotation").addEventListener("click", () => resetStartRotation("meiden"));
  $("#aceDropdown").addEventListener("click", () => toggleMultiSelect("acePicker"));
  $("#blockerDropdown").addEventListener("click", () => toggleMultiSelect("blockerPicker"));
  $("#meidenAceDropdown").addEventListener("click", () => toggleMultiSelect("meidenAcePicker"));
  $("#meidenBlockerDropdown").addEventListener("click", () => toggleMultiSelect("meidenBlockerPicker"));
  $("#opponentSetterDropdown").addEventListener("click", () => toggleMultiSelect("opponentSetterPicker"));
  $("#meidenSetterDropdown").addEventListener("click", () => toggleMultiSelect("meidenSetterPicker"));
  $$('input[name="serveStart"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      clearRotationProgress();
      $("#rotationCards").innerHTML = "";
      saveSetupState();
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".multi-select")) {
      $$(".multi-select.open").forEach((element) => element.classList.remove("open"));
    }
  });
  $("#opponentSetterSelect").addEventListener("change", (event) => {
    state.opponentSetter = event.target.value;
    if (state.opponentSetter && (state.selectedOpponent.has(state.opponentSetter) || state.selectedOpponent.size < 6)) {
      state.selectedOpponent.add(state.opponentSetter);
    }
    refreshOpponentSelects();
  });
  $("#meidenSetterSelect").addEventListener("change", (event) => {
    state.meidenSetter = event.target.value;
    if (state.meidenSetter && (state.selectedMeiden.has(state.meidenSetter) || state.selectedMeiden.size < 6)) {
      state.selectedMeiden.add(state.meidenSetter);
    }
    refreshMeidenSelects();
  });
  $("#meidenPlus").addEventListener("click", () => {
    state.meidenOffset += 1;
    markRotationProgressChanged();
    renderAnalysis();
  });
  $("#meidenMinus").addEventListener("click", () => {
    state.meidenOffset -= 1;
    markRotationProgressChanged();
    renderAnalysis();
  });
  $("#opponentPlus").addEventListener("click", () => {
    state.opponentOffset += 1;
    markRotationProgressChanged();
    renderAnalysis();
  });
  $("#opponentMinus").addEventListener("click", () => {
    state.opponentOffset -= 1;
    markRotationProgressChanged();
    renderAnalysis();
  });
  $("#serveNext").addEventListener("click", moveServeNext);
  $("#serveBack").addEventListener("click", moveServeBack);
  ["meidenPlus", "meidenMinus", "opponentPlus", "opponentMinus", "serveNext", "serveBack"].forEach((id) => {
    $(`#${id}`).addEventListener("dblclick", (event) => {
      event.preventDefault();
    });
  });
}

function init() {
  buildOpponentInputs();
  buildRoster();
  applyTeamDefaults("opponent");
  applyTeamDefaults("meiden");
  setDefaultServeStart();
  restoreSetupState();
  restoreRotationProgress();
  state.setupPersistenceReady = true;
  bindEvents();
}

init();
