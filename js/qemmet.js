const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstm]', 'g');
const parseMetadata = (qemmet_string) => {
    const [qr_string, cr_string, gate_string] = qemmet_string
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
    return { qubit_count, bit_count, gate_string };
};
const tokenizeGateString = (gate_string) => {
    // (c*?)([st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstm])(?:\((.*?)\))*([\d\s]*)
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
    return gate_params.replace(/ /g, '').replace(/,,/g, ',0,').replace(/,$/, ',0').replace(/^,/, '0,');
};
const normalizeAliasGateName = (gate_name) => {
    if (gate_name === '/x')
        return 'sx';
    return gate_name;
};
const parseGateToken = (qubit_count, gate_token) => {
    return gate_token.map(([, control_string, gate_name, gate_params, gate_registers_string]) => {
        const control_count = control_string.length;
        return {
            control_count,
            gate_name: normalizeAliasGateName(gate_name),
            gate_params: parseGateParams(gate_params ?? ''),
            gate_registers: parseRegister(qubit_count, control_count, gate_registers_string),
        };
    });
};
const parseQemmetString = (qemmet_string) => {
    const { qubit_count, bit_count, gate_string } = parseMetadata(qemmet_string);
    const tokenized_gates = tokenizeGateString(gate_string);
    const gate_info = parseGateToken(qubit_count, tokenized_gates);
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
const getQASMString = ({ qubit_count, bit_count, gate_info }) => {
    const qasm_string = gate_info
        .map(({ control_count, gate_name, gate_registers }) => {
        // decrement gate since for easier to write register i start from 1
        const gate_registers_all = gate_registers.map((register) => register - 1);
        // check if it's measure gate then it's different instruction
        if (gate_name === 'm')
            return `${gate_registers_all
                .map((register) => `cr[${register}] = measure qr[${register}]`)
                .join(';\n')};\n`;
        // check if it's barrier gate then it's different instruction
        if (gate_name === 'b')
            return `${gate_registers_all.map((register) => `barrier qr[${register}]`).join(';\n')};\n`;
        // normal gate
        if (control_count === 0)
            return `${gate_registers_all
                .map((register) => `${gate_name} qr[${register}]`)
                .join(';\n')};\n`;
        // controlled gate
        const control_operation_string = control_count === 1 ? 'control @' : `control(${control_count}) @`;
        return `${control_operation_string} ${gate_name} ${gate_registers_all
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
const getQiskitString = ({ qubit_count, bit_count, gate_info }) => {
    const qiskit_string = gate_info
        .map(({ control_count, gate_name, gate_registers }) => {
        // decrement gate since for easier to write register i start from 1
        const gate_registers_all = gate_registers.map((register) => register - 1);
        // check if it's measure gate then it's different instruction
        if (gate_name === 'm')
            return `${gate_registers_all
                .map((register) => `qc.measure(${register}, ${register})`)
                .join('\n')}\n`;
        // check if it's barrier gate then it's different instruction
        if (gate_name === 'b')
            return `${gate_registers_all.map((register) => `qc.barrier(${register})`).join('\n')}\n`;
        // normal gate
        if (control_count === 0)
            return `${gate_registers_all
                .map((register) => `qc.${gate_name}(${register})`)
                .join('\n')}\n`;
        // controlled gate
        return `qc.append(${gate_name.toUpperCase()}Gate().control(${control_count}), [${gate_registers_all.join(', ')}])\n`;
    })
        .join('');
    return `from qiskit import QuantumCircuit
from qiskit.circuit.library.standard_gates import XGate, YGate, ZGate, HGate

qc = QuantumCircuit(${qubit_count}${bit_count ? `, ${bit_count}` : ''})

${qiskit_string}`;
};
export default {
    parseQemmetString,
    getQASMString,
    getQiskitString,
};
