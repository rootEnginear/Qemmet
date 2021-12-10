export type GateInfoType = {
	control_count: number
	gate_name: string
	gate_params: string
	gate_registers: number[]
}

export type ParsedQemmetData = {
	qubit_count: number
	bit_count: number
	gate_info: GateInfoType[]
}

export type ParserOutput = ParsedQemmetData & {
	toQASMString: () => string
	toQiskitString: () => string
}

const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi]', 'g')

const parseMetadata = (qemmet_string: string) => {
	const [qr_string, cr_string, gate_string] = qemmet_string
		.trim()
		.split(';')
		.map((s) => s.trim().toLowerCase())

	const qubit_count = qr_string === '' ? 1 : +qr_string
	const bit_count = +cr_string

	if (Number.isNaN(qubit_count))
		throw new Error(
			'Quantum register is not a number. Must be a number or leave it blank for a quantum register.'
		)

	if (Number.isNaN(bit_count))
		throw new Error(
			'Classical register is not a number. Must be a number or leave it blank for no classical register.'
		)

	if (!gate_string)
		throw new Error(
			'`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`'
		)

	return { qubit_count, bit_count, gate_string }
}

const tokenizeGateString = (gate_string: string) => {
	// (c*?)([st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstm])(?:\((.*?)\))*([\d\s]*)
	const tokenize_regexp = new RegExp(
		`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\((.*?)\\))*([\\d\\s]*)`,
		'g'
	)
	return [...gate_string.matchAll(tokenize_regexp)]
}

const parseRegister = (
	qubit_count: number,
	control_count: number,
	gate_register_string: string
) => {
	const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ')
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
			if (control_count) return new Array(control_count + 1).fill(0).map((_, i) => i + 1)
			// if it's not a controlled gate: fill the gate into all registers
			return new Array(qubit_count).fill(0).map((_, i) => i + 1)
		}
		// Case 2
		return [...gate_register_array[0]].map(Number)
	}
	// Case 3 & 4 & 5
	return gate_register_array.filter(Boolean).map(Number)
}

const parseGateParams = (gate_params: string | undefined) => {
	if (typeof gate_params === 'string') {
		const trimmed_gate_params = gate_params.replace(/ /g, '')
		if (trimmed_gate_params === '') return '0'
		return trimmed_gate_params
			.replace(/,,/g, ',0,')
			.replace(/,$/, ',0')
			.replace(/^,/, '0,')
			.replace(/,/g, ', ')
	}
	return ''
}

const parseGateToken = (qubit_count: number, gate_token: RegExpMatchArray[]): GateInfoType[] => {
	return gate_token.map(([, control_string, gate_name, gate_params, gate_registers_string]) => {
		const control_count = control_string.length + +(gate_name === 'sw')
		return {
			control_count,
			gate_name,
			gate_params: parseGateParams(gate_params),
			gate_registers: parseRegister(qubit_count, control_count, gate_registers_string),
		}
	})
}

const parseQemmetString = (qemmet_string: string): ParserOutput => {
	const { qubit_count, bit_count, gate_string } = parseMetadata(qemmet_string)
	const tokenized_gates = tokenizeGateString(gate_string)
	const gate_info = parseGateToken(qubit_count, tokenized_gates)

	const parsed_qemmet_data: ParsedQemmetData = {
		qubit_count,
		bit_count,
		gate_info,
	}

	return {
		...parsed_qemmet_data,
		toQASMString: () => getQASMString(parsed_qemmet_data),
		toQiskitString: () => getQiskitString(parsed_qemmet_data),
	}
}

const getQASMGateName = (gate_name: string) => {
	if (gate_name === '/x') return 'sx'
	if (gate_name === 'sw') return 'swap'
	if (gate_name === 'p') return 'phase'
	if (gate_name === 'i') return 'id'
	return gate_name
}

