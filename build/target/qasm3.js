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
export default {
    getQASMString,
};
