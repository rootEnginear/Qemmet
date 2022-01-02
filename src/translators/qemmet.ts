import { QemmetParserOutput, QemmetGateInfo } from '../types'

const normalizeAdjacentGate = (raw_gate_info: QemmetGateInfo[]) => {
	let gate_info = JSON.parse(JSON.stringify(raw_gate_info)) as QemmetGateInfo[]
	let gate_info_len = gate_info.length
	for (let i = 0; i + 1 < gate_info_len; i++) {
		const curr_gate = gate_info[i]
		const next_gate = gate_info[i + 1]
		if (curr_gate.control_count !== next_gate.control_count || curr_gate.control_count !== 0)
			continue
		if (
			curr_gate.gate_name === next_gate.gate_name &&
			curr_gate.gate_params === next_gate.gate_params
		) {
			gate_info[i].gate_registers = curr_gate.gate_registers.concat(next_gate.gate_registers)
			gate_info.splice(i + 1, 1)
			i--
			gate_info_len--
		}
	}
	return gate_info
}

const getGateString = (gate_info: QemmetGateInfo[]): string => {
	const processed_gate_info = normalizeAdjacentGate(gate_info)
	const processed_qemmet_string = processed_gate_info
		.map(({ control_count, gate_name, gate_params, gate_registers }) => {
			const control_string = 'c'.repeat(control_count)
			const param_string = gate_params ? `[${gate_params}]` : ''
			return `${control_string}${gate_name}${param_string}${gate_registers.join(' ')}`
		})
		.join('')
	return processed_qemmet_string
}

export const translateQemmetString = ({
	qubit_count,
	bit_count,
	gate_info,
}: QemmetParserOutput) => {
	const gate_string = getGateString(gate_info)
	return `${qubit_count};${bit_count};${gate_string};;0`
}
