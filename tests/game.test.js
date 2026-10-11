import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, PHYSICS, TERRAIN, CACTI, DIAMONDS, WORLD, heightToLevel, obstacleGap, seededRandom } from '../game.js';
import { NOISE_LEVELS, idealDistribution } from '../quantum.js';

const table = { levels: NOISE_LEVELS.map(p => ({ probabilities: idealDistribution(p) })) };
const tick = runner => runner.update(1 / 120);

test('height bins clamp at both ends', () => {
  assert.deepEqual([-1, 0, 31, 32, 64, 96, 128, 160, 200].map(heightToLevel), [0, 0, 0, 1, 2, 3, 4, 4, 4]);
});

test('higher jumps reach the noisy top layer; tapping stays lower; both land', () => {
  function simulate(hold) {
    const runner = new Runner(table);
    runner.start(); runner.jump();
    if (!hold) runner.releaseJump();
    let max = 0;
    let duration = 0;
    while ((runner.height > 0 || runner.velocity > 0) && duration < 2) {
      tick(runner); duration += 1 / 120; max = Math.max(max, runner.height);
    }
    assert.equal(runner.height, 0);
    assert.ok(duration < TERRAIN.minGapSeconds);
    return { max, runner };
  }
  const tap = simulate(false);
  const hold = simulate(true);
  assert.ok(hold.max > tap.max + 40);
  assert.equal(hold.runner.peakLevel, 4);
  assert.equal(tap.runner.peakLevel, 2);
});

test('obstacle spacing stays jumpable and every disruptive category tightens the gap', () => {
  for (const speed of [PHYSICS.initialSpeed, 420, PHYSICS.maxSpeed]) {
    const gaps = [0, 1, 2, 3].map(outcome => obstacleGap(speed, outcome));
    assert.ok(gaps.every(gap => gap >= speed * TERRAIN.minGapSeconds));
    assert.ok(gaps.every((gap, i) => !i || gap < gaps[i - 1]));
  }
});

test('gap variation includes tight sequences and breathers without violating the landing floor', () => {
  const speed = PHYSICS.maxSpeed;
  const low = TERRAIN.minVariationSeconds;
  const high = low + TERRAIN.variationRangeSeconds;
  assert.ok(obstacleGap(speed, 0, high) - obstacleGap(speed, 0, low) >= speed * 0.6);
  assert.ok(obstacleGap(speed, 0, low) < speed * 1.1);
  for (let variation = low; variation <= high; variation += 0.01) {
    const gaps = [0, 1, 2, 3].map(outcome => obstacleGap(speed, outcome, variation));
    assert.ok(gaps.every(gap => gap >= speed * TERRAIN.minGapSeconds));
    assert.ok(gaps.every((gap, i) => !i || gap <= gaps[i - 1]));
  }
});

test('quantum commands do not teleport existing obstacles', () => {
  const runner = new Runner(table);
  runner.start();
  const before = runner.obstacles.map(obstacle => ({ ...obstacle }));
  runner.measure(4);
  tick(runner);
  before.forEach(obstacle => {
    const after = runner.obstacles.find(item => item.id === obstacle.id);
    assert.ok(Math.abs(after.x - (obstacle.x - runner.speed / 120)) < 1e-8);
    assert.equal(after.width, obstacle.width);
    assert.equal(after.height, obstacle.height);
  });
});

test('tall cacti require more than a tap but remain clearable with a held jump', () => {
  function attempt(hold) {
    const runner = new Runner(table);
    runner.obstacles = [{ id: 0, x: WORLD.dinoX + PHYSICS.initialSpeed * 0.32,
      width: CACTI.tallWidth, height: CACTI.tallHeight, tall: true, cluster: false,
      outcome: 0, level: 0, passed: false }];
    runner.start(); runner.jump();
    if (!hold) runner.releaseJump();
    for (let i = 0; i < 120 && runner.state === 'running'; i += 1) tick(runner);
    return runner.state;
  }
  assert.equal(attempt(false), 'over');
  assert.equal(attempt(true), 'running');
});

