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

const defaultOpponentPlayers = Array.from({ length: 12 }, (_, index) => String(index + 1)).map((number) => ({
  name: "",
  number,
}));
const roster = ["近藤", "北田", "田邊", "藤井", "笹本", "澤田", "山本", "加納", "植木", "北川", "大國", "松田"].map((name, index) => ({
  name,
  number: String(index + 1),
}));
const state = {
  selectedOpponent: new Set(["opponent-0", "opponent-1", "opponent-2", "opponent-3", "opponent-4", "opponent-5"]),
  selectedMeiden: new Set(["meiden-0", "meiden-1", "meiden-2", "meiden-3", "meiden-4", "meiden-5"]),
  opponentAces: new Set(),
  opponentBlockers: new Set(),
  meidenAces: new Set(),
  meidenBlockers: new Set(),
  opponentSetter: "",
  meidenSetter: "",
  config: null,
  meidenOffset: 0,
  opponentOffset: 0,
  manualCourtInput: {
    opponent: false,
    meiden: false,
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function normalizeOffset(value) {
  return ((value % 6) + 6) % 6;
}

function signedOffset(value) {
  const normalized = normalizeOffset(value);
  if (normalized === 0) return "±0";
  if (normalized <= 3) return `+${normalized}`;
  return `-${6 - normalized}`;
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
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = player.name;
    nameInput.placeholder = "Name";
    nameInput.ariaLabel = `相手選手名${index + 1}`;
    nameInput.dataset.field = "name";
    nameInput.addEventListener("input", refreshOpponentSelects);
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
      if (event.target.tagName === "INPUT") return;
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
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = player.name;
    nameInput.placeholder = "Name";
    nameInput.ariaLabel = `自チーム選手名${index + 1}`;
    nameInput.dataset.field = "name";
    nameInput.addEventListener("input", refreshMeidenSelects);
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
      if (event.target.tagName === "INPUT") return;
      toggleStarter("meiden", id);
    });
    wrapper.append(tile);
  });
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
      const name = card.querySelector('input[data-field="name"]').value.trim();
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
    .filter((player) => player.name || player.number);
}

function playerLabel(player) {
  if (player.name && player.number) return `${player.name} ${player.number}`;
  return player.name || player.number || "";
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
}

