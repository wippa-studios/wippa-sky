// ═══════════════════════════════════════════
//  NEEDS — Wippa Sky v2
// ═══════════════════════════════════════════

import {
  MOOD_CONTENT, MOOD_ANNYED, MOOD_ANGRY, MOOD_FURIOUS,
  ELEVATOR_WAIT_STRESS_START, ELEVATOR_WAIT_STRESS_RATE,
  FURIOUS_DAYS_BEFORE_MOVEOUT, RELET_MIN_RATING, RELET_DAYS,
  DEEP_RETAIL_MOOD_PENALTY, FLOOR_TYPES,
} from './constants.js';
import { getCell } from './state.js';

export function updateNeeds(sim, state, dt) {
  const rate = dt * state.speed;
  sim.energy += (sim.state === 'resting' ? 12 : -1.5) * rate;
  sim.food += (sim.action === 'restaurant' || sim.action === 'home' ? 8 : -1.2) * rate;
  sim.leisure += (sim.action === 'recharging' || sim.action === 'park' || sim.action === 'cinema' || sim.action === 'spa' ? 10 : -0.8) * rate;
  if (sim.kind === 'worker') {
    sim.workNeed += (sim.state === 'working' ? -15 : 3) * rate;
  }
  sim.energy = clamp(sim.energy);
  sim.food = clamp(sim.food);
  sim.leisure = clamp(sim.leisure);
  sim.workNeed = clamp(sim.workNeed);
}

export function calculateMood(sim, state) {
  let mood = 70;
  const needPenalty = (100 - sim.energy) * 0.1 + (100 - sim.food) * 0.1 + (100 - sim.leisure) * 0.08;
  mood -= needPenalty;
  if (sim.kind === 'worker' && sim.workNeed > 50) {
    mood -= (sim.workNeed - 50) * 0.15;
  }
  if (sim.waitSince > 0) {
    const waitS = (state.tick - sim.waitSince) * state.speed;
    if (waitS > ELEVATOR_WAIT_STRESS_START) {
      mood -= (waitS - ELEVATOR_WAIT_STRESS_START) * ELEVATOR_WAIT_STRESS_RATE;
    }
  }
  const cell = getCell(state, sim.floor, sim.col);
  if (cell && cell.occupancy > (FLOOR_TYPES[cell.type]?.capacity || 4)) {
    mood -= 15;
  }
  const amenityBonus = getAmenityBonus(state, sim.floor, sim.col);
  mood += amenityBonus;
  const avgMood = state.tenants.length > 0
    ? state.tenants.reduce((s, t) => s + t.mood, 0) / state.tenants.length
    : 70;
  if (avgMood > 75) mood += 3;
  else if (avgMood < 40) mood -= 5;
  sim.mood = clamp(mood);
}

function getAmenityBonus(state, row, col) {
  let bonus = 0;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const cell = getCell(state, row + dr, col + dc);
      if (cell && FLOOR_TYPES[cell.type] && FLOOR_TYPES[cell.type].satisfaction > 0) {
        bonus += FLOOR_TYPES[cell.type].satisfaction * 0.3;
      }
    }
  }
  return Math.min(bonus, 15);
}

export function getMoodBand(mood) {
  if (mood >= MOOD_CONTENT) return 'content';
  if (mood >= MOOD_ANNYED) return 'annoyed';
  if (mood >= MOOD_ANGRY) return 'angry';
  return 'furious';
}

export function getMoodColor(mood) {
  if (mood >= MOOD_CONTENT) return '#4ade80';
  if (mood >= MOOD_ANNYED) return '#fbbf24';
  if (mood >= MOOD_ANGRY) return '#f87171';
  return '#ef4444';
}

export function getIncomeMult(mood) {
  if (mood >= MOOD_CONTENT) return 1.1;
  if (mood >= MOOD_ANNYED) return 0.95;
  if (mood >= MOOD_ANGRY) return 0.7;
  return 0.4;
}

export function shouldMoveOut(sim, state) {
  if (sim.mood >= MOOD_FURIOUS) {
    if (!sim._furiousSince) sim._furiousSince = state.day;
    if (state.day - sim._furiousSince >= FURIOUS_DAYS_BEFORE_MOVEOUT) {
      return true;
    }
  } else {
    sim._furiousSince = null;
  }
  return false;
}

export function shouldRelet(state, cell) {
  if (!cell.vacantSince) return false;
  if (state.day - cell.vacantSince < RELET_DAYS) return false;
  if (state.rating < RELET_MIN_RATING) return false;
  return Math.random() < 0.3;
}

export function getCellHappiness(state, row, col) {
  const sims = state.tenants.filter(t => t.floor === row && t.col === col);
  if (sims.length === 0) return 70;
  return sims.reduce((s, t) => s + t.mood, 0) / sims.length;
}

export function getCellWaitingStats(state, row, col) {
  const sims = state.tenants.filter(t => t.floor === row && t.col === col && t.state === 'waitingElevator');
  if (sims.length === 0) return { count: 0, avgWait: 0 };
  const waits = sims.map(t => (state.tick - t.waitSince) * state.speed);
  return {
    count: sims.length,
    avgWait: waits.reduce((a, b) => a + b, 0) / waits.length,
  };
}

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}
