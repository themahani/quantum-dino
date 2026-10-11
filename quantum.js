/** One portable circuit, five independent environment-dilated noise experiments. */
export const NOISE_LEVELS = Object.freeze([0, 0.125, 0.25, 0.375, 0.5]);
export const OUTCOMES = Object.freeze(['00', '01', '10', '11']);
export const SHOTS = 1024;
export const QUBITS = 20;

export function buildCircuit(QuantumCircuit) {
  const circuit = QuantumCircuit(QUBITS, NOISE_LEVELS.length * 2);
  NOISE_LEVELS.forEach((p, level) => {
    for (let bit = 0; bit < 2; bit += 1) {
      const data = level * 4 + bit * 2;
      const environment = data + 1;
      circuit.h(data);
      circuit.ry(2 * Math.asin(Math.sqrt(p)), environment);
      circuit.cz(environment, data);
      circuit.h(data);
    }
  });
  // Only data qubits are measured. Marginalizing the environments realizes noise.
  NOISE_LEVELS.forEach((_, level) => {
    circuit.measure(level * 4, level * 2);
    circuit.measure(level * 4 + 2, level * 2 + 1);
  });
  return circuit;
}

export function idealDistribution(p) {
  return [(1 - p) ** 2, p * (1 - p), p * (1 - p), p ** 2];
}

/** Qiskit strings put classical bit zero on the RIGHT. Preserve register marginals. */
export function decodeCounts(rawCounts) {
  const entries = rawCounts instanceof Map ? [...rawCounts] : Object.entries(rawCounts);
  const totals = NOISE_LEVELS.map(() => [0, 0, 0, 0]);
  let shots = 0;
  for (const [rawKey, count] of entries) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid shot count.');
    const key = String(rawKey).replace(/\s/g, '');
    if (!/^[01]{1,10}$/.test(key)) throw new Error(`Invalid measurement key: ${key}`);
    const value = Number.parseInt(key, 2);
    shots += count;
    totals.forEach((counts, level) => { counts[(value >> (level * 2)) & 3] += count; });
  }
  if (!shots) throw new Error('The circuit returned no measurements.');
  return {
    shots,
    qubits: QUBITS,
    levels: NOISE_LEVELS.map((p, i) => ({
      p, counts: totals[i], probabilities: totals[i].map(count => count / shots),
      ideal: idealDistribution(p),
    })),
  };
}

export function sampleOutcome(probabilities, random) {
  let cumulative = 0;
  const draw = random();
  for (let i = 0; i < probabilities.length - 1; i += 1) {
    cumulative += probabilities[i];
    if (draw < cumulative) return i;
  }
  return probabilities.length - 1;
}