const getQASMString = ({ qubit_count, bit_count, gate_info }: ParsedQemmetData) => {
	const qasm_string = gate_info
		.map(({ control_count, gate_name: original_gate_name, gate_params, gate_registers }) => {
			// decrement gate since for easier to write register i start from 1
			const gate_registers_all = gate_registers.map((register) => register - 1)

			// translate gate name
			const gate_name = getQASMGateName(original_gate_name)

			// special measure instruction
			if (gate_name === 'm')
				return `${gate_registers_all
					.map((register) => `cr[${register}] = measure qr[${register}]`)
					.join(';\n')};\n`

			// special barrier instruction
			if (gate_name === 'b')
				return `barrier ${gate_registers_all.map((register) => `qr[${register}]`).join(', ')};\n`

			// parameterized gate
			if (gate_params) {
				if (control_count === 0)
					return `${gate_registers_all
						.map((register) => `${gate_name}(${gate_params}) qr[${register}]`)
						.join(';\n')};\n`

				// controlled gate
				const control_operation_string =
					control_count === 1 ? 'control @' : `control(${control_count}) @`

				return `${control_operation_string} ${gate_name}(${gate_params}) ${gate_registers_all
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

				return `${control_operation_string}${gate_name} ${gate_registers_all
					.map((register) => `qr[${register}]`)
					.join(', ')};\n`
			}

			// normal gate
			if (control_count === 0)
				return `${gate_registers_all
					.map((register) => `${gate_name} qr[${register}]`)
					.join(';\n')};\n`

			// controlled gate
			const control_operation_string =
				control_count === 1 ? 'control @' : `control(${control_count}) @`

			return `${control_operation_string} ${gate_name} ${gate_registers_all
				.map((register) => `qr[${register}]`)
				.join(', ')};\n`
		})
		.join('')

	const bit_declaration_string = bit_count > 0 ? `bit[${bit_count}] cr;\n` : ''

	return `OPENQASM 3.0;
include "stdgates.inc";

// You can get \`stdgates.inc\` file from in https://github.com/Qiskit/openqasm

qubit[${qubit_count}] qr;
${bit_declaration_string}
${qasm_string}`
}

const getQiskitGateName = (gate_name: string) => {
	if (gate_name === '/x') return 'sx'
	if (gate_name === 'sw') return 'swap'
	return gate_name
}

const capitalize = (string: string) => {
	const [first, ...rest] = string
	return first.toUpperCase() + rest.join('')
}

const getQiskitLibGateName = (gate_name: string) => {
	if (gate_name === 'p') return 'Phase'
	if (['sx', 'rx', 'ry', 'rz'].includes(gate_name)) return gate_name.toUpperCase()
	return capitalize(gate_name)
}

const getQiskitString = ({ qubit_count, bit_count, gate_info }: ParsedQemmetData) => {
	const qiskit_string = gate_info
		.map(({ control_count, gate_name: original_gate_name, gate_params, gate_registers }) => {
			// decrement gate since for easier to write register i start from 1
			const gate_registers_all = gate_registers.map((register) => register - 1)

			// translate gate name
			const gate_name = getQiskitGateName(original_gate_name)

			// special measure instruction
			if (gate_name === 'm')
				return `${gate_registers_all
					.map((register) => `qc.measure(${register}, ${register})`)
					.join('\n')}\n`

			// special barrier instruction
			if (gate_name === 'b') return `qc.barrier(${gate_registers_all.join(', ')})\n`

			// parameterized gate
			if (gate_params) {
				if (control_count === 0)
					return `${gate_registers_all
						.map((register) => `qc.${gate_name}(${gate_params}, [${register}])`)
						.join('\n')}\n`

				// controlled gate
				return `qc.append(${getQiskitLibGateName(
					gate_name
				)}Gate(${gate_params}).control(${control_count}), [${gate_registers_all.join(', ')}])\n`
			}

			// swap gate
			if (gate_name === 'swap') {
				if (control_count === 1) return `qc.swap(${gate_registers_all.join(', ')})\n`
				return `qc.append(${getQiskitLibGateName(gate_name)}Gate().control(${
					control_count - 1
				}), [${gate_registers_all.join(', ')}])\n`
			}

			// normal gate
			if (control_count === 0)
				return `${gate_registers_all
					.map((register) => `qc.${gate_name}(${register})`)
					.join('\n')}\n`

			// controlled gate
			return `qc.append(${getQiskitLibGateName(
				gate_name
			)}Gate().control(${control_count}), [${gate_registers_all.join(', ')}])\n`
		})
		.join('')

	return `from qiskit import QuantumCircuit
from qiskit.circuit.library.standard_gates import SdgGate, TdgGate, SXGate, RXGate, RYGate, RZGate, U1Gate, U2Gate, U3Gate, SwapGate, XGate, YGate, ZGate, HGate, PhaseGate, SGate, TGate

qc = QuantumCircuit(${qubit_count}${bit_count ? `, ${bit_count}` : ''})

${qiskit_string}`
}

export default {
	parseQemmetString,
	getQASMString,
	getQiskitString,
}

// Debug String: 2;2;sdgtdg csdgctdg sx/x csxc/x rx()ry()rz() crx()cry()crz() u1()u2(,)u3(,,) cu1()cu2(,)cu3(,,) sw csw ccsw b xyz cxcycz h ch p() cp() st csct i m
