export interface QemmetStringOptions {
	startFromOne: boolean
}

export interface GateInfoType {
	control_count: number
	gate_name: string
	gate_params: string
	gate_registers: number[]
}

export interface ParsedQemmetData {
	qubit_count: number
	bit_count: number
	gate_info: GateInfoType[]
}

export interface ParserOutput extends ParsedQemmetData {
	toQASMString: () => string
	toQiskitString: () => string
}

const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi]', 'g')

// Expand repeat syntax
// Examples:
// - "(x)*3" -> "xxx"
// - "((x)*2)*3" -> "xxxxxx"
// - "((x)*2y)*3" -> "xxyxxyxxy"
const expandRepeatSyntax = (repeat_string: string): string => {
	const expanded_text = repeat_string.replace(
		/\(([^()]+?)\)\*(\d+)/g,
		(_, inner_text, repeat_count) => inner_text.repeat(+repeat_count)
	)
	return expanded_text !== repeat_string ? expandRepeatSyntax(expanded_text) : expanded_text
}

const transformOptionString = (option_string: string | undefined): QemmetStringOptions => {
	if (!option_string) return { startFromOne: true }
	const option_array = [...option_string].map(Number)
	return {
		startFromOne: !!option_array[0],
	}
}

const parseMetadata = (qemmet_string: string) => {
	const [qr_string, cr_string, raw_gate_string, option_string] = qemmet_string
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

	if (!raw_gate_string)
		throw new Error(
			'`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`'
		)

	const gate_string = expandRepeatSyntax(raw_gate_string)

	const options = transformOptionString(option_string)

	return { qubit_count, bit_count, gate_string, options }
}

const tokenizeGateString = (gate_string: string) => {
	const tokenize_regexp = new RegExp(
		`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\((.*?)\\))*([\\d\\s]*)`,
		'g'
	)
	return [...gate_string.matchAll(tokenize_regexp)]
}

const parseRegister = (
	gate_register_string: string,
	qubit_count: number,
	control_count: number,
	options: QemmetStringOptions
) => {
	const { startFromOne: isStartFromOne } = options
	const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ')
	/*
		Cases:
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
			if (control_count) return new Array(control_count + 1).fill(0).map((_, i) => i)
			// if it's not a controlled gate: fill the gate into all registers
			return new Array(qubit_count).fill(0).map((_, i) => i)
		}
		// Case 2
		return [...gate_register_array[0]].map((n) => (isStartFromOne ? +n - 1 : +n))
	}
	// Case 3 & 4 & 5
	return gate_register_array.filter(Boolean).map((n) => (isStartFromOne ? +n - 1 : +n))
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

const parseGateToken = (
	gate_token: RegExpMatchArray[],
	qubit_count: number,
	options: QemmetStringOptions
): GateInfoType[] => {
	return gate_token.map(([, control_string, gate_name, gate_params, gate_register_string]) => {
		const control_count = control_string.length + +(gate_name === 'sw')
		return {
			control_count,
			gate_name,
			gate_params: parseGateParams(gate_params),
			gate_registers: parseRegister(gate_register_string, qubit_count, control_count, options),
		}
	})
}

const parseQemmetString = (qemmet_string: string): ParserOutput => {
	const { qubit_count, bit_count, gate_string, options } = parseMetadata(qemmet_string)
	const gate_token = tokenizeGateString(gate_string)
	const gate_info = parseGateToken(gate_token, qubit_count, options)

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
			// translate gate name
			const gate_name = getQASMGateName(original_gate_name)

			// special measure instruction
			if (gate_name === 'm')
				return `${gate_registers
					.map((register) => `cr[${register}] = measure qr[${register}]`)
					.join(';\n')};\n`

			// special barrier instruction
			if (gate_name === 'b')
				return `barrier ${gate_registers.map((register) => `qr[${register}]`).join(', ')};\n`

			// parameterized gate
			if (gate_params) {
				if (control_count === 0)
					return `${gate_registers
						.map((register) => `${gate_name}(${gate_params}) qr[${register}]`)
						.join(';\n')};\n`

				// controlled gate
				const control_operation_string =
					control_count === 1 ? 'control @' : `control(${control_count}) @`

				return `${control_operation_string} ${gate_name}(${gate_params}) ${gate_registers
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

				return `${control_operation_string}${gate_name} ${gate_registers
					.map((register) => `qr[${register}]`)
					.join(', ')};\n`
			}

			// normal gate
			if (control_count === 0)
				return `${gate_registers.map((register) => `${gate_name} qr[${register}]`).join(';\n')};\n`

			// controlled gate
			const control_operation_string =
				control_count === 1 ? 'control @' : `control(${control_count}) @`

			return `${control_operation_string} ${gate_name} ${gate_registers
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
			// translate gate name
			const gate_name = getQiskitGateName(original_gate_name)

			// special measure instruction
			if (gate_name === 'm')
				return `${gate_registers
					.map((register) => `qc.measure(${register}, ${register})`)
					.join('\n')}\n`

			// special barrier instruction
			if (gate_name === 'b') return `qc.barrier(${gate_registers.join(', ')})\n`

			// parameterized gate
			if (gate_params) {
				if (control_count === 0)
					return `${gate_registers
						.map((register) => `qc.${gate_name}(${gate_params}, [${register}])`)
						.join('\n')}\n`

				// controlled gate
				return `qc.append(${getQiskitLibGateName(
					gate_name
				)}Gate(${gate_params}).control(${control_count}), [${gate_registers.join(', ')}])\n`
			}

			// swap gate
			if (gate_name === 'swap') {
				if (control_count === 1) return `qc.swap(${gate_registers.join(', ')})\n`
				return `qc.append(${getQiskitLibGateName(gate_name)}Gate().control(${
					control_count - 1
				}), [${gate_registers.join(', ')}])\n`
			}

			// normal gate
			if (control_count === 0)
				return `${gate_registers.map((register) => `qc.${gate_name}(${register})`).join('\n')}\n`

			// controlled gate
			return `qc.append(${getQiskitLibGateName(
				gate_name
			)}Gate().control(${control_count}), [${gate_registers.join(', ')}])\n`
		})
		.join('')

	return `from numpy import pi, e as euler
from qiskit import QuantumCircuit
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
