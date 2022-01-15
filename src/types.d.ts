export interface QemmetStringOptions {
	start_from_one: boolean
	normalize_adjacent_gates: boolean
}

export type ClassicalBitCondition = 0 | 1 | null

export interface QemmetGateInfo {
	control_count: number
	gate_name: string
	gate_params: string
	gate_registers: number[]
	// target bit always = gate_registers for 1-1 matching, `[]` for other gates.
	target_bit: number[]
	// [0] is for equal to 0
	// [1] is for equal to 1
	// [null] is for optional (either 0 or 1 is fine)
	// length equals to bit_count
	condition?: ClassicalBitCondition[]
}

export interface QemmetParserOutput {
	qubit_count: number
	bit_count: number
	gate_info: QemmetGateInfo[]
	definition_string: string
	options: QemmetStringOptions
}
