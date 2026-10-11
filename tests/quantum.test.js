import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCircuit, decodeCounts, idealDistribution, sampleOutcome, NOISE_LEVELS } from '../quantum.js';
import { recordCircuit } from '../local/circuit-recorder.js';

test('one 20-qubit circuit has ten disjoint noise channels and only final data measurements', () => {
  const circuit = buildCircuit(recordCircuit);
  assert.equal(circuit.qubits, 20);
  assert.equal(circuit.bits, 10);
  assert.equal(circuit.instructions.length, 50);
  assert.equal(circuit.instructions.filter(op => op[0] === 'cz').length, 10);
  assert.ok(circuit.instructions.slice(0, 40).every(op => op[0] !== 'measure'));
  circuit.instructions.slice(40).forEach((op, bit) => {
    assert.deepEqual(op, ['measure', bit * 2, bit]);
  });
  const rotations = circuit.instructions.filter(op => op[0] === 'ry');
  rotations.forEach((op, i) => assert.ok(Math.abs(Math.sin(op[1] / 2) ** 2 - NOISE_LEVELS[Math.floor(i / 2)]) < 1e-12));
});

test('marginals use little-endian classical register indices, not qubit indices', () => {
  const value = (3 << 8) | (2 << 6) | (1 << 4) | (0 << 2) | 2;
  const table = decodeCounts(new Map([[value.toString(2), 7], ['0 000000000', 3]]));
  assert.equal(table.shots, 10);
  [2, 0, 1, 2, 3].forEach((outcome, level) => {
    assert.equal(table.levels[level].counts[outcome], outcome === 0 ? 10 : 7);
    assert.equal(table.levels[level].counts.reduce((a, b) => a + b), 10);
    assert.ok(Math.abs(table.levels[level].probabilities.reduce((a, b) => a + b) - 1) < 1e-12);
  });
});

test('invalid or empty backend results fail instead of silently inventing a world', () => {
  for (const counts of [{}, { '00': -1 }, { 'x': 1 }, { '10000000000': 1 }, { '00': 1.5 }]) {
    assert.throws(() => decodeCounts(counts));
  }
});

test('analytic ideal channel becomes uniform at p=0.5 and disruptive mass increases', () => {
  assert.deepEqual(idealDistribution(0), [1, 0, 0, 0]);
  assert.deepEqual(idealDistribution(0.5), [0.25, 0.25, 0.25, 0.25]);
  let previous = -1;
  NOISE_LEVELS.forEach(p => {
    const distribution = idealDistribution(p);
    const disruptive = 1 - distribution[0];
    assert.ok(disruptive > previous);
    previous = disruptive;
  });
});

test('sampling respects zero-mass outcomes and cumulative boundaries', () => {
  assert.equal(sampleOutcome([1, 0, 0, 0], () => 0.999), 0);
  assert.equal(sampleOutcome([0, 0, 1, 0], () => 0), 2);
  assert.equal(sampleOutcome([0.25, 0.25, 0.25, 0.25], () => 0.5), 2);
  assert.equal(sampleOutcome([0.25, 0.25, 0.25, 0.25], () => 0.999), 3);
});
