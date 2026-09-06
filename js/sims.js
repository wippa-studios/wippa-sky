// ═══════════════════════════════════════════
//  SIMS — Tenant System for Wippa Sky v2
// ═══════════════════════════════════════════

import { CELL_W, CELL_H, GROUND_Y_OFFSET, FLOOR_TYPES, mulberry32 } from './constants.js';
import { cellToScreenLocal, getCell } from './grid.js';
import { findRoute } from './pathfind.js';
import { callElevator, getShaftForSim } from './dispatch.js';

let _nextSimId = 1;
let _lobbyInfluxTimer = 0;
const LOBBY_INFLUX_INTERVAL = 5;

// ═══════════════════════════════════════════
//  SIM CREATION
// ═══════════════════════════════════════════

function createSim(floor, col, kind, state) {
  const rng = mulberry32(floor * 1000 + col * 97 + _nextSimId * 31);
  const id = _nextSimId++;
  const skinTones = ['#f7c99b', '#d99a73', '#8d5524', '#f0b27a', '#c68642'];
  const hairColors = ['#24180f', '#573b2a', '#18202b', '#c27a48', '#4a3728'];
  const shirtHues = [0, 30, 60, 120, 160, 200, 240, 280, 320];
  const hue = shirtHues[Math.floor(rng() * shirtHues.length)];
  const mood = 60 + rng() * 30;
  const energy = 50 + rng() * 40;
  const food = 40 + rng() * 50;
  const leisure = 30 + rng() * 60;
  const workNeed = kind === 'worker' ? 50 + rng() * 40 : 0;

  const sim = {
    id,
    kind,
    home: kind === 'resident' ? { floor, col } : (kind === 'guest' ? { floor, col } : null),
    work: kind === 'worker' ? { floor, col } : null,
    floor,
    col,
    x: 0.2 + rng() * 0.6,
    targetX: 0.2 + rng() * 0.6,
    state: 'idle',
    stateTimer: 1 + rng() * 3,
    travelTimer: 0,
    mood,
    energy,
    food,
    leisure,
    workNeed,
    patience: 100,
    waitSince: 0,
    complaints: 0,
    color: `hsl(${hue}, 58%, 62%)`,
    skin: skinTones[Math.floor(rng() * skinTones.length)],
    hair: hairColors[Math.floor(rng() * hairColors.length)],
    direction: rng() > 0.5 ? 1 : -1,
    action: '',
    bubble: '',
    bubbleTimer: 0,
    targetFloor: floor,
    targetCol: col,
    route: null,
    routeIndex: 0,
  };
  return sim;
}

// ═══════════════════════════════════════════
//  CELL QUERIES
// ═══════════════════════════════════════════

function cellsOfType(state, types) {
  const result = [];
  for (const [row, cells] of state.grid) {
    for (let c = 0; c < state.cols; c++) {
      const cell = cells[c];
      if (cell && types.includes(cell.type)) {
        result.push({ floor: row, col: c, cell });
      }
    }
  }
  return result;
}

function isServiceFloor(cell) {
  if (!cell) return false;
  return cell.type === 'elevator' || cell.type === 'lobby' || cell.type === 'basementLobby' || cell.type === 'skyLobby' || cell.type === 'service' || cell.type === 'parking' || cell.type === 'subway';
}

function getElevatorCol(state) {
  if (state.elevators && state.elevators.length > 0) return state.elevators[0].col;
  return 0;
}

// ═══════════════════════════════════════════
//  SPAWNING
// ═══════════════════════════════════════════

