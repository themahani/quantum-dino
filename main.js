// Qollab HTML/JS entry point. `backend` is injected by its Run dialog.
import { QuantumCircuit } from 'qiskit';
import { createApp } from './app.js';
import { buildCircuit, decodeCounts, SHOTS } from './quantum.js';

const app = createApp();
const started = performance.now();
try {
  const circuit = buildCircuit(QuantumCircuit);
  // Exactly one circuit and one job for the lifetime of this Qollab run.
  const job = await backend.run(circuit, { shots: SHOTS });
  const result = await job.result();
  const counts = result.get_counts().toJs();
  app.ready(decodeCounts(counts), {
    backend: 'Qollab selected backend',
    durationSeconds: (performance.now() - started) / 1000,
    requestedShots: SHOTS,
  });
} catch (error) {
  app.fail(error);
}
