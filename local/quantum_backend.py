"""Execute the circuit recorded from quantum.js, without a second circuit definition."""

import math
import time

from qiskit import QuantumCircuit, transpile
from qiskit.providers.basic_provider import BasicSimulator


def circuit_from_spec(spec):
    """Accept only the small gate vocabulary and resource budget used by the game."""
    if not isinstance(spec, dict) or spec.get("qubits") != 20 or spec.get("bits") != 10:
        raise ValueError("Expected a 20-qubit, 10-classical-bit circuit.")
    instructions = spec.get("instructions")
    if not isinstance(instructions, list) or len(instructions) != 50:
        raise ValueError("Expected exactly 50 circuit instructions.")
    circuit = QuantumCircuit(20, 10)

    def qubit(value):
        if type(value) is not int or not 0 <= value < 20:
            raise ValueError("Invalid qubit index.")
        return value

    for operation in instructions:
        if not isinstance(operation, list) or not operation:
            raise ValueError("Invalid instruction.")
        gate, *args = operation
        if gate == "h" and len(args) == 1:
            circuit.h(qubit(args[0]))
        elif gate == "ry" and len(args) == 2:
            angle, target = args
            if not isinstance(angle, (int, float)) or not math.isfinite(angle):
                raise ValueError("Invalid rotation angle.")
            circuit.ry(angle, qubit(target))
        elif gate == "cz" and len(args) == 2:
            circuit.cz(qubit(args[0]), qubit(args[1]))
        elif gate == "measure" and len(args) == 2:
            target, bit = args
            if type(bit) is not int or not 0 <= bit < 10:
                raise ValueError("Invalid classical bit index.")
            circuit.measure(qubit(target), bit)
        else:
            raise ValueError(f"Unsupported instruction: {gate}")
    return circuit


def run_experiment(spec, shots=1024, simulator="aer", seed=2026):
    if type(shots) is not int or not 1 <= shots <= 8192:
        raise ValueError("Shots must be between 1 and 8192.")
    started = time.perf_counter()
    circuit = circuit_from_spec(spec)
    if simulator == "aer":
        from qiskit_aer import AerSimulator

        # Independent shallow blocks are particularly efficient with an MPS simulator.
        backend = AerSimulator(method="matrix_product_state")
        label = "Local Qiskit Aer / ideal MPS"
    elif simulator == "basic":
        backend = BasicSimulator()
        label = "Local Qiskit BasicSimulator / ideal"
    else:
        raise ValueError("Choose aer or basic.")
    compiled = transpile(circuit, backend, seed_transpiler=seed, optimization_level=1)
    result = backend.run(compiled, shots=shots, seed_simulator=seed).result()
    counts = {str(key): int(value) for key, value in result.get_counts().items()}
    return {
        "counts": counts,
        "metadata": {
            "backend": label,
            "durationSeconds": time.perf_counter() - started,
            "requestedShots": shots,
            "simulatorSeed": seed,
            "originalQubits": circuit.num_qubits,
            "compiledQubits": compiled.num_qubits,
        },
    }