export function spawnSimsForCell(state, row, col, type) {
  const ft = FLOOR_TYPES[type];
  if (!ft) return;

  if (type === 'residence') {
    const count = Math.max(1, ft.popAdd || 4);
    for (let i = 0; i < count; i++) {
      const sim = createSim(row, col, 'resident', state);
      sim.x = 0.15 + (i / count) * 0.7;
      sim.targetX = sim.x;
      state.tenants.push(sim);
    }
  } else if (type === 'hotel') {
    for (let i = 0; i < 2; i++) {
      const sim = createSim(row, col, 'guest', state);
      sim.x = 0.2 + i * 0.35;
      sim.targetX = sim.x;
      state.tenants.push(sim);
    }
  } else if (type === 'office') {
    const sim = createSim(row, col, 'worker', state);
    state.tenants.push(sim);
  } else if (type === 'shop' || type === 'restaurant') {
    const sim = createSim(row, col, 'worker', state);
    sim.work = { floor: row, col };
    state.tenants.push(sim);
  } else if (type === 'cinema' || type === 'spa') {
    const sim = createSim(row, col, 'worker', state);
    state.tenants.push(sim);
  }
}

export function removeSimsForCell(state, row, col) {
  state.tenants = state.tenants.filter(t => !(t.floor === row && t.col === col));
}

// ═══════════════════════════════════════════
//  COUNT HELPERS
// ═══════════════════════════════════════════

export function getSimCount(state) {
  return state.tenants.length;
}

export function getSimCountByKind(state, kind) {
  let n = 0;
  for (let i = 0; i < state.tenants.length; i++) {
    if (state.tenants[i].kind === kind) n++;
  }
  return n;
}

// ═══════════════════════════════════════════
//  LOBBY INFLUX
// ═══════════════════════════════════════════

function updateLobbyInflux(state, dt) {
  _lobbyInfluxTimer += dt;
  if (_lobbyInfluxTimer < LOBBY_INFLUX_INTERVAL) return;
  _lobbyInfluxTimer = 0;

  const lobby = getCell(state, 0, 0);
  if (!lobby) return;

  const residents = getSimCountByKind(state, 'resident');
  const workers = getSimCountByKind(state, 'worker');
  const offices = cellsOfType(state, ['office']);
  const shops = cellsOfType(state, ['shop', 'restaurant', 'cinema', 'spa', 'park']);

  if (state.elevators.length === 0) return;

  if (residents > 0 && shops.length > 0) {
    const vis = createSim(0, 0, 'visitor', state);
    vis.state = 'waitingElevator';
    vis.stateTimer = 999;
    vis.patience = 70 + Math.random() * 30;
    vis.waitSince = state.tick;
    state.tenants.push(vis);

    const dir = Math.random() > 0.5 ? 'up' : 'down';
    const shaft = state.elevators[Math.floor(Math.random() * state.elevators.length)];
    if (shaft) callElevator(state, 0, shaft.col, dir);
  }

  if (workers < offices.length * 3 && offices.length > 0) {
    const w = createSim(0, 0, 'worker', state);
    w.work = offices[Math.floor(Math.random() * offices.length)];
    w.state = 'waitingElevator';
    w.stateTimer = 999;
    w.patience = 60 + Math.random() * 40;
    w.waitSince = state.tick;
    state.tenants.push(w);

    const shaft = state.elevators[Math.floor(Math.random() * state.elevators.length)];
    if (shaft) callElevator(state, 0, shaft.col, 'up');
  }
}

// ═══════════════════════════════════════════
//  UPDATE — MAIN LOOP
// ═══════════════════════════════════════════

export function updateSims(state, dt) {
  updateLobbyInflux(state, dt);

  const toRemove = [];

  for (let i = 0; i < state.tenants.length; i++) {
    const sim = state.tenants[i];
    updateSim(sim, state, dt);
    if (sim.state === 'leaving' || sim.state === 'remove') {
      toRemove.push(i);
    }
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.tenants.splice(toRemove[i], 1);
  }
}