function refreshMeidenSelects() {
  const ids = registeredIds("meiden");
  state.selectedMeiden = new Set(Array.from(state.selectedMeiden).filter((value) => ids.includes(value)));
  syncMeidenRoles();
  renderRoleSelects();
  updateRoleCards("meiden");
  renderCourtSelects("meiden", getMeidenPlayers());
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
  const selectedInCourt = {};
  const seen = new Set();
  POSITIONS.forEach((position) => {
    const value = previous[position];
    if (playersById[value] && !seen.has(value)) {
      selectedInCourt[position] = value;
      seen.add(value);
    }
  });
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
        renderCourtSelects(team);
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

function resetStartRotation(team) {
  $$(`select[data-team="${team}"]`).forEach((select) => {
    select.value = "";
  });
  state.manualCourtInput[team] = true;
  if (team === "opponent") state.selectedOpponent = new Set();
  else state.selectedMeiden = new Set();
  renderCourtSelects(team, [], { autofill: false });
}

function resetTeamSetup(team) {
  const isOpponent = team === "opponent";
  const teamLabel = isOpponent ? "AWAY TEAM" : "HOME TEAM";
  if (!window.confirm(`${teamLabel}の入力内容をリセットしますか？`)) return;

  const teamNameInput = isOpponent ? $("#opponentTeamName") : $("#homeTeamName");
  const courtLabel = isOpponent ? $("#setupOpponentCourtLabel") : $("#setupHomeCourtLabel");
  const rosterSelector = isOpponent ? "#opponentInputs input" : "#meidenRoster input";
  teamNameInput.value = "";
  courtLabel.textContent = teamLabel;
  $("#setupError").textContent = "";

  $$(rosterSelector).forEach((input) => {
    input.value = "";
    if (input.dataset.field === "number") input.dataset.previousNumber = "";
  });

  if (isOpponent) {
    state.selectedOpponent = new Set();
    state.opponentAces = new Set();
    state.opponentBlockers = new Set();
    state.opponentSetter = "";
    state.opponentOffset = 0;
  } else {
    state.selectedMeiden = new Set();
    state.meidenAces = new Set();
    state.meidenBlockers = new Set();
    state.meidenSetter = "";
    state.meidenOffset = 0;
  }
  state.config = null;
  state.manualCourtInput[team] = true;
  $$(".multi-select.open").forEach((element) => element.classList.remove("open"));

  if (isOpponent) refreshOpponentSelects();
  else refreshMeidenSelects();
  renderCourtSelects(team, [], { autofill: false });
  $("#rotationCards").innerHTML = "";
}

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
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function startAnalysis() {
  const error = validateSetup();
  $("#setupError").textContent = error;
  if (error) return;

  state.config = {
    homeTeamName: $("#homeTeamName").value.trim() || "HOME TEAM",
    opponentTeamName: $("#opponentTeamName").value.trim() || "AWAY TEAM",
    opponentAces: new Set(state.opponentAces),
    opponentBlockers: new Set(state.opponentBlockers),
    meidenAces: new Set(state.meidenAces),
    meidenBlockers: new Set(state.meidenBlockers),
    opponentSetter: state.opponentSetter,
    meidenSetter: state.meidenSetter,
    opponentPlayers: playerMap("opponent"),
    meidenPlayers: playerMap("meiden"),
    opponentCourt: readCourt("opponent"),
    meidenCourt: readCourt("meiden"),
    serveStart: $("input[name='serveStart']:checked").value,
  };
  state.meidenOffset = 0;
  state.opponentOffset = 0;
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
  return `
    <div class="player-token role-${tokenRole(value, team, config)}">
      ${player.name && player.number
        ? `<span class="token-number">${player.number}</span><span class="token-name">${player.name}</span>`
        : `<strong>${player.label}</strong>`}
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
  const serveMarker =
    index === 0
      ? `<div class="serve-marker serve-${config.serveStart}" aria-label="${config.serveStart === "opponent" ? "AWAY" : "HOME"} serve">SERVE</div>`
      : "";

  return `
    <article class="rotation-card">
      <div class="card-header">
        <h3>${setterZoneLabel}</h3>
      </div>
      <div class="mini-court">
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
  $("#comboLabel").textContent = `${state.config.homeTeamName} START ${homeStartLabel} × ${state.config.opponentTeamName} START ${opponentStartLabel}`;
  $("#rotationCards").innerHTML = Array.from({ length: 6 }, (_, index) => renderCard(index, state.config)).join("");
}

function bindEvents() {
  const syncTeamLabels = () => {
    $("#setupHomeCourtLabel").textContent = $("#homeTeamName").value.trim() || "HOME TEAM";
    $("#setupOpponentCourtLabel").textContent = $("#opponentTeamName").value.trim() || "AWAY TEAM";
  };
  $("#homeTeamName").addEventListener("input", syncTeamLabels);
  $("#opponentTeamName").addEventListener("input", syncTeamLabels);
  $("#tabSetup").addEventListener("click", () => switchScreen("setup"));
  $("#tabAnalysis").addEventListener("click", () => {
    startAnalysis();
  });
  $("#resetHomeSetup").addEventListener("click", () => resetTeamSetup("meiden"));
  $("#resetAwaySetup").addEventListener("click", () => resetTeamSetup("opponent"));
  $("#resetOpponentRotation").addEventListener("click", () => resetStartRotation("opponent"));
  $("#resetMeidenRotation").addEventListener("click", () => resetStartRotation("meiden"));
  $("#aceDropdown").addEventListener("click", () => toggleMultiSelect("acePicker"));
  $("#blockerDropdown").addEventListener("click", () => toggleMultiSelect("blockerPicker"));
  $("#meidenAceDropdown").addEventListener("click", () => toggleMultiSelect("meidenAcePicker"));
  $("#meidenBlockerDropdown").addEventListener("click", () => toggleMultiSelect("meidenBlockerPicker"));
  $("#opponentSetterDropdown").addEventListener("click", () => toggleMultiSelect("opponentSetterPicker"));
  $("#meidenSetterDropdown").addEventListener("click", () => toggleMultiSelect("meidenSetterPicker"));
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
    renderAnalysis();
  });
  $("#meidenMinus").addEventListener("click", () => {
    state.meidenOffset -= 1;
    renderAnalysis();
  });
  $("#opponentPlus").addEventListener("click", () => {
    state.opponentOffset += 1;
    renderAnalysis();
  });
  $("#opponentMinus").addEventListener("click", () => {
    state.opponentOffset -= 1;
    renderAnalysis();
  });
  ["meidenPlus", "meidenMinus", "opponentPlus", "opponentMinus"].forEach((id) => {
    $(`#${id}`).addEventListener("dblclick", (event) => {
      event.preventDefault();
    });
  });
}

function init() {
  buildOpponentInputs();
  buildRoster();
  refreshOpponentSelects();
  refreshMeidenSelects();

  const opponentDefaults = {
    backLeft: "opponent-0",
    backCenter: "opponent-1",
    backRight: "opponent-2",
    frontLeft: "opponent-3",
    frontCenter: "opponent-4",
    frontRight: "opponent-5",
  };
  const meidenDefaults = {
    frontLeft: "meiden-0",
    frontCenter: "meiden-1",
    frontRight: "meiden-2",
    backLeft: "meiden-3",
    backCenter: "meiden-4",
    backRight: "meiden-5",
  };
  Object.entries(opponentDefaults).forEach(([position, value]) => {
    const select = $(`select[data-team="opponent"][data-position="${position}"]`);
    if (select) select.value = value;
  });
  Object.entries(meidenDefaults).forEach(([position, value]) => {
    const select = $(`select[data-team="meiden"][data-position="${position}"]`);
    if (select) select.value = value;
  });
  bindEvents();
}

init();
