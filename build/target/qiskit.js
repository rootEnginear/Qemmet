const getQiskitGateName = (gate_name) => {
    if (gate_name === '/x')
        return 'sx';
    if (gate_name === 'sw')
        return 'swap';
    return gate_name;
};
const capitalize = (string) => {
    const [first, ...rest] = string;
    return first.toUpperCase() + rest.join('');
};
const getQiskitLibGateName = (gate_name) => {
    if (gate_name === 'p')
        return 'Phase';
    if (['sx', 'rx', 'ry', 'rz'].includes(gate_name))
        return gate_name.toUpperCase();
    return capitalize(gate_name);
};
const getQiskitString = ({ qubit_count, bit_count, gate_info }) => {
    const qiskit_string = gate_info
        .map(({ control_count, gate_name: original_gate_name, gate_params, gate_registers }) => {
        // translate gate name
        const gate_name = getQiskitGateName(original_gate_name);
        // special measure instruction
        if (gate_name === 'm')
            return `${gate_registers
                .map((register) => `qc.measure(${register}, ${register})`)
                .join('\n')}\n`;
        // special barrier instruction
        if (gate_name === 'b')
            return `qc.barrier(${gate_registers.join(', ')})\n`;
        // parameterized gate
        if (gate_params) {
            if (control_count === 0)
                return `${gate_registers
                    .map((register) => `qc.${gate_name}(${gate_params}, [${register}])`)
                    .join('\n')}\n`;
            // controlled gate
            return `qc.append(${getQiskitLibGateName(gate_name)}Gate(${gate_params}).control(${control_count}), [${gate_registers.join(', ')}])\n`;
        }
        // swap gate
        if (gate_name === 'swap') {
            if (control_count === 1)
                return `qc.swap(${gate_registers.join(', ')})\n`;
            return `qc.append(${getQiskitLibGateName(gate_name)}Gate().control(${control_count - 1}), [${gate_registers.join(', ')}])\n`;
        }
        // normal gate
        if (control_count === 0)
            return `${gate_registers.map((register) => `qc.${gate_name}(${register})`).join('\n')}\n`;
        // controlled gate
        return `qc.append(${getQiskitLibGateName(gate_name)}Gate().control(${control_count}), [${gate_registers.join(', ')}])\n`;
    })
        .join('');
    return `from numpy import pi, e as euler
from qiskit import QuantumCircuit
from qiskit.circuit.library.standard_gates import SdgGate, TdgGate, SXGate, RXGate, RYGate, RZGate, U1Gate, U2Gate, U3Gate, SwapGate, XGate, YGate, ZGate, HGate, PhaseGate, SGate, TGate

qc = QuantumCircuit(${qubit_count}${bit_count ? `, ${bit_count}` : ''})

${qiskit_string}`;
};
export default { getQiskitString };