function updateSim(sim, state, dt) {
  sim.stateTimer -= dt;
  sim.bubbleTimer = Math.max(0, sim.bubbleTimer - dt);

  // ── Decay needs over time ──
  sim.energy = Math.max(0, sim.energy - 2.0 * dt);
  sim.food = Math.max(0, sim.food - 1.5 * dt);
  sim.leisure = Math.max(0, sim.leisure - 1.0 * dt);

  if (sim.kind === 'worker' && state.dayPhase === 'day') {
    sim.workNeed = Math.min(100, sim.workNeed + 0.8 * dt);
  }

  sim.mood = Math.max(0, Math.min(100,
    60 + sim.energy * 0.12 + sim.food * 0.08 + sim.leisure * 0.1 + sim.workNeed * 0.05
  ));

  // ── State machine ──
  switch (sim.state) {
    case 'idle': tickIdle(sim, state, dt); break;
    case 'walking': tickWalking(sim, state, dt); break;
    case 'waitingElevator': tickWaitingElevator(sim, state, dt); break;
    case 'riding': tickRiding(sim, state, dt); break;
    case 'working': tickWorking(sim, state, dt); break;
    case 'resting': tickResting(sim, state, dt); break;
    case 'angry': tickAngry(sim, state, dt); break;
    case 'leaving': tickLeaving(sim, state, dt); break;
    case 'routeStep': tickRouteStep(sim, state, dt); break;
  }

  // ── Validate home/work still exists ──
  if (sim.home) {
    const hc = getCell(state, sim.home.floor, sim.home.col);
    if (!hc) sim.home = null;
  }
  if (sim.work) {
    const wc = getCell(state, sim.work.floor, sim.work.col);
    if (!wc) sim.work = null;
  }
}

// ── idle ──
function tickIdle(sim, state, dt) {
  if (sim.stateTimer > 0) return;

  if (sim.mood < 25 || sim.energy < 10 || sim.patience <= 0) {
    sim.state = 'angry';
    sim.stateTimer = 999;
    sim.bubble = '😠';
    sim.bubbleTimer = 3;
    sim.complaints++;
    return;
  }

  chooseDestination(sim, state);

  if (sim.targetFloor === sim.floor && sim.targetCol === sim.col) {
    arrive(sim, state);
    return;
  }

  const route = findRoute(state, sim.floor, sim.col, sim.targetFloor, sim.targetCol);
  if (route && route.length > 1) {
    sim.route = route;
    sim.routeIndex = 1;
    sim.state = 'routeStep';
    sim.stateTimer = 999;
    advanceRouteStep(sim, state);
  } else if (sim.targetFloor !== sim.floor) {
    const dx = sim.targetCol - sim.col;
    sim.targetX = 0.5 + (dx > 0 ? 0.3 : -0.3);
    sim.state = 'walking';
    sim.stateTimer = 3;
  } else {
    sim.targetX = 0.2 + Math.random() * 0.6;
    sim.state = 'walking';
    sim.stateTimer = 3;
  }
}

// ── walking (within same floor) ──
function tickWalking(sim, state, dt) {
  const speed = 2.0;
  const diff = sim.targetX - sim.x;

  if (Math.abs(diff) < 0.02) {
    sim.x = sim.targetX;
    sim.state = 'idle';
    sim.stateTimer = 2 + Math.random() * 4;
    return;
  }

  if (diff > 0) {
    sim.x = Math.min(sim.targetX, sim.x + speed * dt);
    sim.direction = 1;
  } else {
    sim.x = Math.max(sim.targetX, sim.x - speed * dt);
    sim.direction = -1;
  }

  if (sim.stateTimer <= 0) {
    sim.state = 'idle';
    sim.stateTimer = 2 + Math.random() * 3;
  }
}

