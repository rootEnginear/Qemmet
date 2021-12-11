const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi]', 'g');
const transformOptionString = (option_string) => {
    if (!option_string)
        return { startFromZero: false };
    const option_array = [...option_string].map(Number);
    return {
        startFromZero: !!option_array[0],
    };
};
const parseMetadata = (qemmet_string) => {
    const [qr_string, cr_string, gate_string, option_string] = qemmet_string
        .trim()
        .split(';')
        .map((s) => s.trim().toLowerCase());
    const qubit_count = qr_string === '' ? 1 : +qr_string;
    const bit_count = +cr_string;
    if (Number.isNaN(qubit_count))
        throw new Error('Quantum register is not a number. Must be a number or leave it blank for a quantum register.');
    if (Number.isNaN(bit_count))
        throw new Error('Classical register is not a number. Must be a number or leave it blank for no classical register.');
    if (!gate_string)
        throw new Error('`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`');
    const options = transformOptionString(option_string);
    return { qubit_count, bit_count, gate_string, options };
};
const tokenizeGateString = (gate_string) => {
    const tokenize_regexp = new RegExp(`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\((.*?)\\))*([\\d\\s]*)`, 'g');
    return [...gate_string.matchAll(tokenize_regexp)];
};
const parseRegister = (qubit_count, control_count, gate_register_string) => {
    const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ');
    /*
        After the operation, you will these as an output:
        1. "" -> [""] -> Expand to qubits
        2. "123" -> ["123"] -> Split
        3. " 123" -> ["", "123"] -> Apply to 123
        4. "12 34 56" -> ["12", "34", "56"] -> Apply to 12 34 56
        5. " 12 34 56" -> ["", "12", "34", "56"] -> Apply to 12 34 56
    */
    // Case 1 & 2
    if (gate_register_array.length === 1) {
        // Case 1
        if (gate_register_array[0].length === 0) {
            // if it is a controled gate: fill the registers as much as the gate requires
            if (control_count)
                return new Array(control_count + 1).fill(0).map((_, i) => i + 1);
            // if it's not a controlled gate: fill the gate into all registers
            return new Array(qubit_count).fill(0).map((_, i) => i + 1);
        }
        // Case 2
        return [...gate_register_array[0]].map(Number);
    }
    // Case 3 & 4 & 5
    return gate_register_array.filter(Boolean).map(Number);
};
const parseGateParams = (gate_params) => {
    if (typeof gate_params === 'string') {
        const trimmed_gate_params = gate_params.replace(/ /g, '');
        if (trimmed_gate_params === '')
            return '0';
        return trimmed_gate_params
            .replace(/,,/g, ',0,')
            .replace(/,$/, ',0')
            .replace(/^,/, '0,')
            .replace(/,/g, ', ');
    }
    return '';
};
const parseGateToken = (qubit_count, gate_token) => {
    return gate_token.map(([, control_string, gate_name, gate_params, gate_registers_string]) => {
        const control_count = control_string.length + +(gate_name === 'sw');
        return {
            control_count,
            gate_name,
            gate_params: parseGateParams(gate_params),
            gate_registers: parseRegister(qubit_count, control_count, gate_registers_string),
        };
    });
};
const transformGateRegisters = (gate_info, options) => {
    if (!options.startFromZero)
        return gate_info.map(({ gate_registers, ...gate_info_rest }) => ({
            ...gate_info_rest,
            gate_registers: gate_registers.map((register) => register - 1),
        }));
    return gate_info;
};
const parseQemmetString = (qemmet_string) => {
    const { qubit_count, bit_count, gate_string, options } = parseMetadata(qemmet_string);
    const tokenized_gates = tokenizeGateString(gate_string);
    const raw_gate_info = parseGateToken(qubit_count, tokenized_gates);
    const gate_info = transformGateRegisters(raw_gate_info, options);
    const parsed_qemmet_data = {
        qubit_count,
        bit_count,
        gate_info,
    };
    return {
        ...parsed_qemmet_data,
        toQASMString: () => getQASMString(parsed_qemmet_data),
        toQiskitString: () => getQiskitString(parsed_qemmet_data),
    };
};
const getQASMGateName = (gate_name) => {
    if (gate_name === '/x')
        return 'sx';
    if (gate_name === 'sw')
        return 'swap';
    if (gate_name === 'p')
        return 'phase';
    if (gate_name === 'i')
        return 'id';
    return gate_name;
};
const getQASMString = ({ qubit_count, bit_count, gate_info }) => {
    const qasm_string = gate_info
        .map(({ control_count, gate_name: original_gate_name, gate_params, gate_registers }) => {
        // translate gate name
        const gate_name = getQASMGateName(original_gate_name);
        // special measure instruction
        if (gate_name === 'm')
            return `${gate_registers
                .map((register) => `cr[${register}] = measure qr[${register}]`)
                .join(';\n')};\n`;
        // special barrier instruction
        if (gate_name === 'b')
            return `barrier ${gate_registers.map((register) => `qr[${register}]`).join(', ')};\n`;
        // parameterized gate
        if (gate_params) {
            if (control_count === 0)
                return `${gate_registers
                    .map((register) => `${gate_name}(${gate_params}) qr[${register}]`)
                    .join(';\n')};\n`;
            // controlled gate
            const control_operation_string = control_count === 1 ? 'control @' : `control(${control_count}) @`;
            return `${control_operation_string} ${gate_name}(${gate_params}) ${gate_registers
                .map((register) => `qr[${register}]`)
                .join(', ')};\n`;
        }
        // swap gate
        if (gate_name === 'swap') {
            const control_operation_string = control_count === 1
                ? ''
                : control_count === 2
                    ? 'control @ '
                    : `control(${control_count - 1}) @ `;
            return `${control_operation_string}${gate_name} ${gate_registers
                .map((register) => `qr[${register}]`)
                .join(', ')};\n`;
        }
        // normal gate
        if (control_count === 0)
            return `${gate_registers.map((register) => `${gate_name} qr[${register}]`).join(';\n')};\n`;
        // controlled gate
        const control_operation_string = control_count === 1 ? 'control @' : `control(${control_count}) @`;
        return `${control_operation_string} ${gate_name} ${gate_registers
            .map((register) => `qr[${register}]`)
            .join(', ')};\n`;
    })
        .join('');
    const bit_declaration_string = bit_count > 0 ? `bit[${bit_count}] cr;\n` : '';
    return `OPENQASM 3.0;
include "stdgates.inc";

// You can get \`stdgates.inc\` file from in https://github.com/Qiskit/openqasm

qubit[${qubit_count}] qr;
${bit_declaration_string}
${qasm_string}`;
};
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
export default {
    parseQemmetString,
    getQASMString,
    getQiskitString,
};
// Debug String: 2;2;sdgtdg csdgctdg sx/x csxc/x rx()ry()rz() crx()cry()crz() u1()u2(,)u3(,,) cu1()cu2(,)cu3(,,) sw csw ccsw b xyz cxcycz h ch p() cp() st csct i m
