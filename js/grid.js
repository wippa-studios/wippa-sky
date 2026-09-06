// ═══════════════════════════════════════════
//  GRID — Wippa Sky v2
// ═══════════════════════════════════════════

import {
  MAX_FLOORS_ABOVE, MAX_BASEMENTS, CELL_W, CELL_H, GROUND_Y_OFFSET,
  FLOOR_TYPES, DIG_COST_BASE, DIG_COST_PER_DEPTH,
  STANDARD_SHAFT_MAX_SPAN, EXPRESS_SHAFT_MAX_SPAN,
} from './constants.js';
import {
  getRow, getCell, setCell, removeCell,
  updateHighestFloor, updateBasementDepth,
} from './state.js';

export function canBuild(state, row, col, type) {
  if (col < 0 || col >= state.cols) return false;
  if (row > MAX_FLOORS_ABOVE || row < -MAX_BASEMENTS) return false;
  if (getCell(state, row, col) !== null) return false;
  const cost = getBuildCost(state, row, type);
  if (state.money < cost) return false;

  if (row >= 1) {
    const below = getCell(state, row - 1, col);
    if (!below) return false;
  } else if (row === 1) {
    const ground = getCell(state, 0, col);
    if (!ground) return false;
  } else if (row <= 0 && row >= -MAX_BASEMENTS) {
    const above = getCell(state, row + 1, col);
    if (!above) return false;
  }
  return true;
}

export function getBuildCost(state, row, type) {
  const ft = FLOOR_TYPES[type];
  if (!ft) return Infinity;
  let cost = ft.cost;
  if (row < 0) {
    cost += DIG_COST_BASE + DIG_COST_PER_DEPTH * Math.abs(row);
  }
  return cost;
}

export function buildFloor(state, row, col, type) {
  if (!canBuild(state, row, col, type)) return false;
  const cost = getBuildCost(state, row, type);
  state.money -= cost;
  const cell = {
    type, built: state.day, occupancy: 0, happiness: 70,
    incomeMult: 1, staff: 0, dirty: true,
  };
  setCell(state, row, col, cell);
  state.totalBuilt++;

  if (type === 'elevator') {
    cell.elevatorId = -1;
    let elev = state.elevators.find(e => e.col === col);
    if (!elev) {
      const elevId = state.elevators.length;
      elev = { id: elevId, col, kind: 'standard', floors: [], floorMin: row, floorMax: row };
      state.elevators.push(elev);
      state.elevatorCars.push({
        elevatorId: elevId, pos: 0, targetPos: 0, dir: 'idle',
        floor: 0, targetFloor: 0, state: 'idle',
        doorOpen: 0, doorTimer: 0, passengers: [], waitTimer: 2,
        capacity: 8,
      });
      cell.elevatorId = elevId;
    } else {
      cell.elevatorId = elev.id;
    }
    rebuildElevatorFloors(state, elev);
  }

  if (type === 'skyLobby') {
    cell.skyLobby = true;
  }

  if (type === 'subway' && row < -5) {
    cell.subwayActive = true;
  }

  if (type === 'service') {
    cell.serviceCount = (cell.serviceCount || 0) + 1;
  }

  updateHighestFloor(state);
  updateBasementDepth(state);

  const pos = cellToScreenLocal(state, row, col);
  for (let i = 0; i < 12; i++) {
    state.particles.push({
      x: pos.x + pos.w / 2, y: pos.y + pos.h / 2,
      vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
      type: 'build', life: 0.5 + Math.random() * 0.5, maxLife: 1,
      color: (FLOOR_TYPES[type] && FLOOR_TYPES[type].icon) || '#60a5fa',
    });
  }

  invalidatePathCache(state);
  markDirtyNear(state, row, col);

  return true;
}

export function demolishFloor(state, row, col) {
  const cell = getCell(state, row, col);
  if (!cell) return false;
  if (row === 0 && cell.type === 'lobby') return false;

  if (cell.type === 'elevator') {
    const elev = state.elevators.find(e => e.col === col);
    if (elev) {
      rebuildElevatorFloors(state, elev);
      if (elev.floors.length === 0) {
        state.elevators = state.elevators.filter(e => e.id !== elev.id);
        state.elevatorCars = state.elevatorCars.filter(c => c.elevatorId !== elev.id);
      }
    }
  }

  removeTenantsForCell(state, row, col);

  const refund = Math.floor(getBuildCost(state, row, cell.type) * 0.3);
  state.money += refund;
  removeCell(state, row, col);

  updateHighestFloor(state);
  updateBasementDepth(state);
  invalidatePathCache(state);
  markDirtyNear(state, row, col);

  return { refund };
}

export function rebuildElevatorFloors(state, elev) {
  elev.floors = [];
  for (const [row] of state.grid) {
    const cell = getCell(state, row, elev.col);
    if (cell && cell.type === 'elevator') {
      elev.floors.push(row);
    }
  }
  elev.floors.sort((a, b) => a - b);
  if (elev.floors.length > 0) {
    elev.floorMin = elev.floors[0];
    elev.floorMax = elev.floors[elev.floors.length - 1];
  }
}

export function removeTenantsForCell(state, floor, col) {
  state.tenants = state.tenants.filter(t => !(t.floor === floor && t.col === col));
}

export function getFloorCount(state) {
  let count = 0;
  for (const [row, cells] of state.grid) {
    if (row === 0) continue;
    for (let c = 0; c < state.cols; c++) {
      const cell = cells[c];
      if (cell && cell.type !== 'elevator' && cell.type !== 'lobby') {
        count++;
        break;
      }
    }
  }
  return count;
}

export function getCellCount(state) {
  let count = 0;
  for (const [, cells] of state.grid) {
    for (let c = 0; c < state.cols; c++) {
      if (cells[c]) count++;
    }
  }
  return count;
}

export function getAllCellsOfType(state, type) {
  const cells = [];
  for (const [row, rowCells] of state.grid) {
    for (let c = 0; c < state.cols; c++) {
      const cell = rowCells[c];
      if (cell && cell.type === type) {
        cells.push({ row, col: c, cell });
      }
    }
  }
  return cells;
}

export function getCellsInRadius(state, row, col, radiusRow, radiusCol) {
  const cells = [];
  for (const [r, rowCells] of state.grid) {
    if (Math.abs(r - row) > radiusRow) continue;
    for (let c = 0; c < state.cols; c++) {
      if (Math.abs(c - col) > radiusCol) continue;
      const cell = rowCells[c];
      if (cell) cells.push({ row: r, col: c, cell });
    }
  }
  return cells;
}

export function markDirtyNear(state, row, col) {
  state.dirtyCells.add(`${row},${col}`);
  for (let dr = -5; dr <= 5; dr++) {
    for (let dc = -5; dc <= 5; dc++) {
      state.dirtyCells.add(`${row + dr},${col + dc}`);
    }
  }
}

export function invalidatePathCache(state) {
  state.pathCache.clear();
}

export function cellToScreenLocal(state, row, col) {
  const towerLeft = (state.canvasW - state.cols * CELL_W * state.zoom) / 2;
  const baseY = (state.canvasH || 600) - GROUND_Y_OFFSET;
  return {
    x: towerLeft + col * CELL_W * state.zoom,
    y: baseY - (row + 1) * CELL_H * state.zoom + state.cameraY,
    w: CELL_W * state.zoom,
    h: CELL_H * state.zoom,
  };
}