// ── waitingElevator ──
function tickWaitingElevator(sim, state, dt) {
  sim.patience -= 5.0 * dt;
  if (sim.waitSince === 0) sim.waitSince = state.tick;

  if (sim.patience <= 0) {
    sim.state = 'angry';
    sim.stateTimer = 999;
    sim.bubble = '😠';
    sim.bubbleTimer = 3;
    sim.complaints++;
    return;
  }

  if (sim.stateTimer > 0 && sim.stateTimer < 900) {
    sim.stateTimer -= dt;
  }

  const elapsed = state.tick - sim.waitSince;
  if (elapsed > 10 && sim.bubbleTimer <= 0) {
    sim.bubble = '⏳';
    sim.bubbleTimer = 2;
  }
}

// ── riding (elevator) ──
function tickRiding(sim, state, dt) {
  sim.travelTimer -= dt;
  if (sim.travelTimer <= 0) {
    sim.floor = sim.targetFloor;
    sim.col = sim.targetCol;

    if (sim.route && sim.routeIndex < sim.route.length) {
      sim.routeIndex++;
      sim.state = 'routeStep';
      sim.stateTimer = 999;
      advanceRouteStep(sim, state);
    } else {
      sim.state = 'idle';
      sim.stateTimer = 1.5 + Math.random() * 2;
      arrive(sim, state);
    }
  }
}

// ── working ──
function tickWorking(sim, state, dt) {
  sim.workNeed = Math.max(0, sim.workNeed - 6.0 * dt);

  if (sim.workNeed <= 0 || state.dayPhase !== 'day') {
    sim.state = 'idle';
    sim.stateTimer = 2 + Math.random() * 3;
    return;
  }

  if (sim.work && (sim.floor !== sim.work.floor || sim.col !== sim.work.col)) {
    sim.targetFloor = sim.work.floor;
    sim.targetCol = sim.work.col;
    const route = findRoute(state, sim.floor, sim.col, sim.targetFloor, sim.targetCol);
    if (route && route.length > 1) {
      sim.route = route;
      sim.routeIndex = 1;
      sim.state = 'routeStep';
      sim.stateTimer = 999;
      advanceRouteStep(sim, state);
    }
    return;
  }

  if (sim.bubbleTimer <= 0 && Math.random() < 0.3) {
    sim.bubble = '⌁';
    sim.bubbleTimer = 3 + Math.random() * 2;
  }

  sim.x += (sim.targetX - sim.x) * Math.min(1, dt * 0.8);
  if (Math.abs(sim.targetX - sim.x) < 0.02) {
    sim.targetX = 0.18 + Math.random() * 0.64;
  }
}

// ── resting ──
function tickResting(sim, state, dt) {
  sim.energy = Math.min(100, sim.energy + 6.0 * dt);

  if (sim.stateTimer > 0) sim.stateTimer -= dt;

  if (sim.energy >= 98 || state.dayPhase === 'day') {
    sim.state = 'idle';
    sim.stateTimer = 2 + Math.random() * 3;
    return;
  }

  if (sim.bubbleTimer <= 0 && Math.random() < 0.2) {
    sim.bubble = '💤';
    sim.bubbleTimer = 4;
  }
}

// ── angry ──
function tickAngry(sim, state, dt) {
  sim.state = 'leaving';
  sim.stateTimer = 999;
  sim.targetFloor = 0;
  sim.targetCol = getElevatorCol(state);

  if (sim.floor === 0) {
    sim.state = 'remove';
    return;
  }

  const route = findRoute(state, sim.floor, sim.col, 0, sim.targetCol);
  if (route && route.length > 1) {
    sim.route = route;
    sim.routeIndex = 1;
    sim.state = 'routeStep';
    sim.stateTimer = 999;
    advanceRouteStep(sim, state);
  } else {
    const shaft = state.elevators.find(e =>
      e.floors.includes(sim.floor) && e.floors.includes(0)
    );
    if (shaft) {
      sim.state = 'walking';
      sim.targetX = 0.5;
      sim.stateTimer = 3;
    } else {
      sim.state = 'remove';
    }
  }
}

// ── leaving ──
function tickLeaving(sim, state, dt) {
  if (sim.floor === 0) {
    sim.state = 'remove';
    return;
  }

  if (sim.stateTimer <= 0) {
    sim.state = 'remove';
  }
}