test('speed increases over survival time and has a playable cap', () => {
  const runner = new Runner(table);
  runner.start();
  const speeds = [];
  for (let second = 0; second < 100; second += 1) {
    // Keep the test lane clear; this test isolates the speed schedule.
    for (let step = 0; step < 120; step += 1) {
      runner.obstacles.forEach(item => { item.x = 10000; });
      tick(runner);
    }
    speeds.push(runner.speed);
  }
  assert.ok(speeds[0] > PHYSICS.initialSpeed);
  assert.ok(speeds.every((speed, i) => !i || speed >= speeds[i - 1]));
  assert.equal(speeds.at(-1), PHYSICS.maxSpeed);
});

test('pause freezes simulation, releases held inputs, and resume continues', () => {
  const runner = new Runner(table);
  runner.start(); runner.jump(); tick(runner); runner.pause();
  const snapshot = JSON.stringify(runner);
  for (let i = 0; i < 120; i += 1) tick(runner);
  assert.equal(JSON.stringify(runner), snapshot);
  assert.equal(runner.jumpHeld, false);
  runner.resume(); tick(runner);
  assert.ok(runner.time > 1 / 120);
});

test('collisions end a run and a clean reset reuses the original seed', () => {
  const runner = new Runner(table);
  const initial = JSON.stringify(runner.obstacles);
  runner.start(); runner.obstacles[0].x = WORLD.dinoX + 10; tick(runner);
  assert.equal(runner.state, 'over');
  runner.reset();
  assert.equal(runner.state, 'ready');
  assert.equal(runner.score, 0);
  assert.equal(JSON.stringify(runner.obstacles), initial);
});

test('a high-altitude collectible earns 100 bonus points exactly once', () => {
  const runner = new Runner(table);
  runner.start(); runner.height = 115;
  runner.collectibles = [{ x: WORLD.dinoX + 20, height: 135, collected: false }];
  tick(runner);
  assert.equal(runner.bonus, 100);
  tick(runner);
  assert.equal(runner.bonus, 100);
});

test('diamond heights vary, clear their cacti, and stay within jumping reach', () => {
  const runner = new Runner(table);
  runner.start(); runner.jump();
  let peakHeight = 0;
  while (runner.height > 0 || runner.velocity > 0) {
    tick(runner);
    peakHeight = Math.max(peakHeight, runner.height);
  }
  runner.reset();
  const heights = new Set();
  for (let i = 0; i < 90; i += 1) {
    runner.spawnObstacle(1000 + i * 1000, 0, 0);
    const obstacle = runner.obstacles.at(-1);
    if (obstacle.id % 3 !== 1) continue;
    const diamond = runner.collectibles.at(-1);
    heights.add(diamond.height);
    assert.equal(diamond.x, obstacle.x + obstacle.width / 2);
    assert.ok(diamond.height >= DIAMONDS.minHeight);
    assert.ok(diamond.height <= DIAMONDS.maxHeight);
    assert.ok(diamond.height - 10 > obstacle.height);
    assert.ok(diamond.height < peakHeight + 43, 'Diamond should be reachable by the dino body');
  }
  assert.ok(heights.size > 10);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 50);
});

test('identical seeds and fixed-step inputs reproduce the same terrain and measurements', () => {
  const a = new Runner(table, 17);
  const b = new Runner(table, 17);
  a.start(); b.start();
  for (let step = 0; step < 1000; step += 1) {
    if (step % 100 === 0) { a.jump(); b.jump(); }
    if (step % 100 === 28) { a.releaseJump(); b.releaseJump(); }
    tick(a); tick(b);
  }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const rng1 = seededRandom(7), rng2 = seededRandom(7);
  assert.deepEqual(Array.from({ length: 20 }, rng1), Array.from({ length: 20 }, rng2));
});

test('a simple timing player can survive generated terrain at the speed cap on desktop and mobile', () => {
  for (const width of [480, 960]) {
    for (const seed of [1, 7, 2026]) {
      const runner = new Runner(table, seed, width);
      runner.start();
      for (let step = 0; step < 120 * 120; step += 1) {
        const next = runner.obstacles.find(obstacle => obstacle.x + obstacle.width > WORLD.dinoX);
        if (next && runner.height === 0 && (next.x - WORLD.dinoX) / runner.speed < 0.32) runner.jump();
        tick(runner);
        assert.equal(runner.state, 'running', `Unclearable sequence: width ${width}, seed ${seed}, step ${step}`);
      }
      assert.equal(runner.speed, PHYSICS.maxSpeed);
      assert.ok(runner.bonus > 0);
    }
  }
});
