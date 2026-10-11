# Coherence Runner

**Jump higher. Lose coherence.**

A browser-based dinosaur runner where climbing into a noisy atmosphere destroys the interference that makes the world predictable. Clear cacti, collect high-altitude diamonds, and survive an ever-faster desert. Your jump height selects an experimentally measured quantum distribution; its outcomes tighten the spacing of **future** obstacles.

**Themes:** Quantum Playground · Quantum Unlocked  
**Framework:** Qiskit, through Qollab's HTML/JS runtime  
**Quantum budget:** one circuit · one startup job · 20 qubits · five noise levels  
**License:** MIT

This effort is supported by Qollab & IonQ

## Play on Qollab

1. Open the project's **Code** tab and press **Run**.
2. Choose a free **built-in local simulator** or **IonQ Forte 1 remote simulator**. Choosing the remote simulator does not require a hardware-credit run.
3. Wait for **QUANTUM WORLD READY**. The startup circuit requests 1,024 shots. The remote noise-model simulator can take longer than local simulation.
4. Press **Start Run**, Space, or ↑. Keep running, clear the cacti, and collect diamonds.

The game, visualizations, and replays run in the browser. Once the startup result arrives, no further quantum jobs or external services are needed. A failed experiment is reported explicitly; fabricated or analytic results are never silently substituted for measurements.

### Controls and scoring

| Control | Action |
|---|---|
| Space / ↑ | Jump; hold briefly for a higher jump |
| ↓ | Duck on the ground |
| P / Escape | Pause or resume |
| On-screen jump / duck buttons | Pointer and touch controls |
| Space after game over / Run Again | Replay using the same quantum table |

Distance earns points. Each floating diamond adds **100 points**. Diamonds vary in height from **90 to 170 px above ground**, remain safely above their cacti, and are reachable by the jumping dino's body. Higher diamonds reward entering noisier layers; lower ones can be collected with smaller jumps. Cacti are **60 or 86 px tall**, with wider silhouettes and occasional clusters; tall cacti require a held jump rather than a tap. A short tap preserves more predictability; a held jump clears taller obstacles and reaches higher rewards, at the cost of more disruptive terrain commands. The scene starts at **330 px/s** and accelerates to **570 px/s (about 1.73×) in roughly 53 seconds** as you survive. Base gaps vary from roughly **0.95 to 1.60 seconds** of travel around a **1.15-second default**, mixing tight sequences with breathers; quantum commands shorten them further, subject to a **0.92-second minimum** at spawn speed. Quantum noise changes obstacle spacing, not the jump controls or collision rules.

The **Explore an altitude** slider is available before playing and while paused. Use it to examine the measured histogram at each height without needing fast reflexes. The high score lasts for this page run only; Qollab does not provide persistent browser storage. On-screen hold buttons also support Space or Enter when keyboard-focused.

## What problem does this explore?

Quantum noise is often presented as a technical histogram or a fidelity number. Coherence Runner turns the loss of interference into a tangible experience: a reliable rhythm becomes less reliable as the player enters noisier layers.

The challenge is both scientific and practical:

- Can players understand dephasing through an observable change in their environment?
- Can a responsive interactive experience be built from **one circuit submission**, without pretending cloud quantum computers operate at game-frame speed?

Our answer is a small experiment that generates the world's response table once, followed by real-time classical playback. The game makes the relationship between altitude, phase noise, interference, measurement, and terrain explicit.

## The quantum experiment

### An environment creates controllable noise

Each output bit uses a data qubit and an environment qubit:

```text
data |0⟩ ── H ─────── Z ── H ── measure
                     │
env  |0⟩ ── Ry(θ) ───●─────────────────
```

Set **θ = 2 asin(√p)**. The environment's probability of being `1` is then `p`. The controlled-Z entangles the environment with the data. Ignoring the environment produces the phase-flip channel

**Eₚ(ρ) = (1 − p)ρ + p ZρZ.**

The first Hadamard prepares a superposition. At `p = 0`, the final Hadamard restores `0` through interference. Increasing `p` suppresses that predictability. On an ideal backend, the measured output obeys **P(1) = p**, and the intermediate data-qubit interference visibility is **1 − 2p** over the range used here. At `p = 0.5`, that data state is fully dephased.

This is a **circuit-encoded noise model**, not a request to change a remote device's physical noise. It uses ordinary unitary gates and final measurements, so it also works on ideal simulators. IonQ's simulator adds its own device noise on top; those measured results may differ from the ideal reference.

### Five experiments, one circuit

Two independent output bits make four terrain commands at each noise level. Each bit needs one environment, so each level consumes four qubits:

