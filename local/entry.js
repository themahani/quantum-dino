import { createApp } from '../app.js';
import { buildCircuit, decodeCounts, SHOTS } from '../quantum.js';
import { recordCircuit } from './circuit-recorder.js';

const app = createApp();
try {
  const circuit = buildCircuit(recordCircuit);
  const params = new URLSearchParams({ circuit: JSON.stringify(circuit), shots: String(SHOTS) });
  const response = await fetch(`/api/run?${params}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Local simulation failed.');
  app.ready(decodeCounts(result.counts), result.metadata);
} catch (error) {
  app.fail(error);
}
