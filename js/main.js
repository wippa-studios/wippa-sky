// ═══════════════════════════════════════════
//  MAIN — Wippa Sky v2
// ═══════════════════════════════════════════

import { DAY_LENGTH_SECONDS, FLOOR_TYPES, CELL_W, CELL_H, GROUND_Y_OFFSET } from './constants.js';
import { createState, getRow, getCell } from './state.js';
import { buildFloor, getFloorCount, markDirtyNear } from './grid.js';
import { initCamera, handleResize, smoothCamera, autoFollowBuild, getCameraClamp } from './camera.js';
import { initInput } from './input.js';
import { updateHUD, addLog, showToast, showAchievementPopup, showWeeklyReport, closeWeeklyReport } from './hud.js';
import { checkAchievements } from './achievements.js';
import { initDispatch, updateDispatch, callElevator } from './dispatch.js';
import { drawElevatorShafts, updateElevatorVisuals } from './elevators.js';
import { spawnSimsForCell, updateSims, drawSims, getSimCount } from './sims.js';
import { updateNeeds, calculateMood } from './needs.js';
import { tickEconomy, checkBankruptcy, applyEmergencyLoan } from './economy.js';
import { initSky, updateSky, drawSky } from './render/sky.js';
import { initGround, updateGround, drawGround } from './render/ground.js';
import { drawTower } from './render/tower.js';
import { drawMinimap, updateMinimapThrottled } from './render/minimap.js';
import { saveGame, loadGame, hasSave } from './save.js';

let canvas, ctx, minimapCanvas, minimapCtx;
let state;
let lastTime = 0;
let autoSaveTimer = 0;
let weeklyTimer = 0;
let economyTimer = 0;
let lobbyInfluxTimer = 0;

export function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  minimapCanvas = document.getElementById('minimap-canvas');
  minimapCtx = minimapCanvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  state = createState();
  state.canvasW = canvas.width;
  state.canvasH = canvas.height;

  initCamera(state);
  initInput(state, canvas, minimapCanvas);

  const loaded = loadGame(state);
  if (!loaded) {
    initNewGame();
  }

  initSky(state, state.canvasW, state.canvasH);
  initGround(state, state.canvasW);
  initDispatch(state);

  setupToolbar();
  setupSpeedControls();
  setupSoundToggle();
  setupSettingsMenu();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.canvasW = canvas.width;
    state.canvasH = canvas.height;
    handleResize(state);
    initSky(state, state.canvasW, state.canvasH);
    initGround(state, state.canvasW);
  });

  addLog(state, '🏗️ Welcome to Wippa Sky v2!', 'info');
  addLog(state, '💡 Select a tool, then click the tower to build.', 'info');
  addLog(state, '🔑 Keys 1-8: tools • Arrows: scroll • H: mood overlay • Space: pause', 'info');
  if (!loaded) {
    addLog(state, '🆕 New tower started. Build offices and residences to grow!', 'info');
  } else {
    addLog(state, `💾 Loaded save from Day ${state.day}`, 'info');
  }

  requestAnimationFrame(gameLoop);
}