// ── routeStep (multi-floor route) ──
function tickRouteStep(sim, state, dt) {
  if (!sim.route || sim.routeIndex >= sim.route.length) {
    sim.state = 'idle';
    sim.stateTimer = 1 + Math.random() * 2;
    arrive(sim, state);
    return;
  }

  const step = sim.route[sim.routeIndex];

  if (sim.stateTimer > 0 && sim.stateTimer < 900) {
    sim.stateTimer -= dt;
    if (sim.stateTimer <= 0) {
      advanceRouteStep(sim, state);
    }
    return;
  }

  if (step.action === 'board') {
    const dir = sim.route[sim.route.length - 1].floor > sim.floor ? 'up' : 'down';
    const dirX = dir === 'up' ? 0.15 : 0.85;

    if (Math.abs(sim.x - dirX) > 0.05) {
      sim.targetX = dirX;
      sim.x += (dirX - sim.x) * Math.min(1, dt * 3);
      sim.direction = dirX > sim.x ? 1 : -1;
    } else {
      sim.x = dirX;
      sim.state = 'waitingElevator';
      sim.stateTimer = 999;
      sim.waitSince = state.tick;
      sim.patience = 80 + Math.random() * 20;

      if (step.shaftId != null) {
        const shaft = state.elevators.find(e => e.id === step.shaftId);
        if (shaft) callElevator(state, sim.floor, shaft.col, dir);
      } else {
        const shaft = state.elevators.find(e =>
          e.floors.includes(sim.floor) && e.floors.includes(sim.targetFloor)
        );
        if (shaft) callElevator(state, sim.floor, shaft.col, dir);
      }
    }
  } else if (step.action === 'alight' || step.action === 'transfer') {
    sim.floor = step.floor;
    sim.col = step.col;
    sim.x = 0.5;
    sim.targetX = 0.5;

    if (step.action === 'transfer') {
      sim.routeIndex++;
      sim.stateTimer = 0.5;
      advanceRouteStep(sim, state);
    } else if (sim.floor === sim.targetFloor) {
      sim.routeIndex = sim.route.length;
      sim.state = 'idle';
      sim.stateTimer = 1 + Math.random() * 2;
      arrive(sim, state);
    } else {
      sim.routeIndex++;
      sim.stateTimer = 0.3;
    }
  }
}

function advanceRouteStep(sim, state) {
  if (!sim.route || sim.routeIndex >= sim.route.length) {
    sim.state = 'idle';
    sim.stateTimer = 1;
    return;
  }

  const step = sim.route[sim.routeIndex];

  if (step.action === 'alight') {
    sim.floor = step.floor;
    sim.col = step.col;
    sim.x = 0.5;

    if (sim.floor === sim.targetFloor) {
      sim.route = null;
      sim.routeIndex = 0;
      sim.state = 'idle';
      sim.stateTimer = 1 + Math.random() * 2;
      arrive(sim, state);
    } else {
      sim.routeIndex++;
      sim.stateTimer = 0.3;
    }
  } else if (step.action === 'transfer') {
    sim.floor = step.floor;
    sim.col = step.col;
    sim.x = 0.5;
    sim.routeIndex++;
    sim.stateTimer = 0.5;
  } else if (step.action === 'board') {
    sim.state = 'waitingElevator';
    sim.stateTimer = 999;
    sim.waitSince = state.tick;
    sim.patience = 80 + Math.random() * 20;
  }
}

