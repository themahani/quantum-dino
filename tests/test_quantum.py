"""Integration tests run the JavaScript-defined circuit on actual Qiskit simulators."""

import json
import subprocess
import unittest
from pathlib import Path

from local.quantum_backend import circuit_from_spec, run_experiment

ROOT = Path(__file__).resolve().parents[1]


def recorded_spec():
    script = (
        "import {buildCircuit} from './quantum.js';"
        "import {recordCircuit} from './local/circuit-recorder.js';"
        "console.log(JSON.stringify(buildCircuit(recordCircuit)));"
    )
    return json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", script], cwd=ROOT, text=True
    ))


def marginals(counts):
    totals = [[0] * 4 for _ in range(5)]
    shots = sum(counts.values())
    for key, count in counts.items():
        value = int(key.replace(" ", ""), 2)
        for level in range(5):
            totals[level][(value >> (level * 2)) & 3] += count
    return [[count / shots for count in row] for row in totals]


class QuantumIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = recorded_spec()

    def test_resource_budget_and_gate_set(self):
        circuit = circuit_from_spec(self.spec)
        self.assertEqual(circuit.num_qubits, 20)
        self.assertEqual(circuit.num_clbits, 10)
        self.assertEqual(dict(circuit.count_ops()), {"h": 20, "ry": 10, "cz": 10, "measure": 10})

    def test_aer_measured_marginals_match_channel_theory(self):
        result = run_experiment(self.spec, shots=4096)
        values = marginals(result["counts"])
        for level, p in enumerate([0, 0.125, 0.25, 0.375, 0.5]):
            expected = [(1 - p) ** 2, p * (1 - p), p * (1 - p), p ** 2]
            for measured, ideal in zip(values[level], expected):
                self.assertAlmostEqual(measured, ideal, delta=0.035)
        self.assertEqual(values[0], [1, 0, 0, 0])

    def test_qollab_builtin_simulator_compatibility(self):
        result = run_experiment(self.spec, shots=256, simulator="basic")
        values = marginals(result["counts"])
        self.assertEqual(sum(result["counts"].values()), 256)
        self.assertEqual(values[0], [1, 0, 0, 0])
        for probability in values[4]:
            self.assertAlmostEqual(probability, 0.25, delta=0.10)

    def test_invalid_specs_and_shot_budgets_are_rejected(self):
        with self.assertRaises(ValueError):
            circuit_from_spec({"qubits": 29, "bits": 10})
        for shots in [0, -1, 8193, 1.5]:
            with self.assertRaises(ValueError):
                run_experiment(self.spec, shots=shots)


if __name__ == "__main__":
    unittest.main()