function initNewGame() {
  for (let c = 0; c < state.cols; c++) {
    setCell(state, 0, c, { type: 'lobby', built: 0, occupancy: 0, happiness: 70, incomeMult: 1, staff: 0, dirty: true });
  }
  setCell(state, 0, 0, { type: 'elevator', built: 0, occupancy: 0, happiness: 70, incomeMult: 1, staff: 0, dirty: true, elevatorId: 0 });
  setCell(state, 0, 4, { type: 'elevator', built: 0, occupancy: 0, happiness: 70, incomeMult: 1, staff: 0, dirty: true, elevatorId: 1 });
  setCell(state, 0, 8, { type: 'elevator', built: 0, occupancy: 0, happiness: 70, incomeMult: 1, staff: 0, dirty: true, elevatorId: 2 });

  state.elevators = [
    { id: 0, col: 0, kind: 'standard', floors: [0], floorMin: 0, floorMax: 0 },
    { id: 1, col: 4, kind: 'standard', floors: [0], floorMin: 0, floorMax: 0 },
    { id: 2, col: 8, kind: 'standard', floors: [0], floorMin: 0, floorMax: 0 },
  ];
  state.elevatorCars = [
    { elevatorId: 0, pos: 0, targetPos: 0, dir: 'idle', floor: 0, targetFloor: 0, state: 'idle', doorOpen: 0, doorTimer: 0, passengers: [], waitTimer: 2, capacity: 8, stops: new Set() },
    { elevatorId: 1, pos: 0, targetPos: 0, dir: 'idle', floor: 0, targetFloor: 0, state: 'idle', doorOpen: 0, doorTimer: 0, passengers: [], waitTimer: 2, capacity: 8, stops: new Set() },
    { elevatorId: 2, pos: 0, targetPos: 0, dir: 'idle', floor: 0, targetFloor: 0, state: 'idle', doorOpen: 0, doorTimer: 0, passengers: [], waitTimer: 2, capacity: 8, stops: new Set() },
  ];

  buildFloor(state, 1, 1, 'shop');
  buildFloor(state, 1, 2, 'restaurant');
  buildFloor(state, 1, 3, 'office');
  buildFloor(state, 1, 5, 'office');
  buildFloor(state, 1, 6, 'shop');
  buildFloor(state, 1, 7, 'residence');
  buildFloor(state, 2, 1, 'office');
  buildFloor(state, 2, 2, 'residence');
  buildFloor(state, 2, 3, 'residence');
  buildFloor(state, 2, 5, 'residence');
  buildFloor(state, 2, 6, 'office');
  buildFloor(state, 2, 7, 'office');

  spawnSimsForCell(state, 1, 1, 'shop');
  spawnSimsForCell(state, 1, 2, 'restaurant');
  spawnSimsForCell(state, 1, 3, 'office');
  spawnSimsForCell(state, 1, 5, 'office');
  spawnSimsForCell(state, 1, 6, 'shop');
  spawnSimsForCell(state, 1, 7, 'residence');
  spawnSimsForCell(state, 2, 1, 'office');
  spawnSimsForCell(state, 2, 2, 'residence');
  spawnSimsForCell(state, 2, 3, 'residence');
  spawnSimsForCell(state, 2, 5, 'residence');
  spawnSimsForCell(state, 2, 6, 'office');
  spawnSimsForCell(state, 2, 7, 'office');

  state.money = 500000;
  state.cameraY = 0;
  tickEconomy(state);
}

function setCell(state, row, col, cell) {
  const r = getRow(state, row);
  r[col] = cell;
}

function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedTool = btn.dataset.tool;
      closeInfoPanel();
    });
  });
}

function setupSpeedControls() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.speed = parseInt(btn.dataset.speed);
    });
  });
}

function setupSoundToggle() {
  const btn = document.getElementById('sound-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
  });
}

function setupSettingsMenu() {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const saveBtn = document.getElementById('save-btn');
  const loadBtn = document.getElementById('load-btn');
  const newBtn = document.getElementById('new-btn');

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => {
      settingsPanel.classList.toggle('visible');
    });
  }
  if (settingsClose) {
    settingsClose.addEventListener('click', () => {
      settingsPanel?.classList.remove('visible');
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (saveGame(state)) showToast('Game saved!', 'success');
      else showToast('Save failed!', 'error');
    });
  }
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      if (loadGame(state)) {
        showToast('Game loaded!', 'success');
        initSky(state, state.canvasW, state.canvasH);
        initGround(state, state.canvasW);
        initDispatch(state);
      } else {
        showToast('No save found!', 'error');
      }
    });
  }
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (confirm('Start a new tower? Current progress will be lost.')) {
        state = createState();
        state.canvasW = canvas.width;
        state.canvasH = canvas.height;
        initCamera(state);
        initNewGame();
        initSky(state, state.canvasW, state.canvasH);
        initGround(state, state.canvasW);
        initDispatch(state);
        showToast('New tower started!', 'info');
      }
    });
  }

  const reducedMotionToggle = document.getElementById('reduced-motion');
  if (reducedMotionToggle) {
    reducedMotionToggle.addEventListener('change', () => {
      state.settings.reducedMotion = reducedMotionToggle.checked;
    });
  }
}

function closeInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) panel.classList.remove('visible');
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  state.tick += dt * state.speed;

  if (state.speed > 0) {
    updateDayCycle(dt);
    updateSims(state, dt);
    updateDispatch(state, dt);
    updateElevatorVisuals(state, dt);
    updateSky(state, dt, state.canvasW, state.canvasH);
    updateGround(state, dt, state.canvasW);
    smoothCamera(state, dt);

    if (state._edgePan) {
      state.cameraY += state._edgePan * 120 * dt;
      const clamp = getCameraClamp(state);
      state.cameraY = Math.max(clamp.minCamY, Math.min(clamp.maxCamY, state.cameraY));
    }

    lobbyInfluxTimer += dt * state.speed;
    if (lobbyInfluxTimer > 5) {
      lobbyInfluxTimer = 0;
      spawnLobbyInflux(state);
    }

    autoSaveTimer += dt * state.speed;
    if (autoSaveTimer > DAY_LENGTH_SECONDS) {
      autoSaveTimer = 0;
      saveGame(state);
    }

    weeklyTimer += dt * state.speed;
    if (weeklyTimer > DAY_LENGTH_SECONDS * 7) {
      weeklyTimer = 0;
      showWeeklyReport(state);
      state.stats.complaintsThisWeek = 0;
      state.stats.moveOuts = 0;
      state.stats.moveIns = 0;
    }
  }

  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  drawSky(ctx, state, state.canvasW, state.canvasH);
  drawGround(ctx, state, state.canvasW, state.canvasH);
  drawTower(ctx, state);
  updateMinimapThrottled(state, minimapCanvas);
  drawMinimap(minimapCtx, state, minimapCanvas);
  updateHUD(state);

  requestAnimationFrame(gameLoop);
}

function updateDayCycle(dt) {
  state.dayTime += dt * state.speed / DAY_LENGTH_SECONDS;
  if (state.dayTime >= 1) {
    state.dayTime = 0;
    state.day++;
    tickEconomy(state);
    const bankruptStatus = checkBankruptcy(state);
    if (bankruptStatus === 'bankrupt') {
      applyEmergencyLoan(state);
      showToast('Emergency loan of $200,000! Rating reduced.', 'error');
      addLog(state, '🚨 Emergency loan taken due to bankruptcy!', 'expense');
    } else if (bankruptStatus === 'warning') {
      addLog(state, `⚠️ Money negative for ${state.bankruptcyDays} day(s)!`, 'warning');
    }
    addLog(state, `📅 Day ${state.day} — Income: $${state.income.toLocaleString()}`, state.income > 0 ? 'income' : 'info');
    const newAchievements = checkAchievements(state);
    for (const ach of newAchievements) {
      showAchievementPopup(ach);
      addLog(state, `🏆 Achievement: ${ach.name}`, 'warning');
    }
  }
  const p = state.dayTime;
  state.dayPhase = p < 0.15 ? 'dawn' : p < 0.5 ? 'day' : p < 0.7 ? 'dusk' : 'night';
}

function spawnLobbyInflux(state) {
  const demand = state.rating * 0.3 + state.satisfaction * 0.005;
  if (Math.random() > demand) return;
  if (state.tenants.length >= 2000) return;
  const lobbyCell = getCell(state, 0, 2);
  if (!lobbyCell) return;
  const simCount = getSimCount(state);
  if (simCount >= state.population * 1.2) return;

  const kinds = ['visitor', 'worker', 'guest'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const sim = {
    id: `influx-${state.totalBuilt}-${Date.now()}-${Math.random()}`,
    kind,
    home: null,
    work: null,
    floor: 0,
    col: 2,
    x: 0.3 + Math.random() * 0.4,
    targetX: 0.3 + Math.random() * 0.4,
    state: 'idle',
    stateTimer: 1 + Math.random() * 2,
    travelTimer: 0,
    mood: 70 + Math.random() * 15,
    energy: 60 + Math.random() * 30,
    food: 50 + Math.random() * 40,
    leisure: 40 + Math.random() * 40,
    workNeed: 50,
    patience: 80 + Math.random() * 20,
    waitSince: 0,
    complaints: 0,
    color: `hsl(${Math.random() * 360},58%,62%)`,
    skin: ['#f7c99b', '#d99a73', '#8d5524', '#f0b27a'][Math.floor(Math.random() * 4)],
    hair: ['#24180f', '#573b2a', '#18202b', '#c27a48'][Math.floor(Math.random() * 4)],
    direction: 1,
    action: '',
    bubble: '',
    bubbleTimer: 0,
    targetFloor: 0,
    targetCol: 2,
    route: null,
    routeIndex: 0,
  };
  state.tenants.push(sim);
}

document.addEventListener('DOMContentLoaded', init);
