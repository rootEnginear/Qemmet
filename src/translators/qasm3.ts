import { QemmetParserOutput } from '../types'

const getQASMGateName = (gate_name: string) => {
	if (gate_name === '/x') return 'sx'
	if (gate_name === 'sw') return 'swap'
	if (gate_name === 'p') return 'phase'
	if (gate_name === 'i') return 'id'
	return gate_name
}

export const translateQemmetString = ({
	qubit_count,
	bit_count,
	gate_info,
}: QemmetParserOutput) => {
	const qasm_string = gate_info
		.map(
			({
				control_count,
				gate_name: original_gate_name,
				gate_params,
				gate_registers,
				target_bit,
				condition,
			}) => {
				// translate gate name
				const gate_name = getQASMGateName(original_gate_name)

				// measure instruction
				if (gate_name === 'm')
					return gate_registers
						.map((reg, i) => `cr[${target_bit[i] ?? reg}] = measure qr[${reg}];\n`)
						.join('')

				// reset instruction
				if (gate_name === 'r')
					return gate_registers.map((register) => `reset qr[${register}];\n`).join('')

				// barrier instruction
				if (gate_name === 'b')
					return `barrier ${gate_registers.map((register) => `qr[${register}]`).join(', ')};\n`

				// condition string
				const condition_string = condition
					? `if (${condition
							.map((value, bit) => (value == null ? '' : `cr[${bit}] == ${value}`))
							.filter((s) => s)
							.join(' && ')}) `
					: ''

				// parameterized gate
				if (gate_params) {
					if (control_count === 0)
						return `${gate_registers
							.map((register) => `${condition_string}${gate_name}(${gate_params}) qr[${register}]`)
							.join(';\n')};\n`

					// controlled gate
					const control_operation_string =
						control_count === 1 ? 'control @' : `control(${control_count}) @`

					return `${condition_string}${control_operation_string} ${gate_name}(${gate_params}) ${gate_registers
						.map((register) => `qr[${register}]`)
						.join(', ')};\n`
				}

				// swap gate
				if (gate_name === 'swap') {
					const control_operation_string =
						control_count === 1
							? ''
							: control_count === 2
							? 'control @ '
							: `control(${control_count - 1}) @ `

					return `${condition_string}${control_operation_string}${gate_name} ${gate_registers
						.map((register) => `qr[${register}]`)
						.join(', ')};\n`
				}

				// normal gate
				if (control_count === 0)
					return `${gate_registers
						.map((register) => `${condition_string}${gate_name} qr[${register}]`)
						.join(';\n')};\n`

				// controlled gate
				const control_operation_string =
					control_count === 1 ? 'control @' : `control(${control_count}) @`

				return `${condition_string}${control_operation_string} ${gate_name} ${gate_registers
					.map((register) => `qr[${register}]`)
					.join(', ')};\n`
			}
		)
		.join('')

	const bit_declaration_string = bit_count > 0 ? `bit[${bit_count}] cr;\n` : ''

	return `OPENQASM 3.0;
include "stdgates.inc";

// You can get \`stdgates.inc\` file from in https://github.com/Qiskit/openqasm

qubit[${qubit_count}] qr;
${bit_declaration_string}
${qasm_string}`
}