function arrive(sim, state) {
  if (sim.targetFloor !== sim.floor || sim.targetCol !== sim.col) return;

  if (sim.targetFloor === sim.home?.floor && sim.targetCol === sim.home?.col) {
    sim.action = 'resting';
    sim.state = 'resting';
    sim.stateTimer = 10 + Math.random() * 15;
    sim.bubble = '💤';
    sim.bubbleTimer = 3;
  } else if (sim.targetFloor === sim.work?.floor && sim.targetCol === sim.work?.col) {
    sim.action = 'working';
    sim.state = 'working';
    sim.stateTimer = 15 + Math.random() * 20;
    sim.bubble = '⌁';
    sim.bubbleTimer = 3;
  } else {
    const destCell = getCell(state, sim.targetFloor, sim.targetCol);
    if (destCell) {
      sim.bubble = getDestinationBubble(destCell.type);
      sim.bubbleTimer = 2.5;
      sim.leisure = Math.min(100, sim.leisure + 20);
      sim.food = Math.min(100, sim.food + (destCell.type === 'restaurant' ? 25 : 0));
    }
    sim.action = 'visiting';
    sim.state = 'idle';
    sim.stateTimer = 5 + Math.random() * 8;
  }

  sim.route = null;
  sim.routeIndex = 0;
}

function getDestinationBubble(type) {
  switch (type) {
    case 'shop': return '🛍';
    case 'restaurant': return '☕';
    case 'park': return '🌳';
    case 'cinema': return '🎬';
    case 'spa': return '🧖';
    default: return '';
  }
}

// ═══════════════════════════════════════════
//  DESTINATION CHOICE
// ═══════════════════════════════════════════

export function chooseDestination(sim, state) {
  const phase = state.dayPhase;
  let choices = [];

  switch (phase) {
    case 'dawn':
      if (sim.kind === 'resident' || sim.kind === 'guest') {
        if (sim.home) choices = [{ floor: sim.home.floor, col: sim.home.col }];
      } else {
        if (sim.home) {
          choices = [{ floor: sim.home.floor, col: sim.home.col }];
        } else if (sim.work) {
          choices = [{ floor: sim.work.floor, col: sim.work.col }];
        }
      }
      break;

    case 'day':
      if (sim.kind === 'worker') {
        if (sim.work) {
          choices = [{ floor: sim.work.floor, col: sim.work.col }];
        } else {
          choices = cellsOfType(state, ['office']).map(c => ({ floor: c.floor, col: c.col }));
        }
      } else {
        choices = cellsOfType(state, ['shop', 'restaurant', 'park', 'cinema', 'spa']).map(c => ({ floor: c.floor, col: c.col }));
      }
      break;

    case 'dusk':
      choices = cellsOfType(state, ['restaurant', 'park', 'cinema', 'spa']).map(c => ({ floor: c.floor, col: c.col }));
      if (sim.kind === 'worker' && sim.work) {
        choices.push({ floor: sim.work.floor, col: sim.work.col });
      }
      break;

    case 'night':
      if (sim.home) {
        choices = [{ floor: sim.home.floor, col: sim.home.col }];
      } else {
        choices = cellsOfType(state, ['hotel']).map(c => ({ floor: c.floor, col: c.col }));
      }
      break;
  }

  if (choices.length === 0) {
    if (sim.home) {
      choices = [{ floor: sim.home.floor, col: sim.home.col }];
    } else if (sim.work) {
      choices = [{ floor: sim.work.floor, col: sim.work.col }];
    } else {
      choices = [{ floor: sim.floor, col: sim.col }];
    }
  }

  const dest = choices[Math.floor(Math.random() * choices.length)];
  sim.targetFloor = dest.floor;
  sim.targetCol = dest.col;
  sim.targetX = 0.18 + Math.random() * 0.64;
}

// ═══════════════════════════════════════════
//  DRAWING
// ═══════════════════════════════════════════

function isCellVisible(state, row, col) {
  const pos = cellToScreenLocal(state, row, col);
  const canvasH = state.canvasH || 600;
  return pos.y + pos.h > -60 && pos.y < canvasH + 60;
}

