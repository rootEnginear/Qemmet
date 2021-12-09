function getMetadata(qemmet_string) {
	const [quantum_register_string, classical_register_string, raw_gates_string, ..._] =
		qemmet_string.split(';')

	const quantum_register = quantum_register_string.trim() === '' ? 1 : +quantum_register_string
	const classical_register = +classical_register_string

	if (Number.isNaN(quantum_register))
		throw new Error(
			'Quantum register is not a number. Must be a number or leave it blank for a quantum register.'
		)

	if (Number.isNaN(classical_register))
		throw new Error(
			'Classical register is not a number. Must be a number or leave it blank for no classical register.'
		)

	if (!raw_gates_string)
		throw new Error(
			'`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`'
		)

	gates_string = raw_gates_string.trim().toLowerCase()

	return { quantum_register, classical_register, gates_string }
}

function gateStringTokenizer(gates_string) {
	return [...gates_string.matchAll(/(c*?)([zyxhmb])([\d\s]*)/g)]
}

function getRegister(register_string) {
	const normalized_register_string = register_string.trim().replace(/\s+/g, ' ').split(' ')
	if (normalized_register_string.length === 0) return [] // The register will get normalized in `normalizeGateRegisters`
	if (normalized_register_string.length === 1)
		return normalized_register_string[0].split('').map(Number)
	return normalized_register_string.map(Number)
}

function gateTokenParser(gate_token) {
	return gate_token.map(([gate_string, control_string, gate_name, gate_registers]) => ({
		gate_string,
		control_count: control_string.length,
		gate_name,
		gate_registers: getRegister(gate_registers),
	}))
}

function normalizeGateRegisters(quantum_register, control_count, gate_registers) {
	if (gate_registers.length === 0) {
		// if it is a controled gate: fill the registers as much as the gate requires
		if (control_count) {
			return new Array(control_count + 1).fill(0).map((_, i) => i + 1)
		}
		// if it's not a controlled gate: fill the gate into all registers
		return new Array(quantum_register).fill(0).map((_, i) => i + 1)
	}
	// if the qr is specified: return back qr
	return gate_registers
}

function getOpenQASMString(gate_string) {
	const gate_metadata = getMetadata(gate_string)
	const { quantum_register, classical_register, gates_string } = gate_metadata

	const gate_tokens = gateStringTokenizer(gates_string)
	const gate_token_parsed = gateTokenParser(gate_tokens)

	const qasm_string = gate_token_parsed
		.map(({ control_count, gate_name, gate_registers }) => {
			// normalize gate registers
			const gate_registers_normalized = normalizeGateRegisters(
				quantum_register,
				control_count,
				gate_registers
			)

			// decrement gate since for easier to write register i start from 1
			const gate_registers_all = gate_registers_normalized.map((register) => register - 1)

			// check if it's measure gate then it's different instruction
			if (gate_name === 'm') {
				return `${gate_registers_all
					.map((register) => `cr[${register}] = measure qr[${register}]`)
					.join(';\n')};\n`
			}

			// check if it's barrier gate then it's different instruction
			if (gate_name === 'b') {
				return `${gate_registers_all.map((register) => `barrier qr[${register}]`).join(';\n')};\n`
			}

			// normal gate
			if (control_count === 0) {
				return `${gate_registers_all
					.map((register) => `${gate_name} qr[${register}]`)
					.join(';\n')};\n`
			}

			// controlled gate
			const control_operation_string =
				control_count === 1 ? 'control @' : `control(${control_count}) @`

			return `${control_operation_string} ${gate_name} ${gate_registers_all
				.map((register) => `qr[${register}]`)
				.join(', ')};\n`
		})
		.join('')

	const bit_declaration_string = classical_register > 0 ? `bit[${classical_register}] cr;\n` : ''

	return `OPENQASM 3.0;

// From \`stdgates.inc\` in https://github.com/Qiskit/openqasm
gate x a { U(π, 0, π) a; }
gate y a { U(π, π/2, π/2) a; }
gate z a { p(π) a; }
gate h a { U(π/2, 0, π) a; }

qubit[${quantum_register}] qr;
${bit_declaration_string}
${qasm_string}`
}

function getQiskitString(gate_string) {
	const gate_metadata = getMetadata(gate_string)
	const { quantum_register, classical_register, gates_string } = gate_metadata

	const gate_tokens = gateStringTokenizer(gates_string)
	const gate_token_parsed = gateTokenParser(gate_tokens)

	const qiskit_string = gate_token_parsed
		.map(({ control_count, gate_name, gate_registers }) => {
			// normalize gate registers
			const gate_registers_normalized = normalizeGateRegisters(
				quantum_register,
				control_count,
				gate_registers
			)

			// decrement gate since for easier to write register i start from 1
			const gate_registers_all = gate_registers_normalized.map((register) => register - 1)

			// check if it's measure gate then it's different instruction
			if (gate_name === 'm') {
				return `${gate_registers_all
					.map((register) => `qc.measure(${register}, ${register})`)
					.join('\n')}\n`
			}

			// check if it's barrier gate then it's different instruction
			if (gate_name === 'b') {
				return `${gate_registers_all.map((register) => `qc.barrier(${register})`).join('\n')}\n`
			}

			// normal gate
			if (control_count === 0) {
				return `${gate_registers_all
					.map((register) => `qc.${gate_name}(${register})`)
					.join('\n')}\n`
			}

			// controlled gate
			return `qc.append(${gate_name.toUpperCase()}Gate().control(${control_count}), [${gate_registers_all.join(
				', '
			)}])\n`
		})
		.join('')

	return `from qiskit import QuantumCircuit
from qiskit.circuit.library.standard_gates import XGate, YGate, ZGate, HGate

qc = QuantumCircuit(${quantum_register}${classical_register ? `, ${classical_register}` : ''})

${qiskit_string}`
}
