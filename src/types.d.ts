export interface QemmetStringOptions {
	start_from_one: boolean
	normalize_adjacent_gates: boolean
}

export interface QemmetGateInfo {
	control_count: number
	gate_name: string
	gate_params: string
	gate_registers: number[]
	// target bit always = gate_registers for 1-1 matching, `[]` for other gates.
	target_bit: number[]
	// [bit, on equal] | don't have a condition
	// eg: [1, 0] means do when bit 1 == 0
	condition: [number, number] | null
}

export interface QemmetParserOutput {
	qubit_count: number
	bit_count: number
	gate_info: QemmetGateInfo[]
	definition_string: string
	options: QemmetStringOptions
}