export function drawSims(ctx, state) {
  const s = state.zoom || 1;

  for (const sim of state.tenants) {
    if (sim.state === 'riding' || sim.state === 'routeStep' && !isSimOnFloor(sim)) continue;
    if (!isCellVisible(state, sim.floor, sim.col)) continue;

    const pos = cellToScreenLocal(state, sim.floor, sim.col);
    drawSim(ctx, sim, pos, s, state);
  }
}

function isSimOnFloor(sim) {
  return sim.state !== 'riding';
}

function drawSim(ctx, sim, pos, s, state) {
  const px = pos.x + sim.x * pos.w;
  const isWalking = sim.state === 'walking' || (sim.state === 'routeStep' && Math.abs(sim.targetX - sim.x) > 0.05);
  const bob = isWalking ? Math.sin(state.tick * 9 + sim.x * 10) * s * 1.5 : 0;
  const py = pos.y + pos.h * 0.55 + bob;

  ctx.save();

  if (sim.state === 'riding') {
    ctx.globalAlpha = 0.48;
  }

  // ── Shadow ──
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(px + 2 * s, py + 4 * s, 4 * s, 1.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Rim light ──
  ctx.fillStyle = 'rgba(177,245,239,.2)';
  ctx.beginPath();
  ctx.arc(px - 2 * s, py - 4 * s, 3.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // ── Body ──
  ctx.fillStyle = sim.color;
  ctx.beginPath();
  ctx.roundRect(px - 2.8 * s, py - 2 * s, 5.6 * s, 7 * s, 2);
  ctx.fill();

  // ── Arms ──
  ctx.strokeStyle = sim.color;
  ctx.lineWidth = 1.3 * s;
  if (isWalking) {
    const armPhase = Math.sin(state.tick * 9 + sim.x * 10);
    ctx.beginPath();
    ctx.moveTo(px - 2 * s, py + 1 * s);
    ctx.lineTo(px - 4 * s, py + 3 * s + armPhase * 2 * s);
    ctx.moveTo(px + 2 * s, py + 1 * s);
    ctx.lineTo(px + 4 * s, py + 3 * s - armPhase * 2 * s);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(px - 2 * s, py + 1 * s);
    ctx.lineTo(px - 4 * s, py + 3 * s);
    ctx.moveTo(px + 2 * s, py + 1 * s);
    ctx.lineTo(px + 4 * s, py + 3 * s);
    ctx.stroke();
  }

  // ── Head ──
  ctx.fillStyle = sim.skin || '#f3c59b';
  ctx.beginPath();
  ctx.arc(px, py - 5 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // ── Hair ──
  ctx.fillStyle = sim.hair || '#24180f';
  ctx.beginPath();
  ctx.arc(px, py - 6.5 * s, 2.7 * s, Math.PI, 0);
  ctx.fill();

  // ── Eye shine ──
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath();
  ctx.arc(px - 1 * s, py - 5.3 * s, 0.55 * s, 0, Math.PI * 2);
  ctx.fill();

  // ── Activity bubble ──
  if (sim.bubbleTimer > 0 && sim.bubble) {
    const bx = px + 7 * s;
    const by = py - 13 * s;
    const bubbleW = sim.bubble.length > 2 ? 14 * s : 11 * s;
    ctx.fillStyle = 'rgba(232,252,247,.9)';
    ctx.beginPath();
    ctx.roundRect(bx - bubbleW / 2, by - 5 * s, bubbleW, 9 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#173342';
    const fontSize = Math.max(6, 8 * s);
    ctx.font = `${fontSize}px 'DM Sans',sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(sim.bubble, bx, by + 2 * s);
  }

  // ── Mood tint overlay for angry sims ──
  if (sim.state === 'angry' || sim.patience < 25) {
    ctx.fillStyle = `rgba(239,68,68,${0.15 + (1 - sim.patience / 100) * 0.2})`;
    ctx.fillRect(px - 4 * s, py - 8 * s, 8 * s, 14 * s);
  }

  ctx.restore();
}