| Dino altitude, measured at its feet | Layer | Modeled phase-flip probability |
|---|---|---:|
| 0–31 px | Clear | 0.000 |
| 32–63 px | Haze | 0.125 |
| 64–95 px | Drift | 0.250 |
| 96–127 px | Static | 0.375 |
| 128 px and above | Chaos | 0.500 |

The five independent blocks occupy **20 qubits** in one `QuantumCircuit`. Only their **10 data qubits** are measured; environment qubits are marginalized out. Every shot produces a sample for every level, so a 1,024-shot job provides 1,024 observations **per level**, not 1,024 divided by five.

The uncompiled circuit has 20 H gates, 10 Ry gates, 10 CZ gates, and 10 final measurements. No resets, intermediate measurements, dynamic circuits, parameter sweeps, or second backend submission are needed. It fits below both Qollab's 24-qubit built-in limit and the Forte simulator's 29-qubit limit.

### From interference to terrain

For the ideal channel, the two-bit probabilities are:

| Outcome | Ideal probability | Future spacing change |
|---|---:|---:|
| `00` | (1 − p)² | Normal gap |
| `01` | p(1 − p) | −10% |
| `10` | p(1 − p) | −18% |
| `11` | p² | −26% |

As `p` rises from 0 to 0.5, the ideal probability of a disruptive command rises from **0% to 75%**. The average ideal spacing reduction rises from **0% to 13.5%**. This is a specified, testable relationship—not an assumption that arbitrary quantum noise always makes arbitrary circuits harder.

During a jump, entering a new higher layer samples that layer's **cached measured distribution** with a seeded classical pseudorandom generator. The newest command replaces the pending command for the next newly generated obstacle. On descent, commands are not repeatedly resampled. If no command is pending, a new obstacle uses normal spacing.

**Fairness:** existing obstacles are never repositioned. New obstacles enter from beyond the right edge. Gaps have a speed-dependent minimum, and held jumps are shorter than the minimum edge-to-edge spawn interval. Collision boxes are slightly inset from the artwork. Increasing noise raises statistical risk; it does not guarantee that each individual jump is punished. Finite-shot sampling and device noise can also make measured neighboring layers non-monotonic.

## Why this is more than quantum randomness

The game is driven by a specific interference experiment with a controlled dephasing mechanism. A player can inspect **why** the dominant output disappears and see how its alternatives affect future terrain. The display pairs measured probabilities with an analytic ideal-channel baseline; that reference requires **no second quantum job**.

The contribution goes beyond a reference circuit through:

- A height-controlled, risk–reward game mechanic tied to loss of interference.
- A portable environment-dilation construction that encodes a noise sweep into one circuit.
- Register-wise extraction of five response distributions from a single experiment.
- A playable visualization, a paused altitude explorer, and exportable measurements.
- Deterministic fixed-step physics and a bounded terrain-generation policy.

**No quantum advantage is claimed.** This small circuit is efficiently classically simulable. Its purpose is creative and educational: quantum mechanics determines the response model, while classical code handles responsive gameplay. The game does not prove entanglement, demonstrate fault tolerance, or query quantum hardware in real time.

## What the interface shows

- **Atmosphere:** current altitude bucket and modeled noise strength.
- **Measurement distribution:** solid bars are measured marginals; dashed outlines are analytic ideal-channel probabilities.
- **Terrain command:** latest sampled output, its layer, and the corresponding spacing delta.
- **Running scene:** original monochrome pixel dino, cacti, desert ground, diamonds, gradual acceleration, score, and session high score.
- **Experiment details:** backend label, shot count, startup duration, world seed, and a JSON export of measured counts and probabilities.

The experience uses keyboard, pointer, and touch controls; visible focus states; semantic buttons; text labels in addition to color; a histogram text alternative; and polite announcements for startup, pause, and game over. It auto-pauses when the page loses focus. Reduced-motion preferences suppress decorative clouds. The paused explorer provides a non-reflex way to engage with the science; the runner itself remains a visual timing game.

## Publish this repository as a Qollab HTML/JS project

Upload these files at their existing paths:

```text
index.html
main.js
main.css
app.js
game.js
renderer.js
quantum.js
requirements.txt
README.md
LICENSE
```

`index.html` intentionally contains body markup only. Qollab renders it and loads `main.js` and `main.css`; no script tags or external assets are necessary. `main.js` imports `QuantumCircuit` from Qollab's `qiskit` bridge and uses the `backend` supplied by the Run dialog. It does not create a backend or require credentials.

