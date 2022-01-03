import { QemmetParserOutput, QemmetGateInfo } from '../types'

const getGateString = (gate_info: QemmetGateInfo[]): string => {
	const processed_qemmet_string = gate_info
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
	return `${qubit_count};${bit_count};${gate_string}`
}
