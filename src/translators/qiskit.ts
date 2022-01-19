import { QemmetGateInfo, QemmetParserOutput } from '../types'

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

const generateConditionPermutation = (
	condition: Exclude<QemmetGateInfo['condition'], undefined>
): QemmetGateInfo['condition'][] => {
	let permutation: Exclude<QemmetGateInfo['condition'], undefined>[] = []
	condition.forEach((c, i) => {
		if (c == null) {
			if (i === 0) {
				permutation = [[0], [1]]
				return
			} // continue
			permutation = [...permutation.map((p) => p.concat(0)), ...permutation.map((p) => p.concat(1))]
		} else {
			if (i === 0) {
				permutation = [[c]]
				return
			} // continue
			permutation = [...permutation.map((p) => p.concat(c))]
		}
	})
	return permutation
}

const expandClassicalConditions = (
	gate_info: QemmetGateInfo[],
	bit_count: number
): QemmetGateInfo[] => {
	return gate_info
		.map(({ condition, ...rest }) => {
			if (condition) {
				const filled_condition = new Array(bit_count).fill(null).map((_, i) => condition[i])
				return generateConditionPermutation(filled_condition).map((new_condition) => ({
					...rest,
					condition: new_condition,
				}))
			}
			return { ...rest, condition }
		})
		.flat()
}

export const translateQemmetString = ({
	qubit_count,
	bit_count,
	gate_info,
}: QemmetParserOutput) => {
	const expanded_gate_info = expandClassicalConditions(gate_info, bit_count)

	const qiskit_string = expanded_gate_info
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
				const gate_name = getQiskitGateName(original_gate_name)

				// measure instruction
				if (gate_name === 'm')
					return gate_registers
						.map((reg, i) => `qc.measure(${reg}, ${target_bit[i] ?? reg})\n`)
						.join('')

				// reset instruction
				if (gate_name === 'r')
					return `${gate_registers.map((register) => `qc.reset(${register})`).join('\n')}\n`

				// barrier instruction
				if (gate_name === 'b') return `qc.barrier(${gate_registers.join(', ')})\n`

				// condition string
				const condition_string = condition
					? `.c_if(cr, ${parseInt(condition.reverse().join(''), 2)})`
					: ''

				// parameterized gate
				if (gate_params.length) {
					const formatted_params = gate_params.join(', ')

					if (control_count === 0)
						return `${gate_registers
							.map(
								(register) => `qc.${gate_name}(${formatted_params}, ${register})${condition_string}`
							)
							.join('\n')}\n`

					// controlled gate
					return `qc.append(${getQiskitLibGateName(
						gate_name
					)}Gate(${formatted_params}).control(${control_count}), [${gate_registers.join(
						', '
					)}])${condition_string}\n`
				}

				// swap gate
				if (gate_name === 'swap') {
					if (control_count === 1)
						return `qc.swap(${gate_registers.join(', ')})${condition_string}\n`
					return `qc.append(${getQiskitLibGateName(gate_name)}Gate().control(${
						control_count - 1
					}), [${gate_registers.join(', ')}])${condition_string}\n`
				}

				// normal gate
				if (control_count === 0)
					return `${gate_registers
						.map((register) => `qc.${gate_name}(${register})${condition_string}`)
						.join('\n')}\n`

				// controlled gate
				return `qc.append(${getQiskitLibGateName(
					gate_name
				)}Gate().control(${control_count}), [${gate_registers.join(', ')}])${condition_string}\n`
			}
		)
		.join('')

	return `from numpy import pi, e as euler
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit.circuit.library.standard_gates import SdgGate, TdgGate, SXGate, RXGate, RYGate, RZGate, U1Gate, U2Gate, U3Gate, SwapGate, XGate, YGate, ZGate, HGate, PhaseGate, SGate, TGate

qr = QuantumRegister(${qubit_count})
cr = ClassicalRegister(${bit_count})
qc = QuantumCircuit(qr, cr)

${qiskit_string}`
}
