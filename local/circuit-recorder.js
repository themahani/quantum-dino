/** Local adapter records the EXACT calls made by buildCircuit; it does not simulate. */
export function recordCircuit(qubits, bits) {
  const instructions = [];
  return {
    qubits, bits, instructions,
    h: qubit => instructions.push(['h', qubit]),
    ry: (angle, qubit) => instructions.push(['ry', angle, qubit]),
    cz: (control, target) => instructions.push(['cz', control, target]),
    measure: (qubit, bit) => instructions.push(['measure', qubit, bit]),
  };
}
