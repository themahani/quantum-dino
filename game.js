import { sampleOutcome } from './quantum.js';

export const WORLD = Object.freeze({ width: 960, height: 320, ground: 260, dinoX: 90 });
export const PHYSICS = Object.freeze({
  gravity: 1650, jumpVelocity: 520, holdAcceleration: 1050, holdTime: 0.20,
  maxHeight: 160, initialSpeed: 330, maxSpeed: 570, acceleration: 4.5,
});
export const TERRAIN = Object.freeze({
  baseGapSeconds: 1.15, minGapSeconds: 0.92,
  minVariationSeconds: -0.20, variationRangeSeconds: 0.65,
});
export const CACTI = Object.freeze({ shortHeight: 60, tallHeight: 86, shortWidth: 28, tallWidth: 34, clusterWidth: 56 });
export const DIAMONDS = Object.freeze({ minHeight: 90, maxHeight: 170, cactusClearance: 24 });
export const SPACING_DELTAS = Object.freeze([0, -0.10, -0.18, -0.26]);
export const LEVEL_NAMES = Object.freeze(['CLEAR', 'HAZE', 'DRIFT', 'STATIC', 'CHAOS']);

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function heightToLevel(height) {
  return Math.min(4, Math.max(0, Math.floor(height / (PHYSICS.maxHeight / 5))));
}

export function obstacleGap(speed, outcome, variation = 0) {
  // Preserve landing time while allowing tight sequences and occasional breathers.
  return Math.max(speed * TERRAIN.minGapSeconds,
    speed * (TERRAIN.baseGapSeconds + variation) * (1 + SPACING_DELTAS[outcome]));
}

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

export class Runner {
  constructor(table, seed = 2026, viewportWidth = WORLD.width) {
    this.table = table;
    this.seed = seed;
    this.viewportWidth = viewportWidth;
    this.reset();
  }

  reset() {
    this.random = seededRandom(this.seed);
    this.state = 'ready';
    this.time = 0;
    this.distance = 0;
    this.speed = PHYSICS.initialSpeed;
    this.score = 0;
    this.bonus = 0;
    this.height = 0;
    this.velocity = 0;
    this.holdElapsed = 0;
    this.jumpHeld = false;
    this.duckHeld = false;
    this.level = 0;
    this.peakLevel = 0;
    this.pending = { outcome: 0, level: 0 };
    this.lastMeasurement = null;
    this.events = [];
    this.obstacles = [];
    this.collectibles = [];
    this.nextObstacleId = 0;
    this.spawnObstacle(this.viewportWidth + 150, 0, 0);
  }

  start() { if (this.state === 'ready') this.state = 'running'; }

  jump() {
    if (this.state !== 'running' || this.height > 0 || this.duckHeld) return;
    this.velocity = PHYSICS.jumpVelocity;
    this.holdElapsed = 0;
    this.jumpHeld = true;
    this.peakLevel = 0;
  }

  releaseJump() { this.jumpHeld = false; }
  pause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this.releaseJump();
      this.duckHeld = false;
    }
  }
  resume() { if (this.state === 'paused') this.state = 'running'; }

  measure(level) {
    const outcome = sampleOutcome(this.table.levels[level].probabilities, this.random);
    this.pending = { outcome, level };
    this.lastMeasurement = { outcome, level, time: this.time };
    this.events.unshift(this.lastMeasurement);
    this.events.length = Math.min(6, this.events.length);
  }

  spawnObstacle(x, outcome, level) {
    const tall = this.random() > 0.55;
    const cluster = !tall && this.random() > 0.7;
    const obstacle = {
      id: this.nextObstacleId++, x,
      width: cluster ? CACTI.clusterWidth : tall ? CACTI.tallWidth : CACTI.shortWidth,
      height: tall ? CACTI.tallHeight : CACTI.shortHeight, tall, cluster, outcome, level, passed: false,
    };
    this.obstacles.push(obstacle);
    if (obstacle.id % 3 === 1) {
      const minHeight = Math.max(DIAMONDS.minHeight, obstacle.height + DIAMONDS.cactusClearance);
      const height = minHeight + Math.floor(this.random() * (DIAMONDS.maxHeight - minHeight + 1));
      this.collectibles.push({ x: x + obstacle.width / 2, height, collected: false });
    }
  }

  dinoBox() {
    const ducking = this.duckHeld && this.height === 0;
    return { x: WORLD.dinoX + 7, y: WORLD.ground - this.height - (ducking ? 24 : 43),
      width: ducking ? 48 : 28, height: ducking ? 20 : 39 };
  }

  update(dt) {
    if (this.state !== 'running') return;
    this.time += dt;
    this.speed = Math.min(PHYSICS.maxSpeed, PHYSICS.initialSpeed + this.time * PHYSICS.acceleration);
    const travel = this.speed * dt;
    this.distance += travel;
    if (this.height > 0 || this.velocity > 0) {
      const holding = this.jumpHeld && this.holdElapsed < PHYSICS.holdTime && this.velocity > 0;
      this.velocity += (-PHYSICS.gravity + (holding ? PHYSICS.holdAcceleration : 0)) * dt;
      this.holdElapsed += dt;
      this.height = Math.max(0, this.height + this.velocity * dt);
      this.level = heightToLevel(this.height);
      if (this.level > this.peakLevel) {
        this.peakLevel = this.level;
        this.measure(this.level);
      }
      if (this.height === 0) {
        if (this.peakLevel === 0) this.measure(0);
        this.velocity = 0;
        this.releaseJump();
      }
    } else {
      this.level = 0;
    }
    for (const obstacle of this.obstacles) {
      obstacle.x -= travel;
      if (!obstacle.passed && obstacle.x + obstacle.width < WORLD.dinoX) obstacle.passed = true;
      const box = { x: obstacle.x + 3, y: WORLD.ground - obstacle.height + 3,
        width: obstacle.width - 6, height: obstacle.height - 4 };
      if (overlaps(this.dinoBox(), box)) this.state = 'over';
    }
    for (const item of this.collectibles) {
      item.x -= travel;
      const box = { x: item.x - 10, y: WORLD.ground - item.height - 10, width: 20, height: 20 };
      if (!item.collected && overlaps(this.dinoBox(), box)) {
        item.collected = true;
        this.bonus += 100;
      }
    }
    this.obstacles = this.obstacles.filter(item => item.x + item.width > -60);
    this.collectibles = this.collectibles.filter(item => item.x > -30 && !item.collected);
    const last = this.obstacles.at(-1);
    // Never mutate an existing obstacle. Quantum deltas only affect a new spawn.
    if (!last || last.x + last.width < this.viewportWidth + 90) {
      const { outcome, level } = this.pending;
      const variation = TERRAIN.minVariationSeconds + this.random() * TERRAIN.variationRangeSeconds;
      const gap = obstacleGap(this.speed, outcome, variation);
      const x = Math.max(this.viewportWidth + 90, last ? last.x + last.width + gap : this.viewportWidth + 90);
      this.spawnObstacle(x, outcome, level);
      this.pending = { outcome: 0, level: 0 };
    }
    this.score = Math.floor(this.distance / 10) + this.bonus;
  }
}