**Do not add `local/entry.js` as the Qollab entry point.** The `local/` directory and `serve.py` are development tools, not part of the deployed application. Keep the remote flow to one circuit and one job. To submit another remote job after an error, press **Stop**, then **Run**. Replaying the game never submits another job.

For the first Forte test, you may temporarily reduce `SHOTS` in `quantum.js` from 1,024 to 100 to check startup latency. More shots improve the table's precision but increase remote noise-model simulation time. Actual Forte simulator execution must be verified separately before publishing; local tests are not a claim of remote validation.

## Run locally

Requires Python 3.12+ and, for the tests, Node.js 20+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-local.txt
python serve.py
```

Open **http://localhost:8000**. The browser records the exact gate calls from `quantum.js`; the local server reconstructs that circuit and runs it on Qiskit Aer. There is no duplicated Python definition of the experiment and no fake distribution standing in for a simulator run. Aer uses its ideal matrix-product-state method for these independent shallow blocks.

To test the same simulator implementation that Qollab's built-in option uses:

```bash
python serve.py --simulator basic --port 8001
```

The local server binds to localhost by default. It is a development launcher, not a production backend. The Qollab application runs without this server.

### Tests

```bash
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
```

The JavaScript suite checks circuit resource counts, little-endian marginal decoding, analytic references, sampling boundaries, height mapping, variable jumps, spacing bounds, collision/reset behavior, collectible scoring, acceleration, pause, and deterministic replays at the same viewport size. A timing-player test survives two minutes across several seeds on desktop and mobile, including the maximum scene speed. Python integration tests execute the JavaScript-defined circuit on Aer and BasicSimulator and compare measured marginals with theory.

Optional headless browser smoke test:

```bash
pip install -r requirements-dev.txt
python -m playwright install chromium
python serve.py
# In another terminal:
python tests/browser_smoke.py
```

## Extend or replicate

`quantum.js` owns the quantum experiment, shot count, reference model, and marginal decoding. `game.js` owns the pure fixed-step simulation. `renderer.js` owns original pixel artwork. `app.js` connects the accessible UI to the game. `main.js` is the small Qollab backend adapter.

Try changing the noise grid, terrain outcome mapping, scoring incentives, or the number of levels. Preserve the per-level qubit budget, the backend's qubit limit, and the one-job restriction. For a scientific comparison, export measurements and examine disruptive probability versus `p`; do not infer a device's physical noise strength directly from the game's chosen `p`.

## Originality, attribution, and dependencies

The runner's appearance and controls are inspired by the Chrome offline dinosaur game. All sprites, rendering code, game logic, interface, and experiment integration in this repository are original to this project; no Chrome source code or artwork is included. Google/Chrome are not affiliated with this project.

The environment-dilation construction and phase-flip channel are standard quantum-information techniques. The original application is their integration into an altitude-controlled runner, a one-circuit response table, and an interactive explanation. Implementation and documentation were developed with AI assistance. The repository began with an existing MIT license and Python `.gitignore`, not a pre-existing game implementation.

Runtime dependencies: **Qiskit** (Apache-2.0), supplied through Qollab's bridge. Local development additionally uses **Qiskit Aer** (Apache-2.0) and optionally **Playwright** (Apache-2.0). Their own transitive dependencies retain their respective licenses. The browser UI has no third-party JavaScript, font, sprite, or asset dependency. This repository and any hosted copy of its frontend/backend are MIT-licensed; third-party library licenses are not relicensed.

Useful references:

- [Hackathon submission requirements and themes](https://qollab.xyz/programs/hackathon/terms)
- [Qollab HTML/JS Qiskit projects](https://qollab.xyz/learn/docs/js-qiskit-projects)
- [Qollab backends and simulator limits](https://qollab.xyz/learn/docs/compute-backends)
- [Qollab runtime and one-job restriction](https://qollab.xyz/learn/docs/runtime-environment)

## Demo video and submission checklist

The hackathon requires a **2–3 minute public demo video** that opens without signing in. Record and add its public URL to this project page before submission; no video is included yet.

Suggested demo: start on a free simulator; explain the one-circuit loading phase; inspect clear versus chaotic histograms; play short and held jumps; collect a diamond; show future spacing changes and acceleration; finish with the circuit, baseline, and honest simulator/no-advantage explanation.

- [ ] Test the published project on Qollab's built-in simulator.
- [ ] Test one startup job on the free IonQ Forte 1 simulator.
- [ ] Publish the runnable project under MIT before the deadline.
- [ ] Add the public 2–3 minute demo video link.
- [ ] Check keyboard navigation and the paused explorer in the published UI.
- [ ] Keep the project available for the required 12 months.

This effort is supported by Qollab & IonQ
