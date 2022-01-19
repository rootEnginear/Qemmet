export interface QemmetStringOptions {
	start_from_one: boolean
	normalize_adjacent_gates: boolean
}

export type ClassicalBitCondition = 0 | 1 | null

export type QubitIndex = number
export type BitIndex = number
export type GateName = string
export type GateParameter = string

export interface QemmetGateInfo {
	control_count: number
	gate_name: GateName
	gate_params: GateParameter[]
	gate_registers: QubitIndex[]
	// target bit always = gate_registers for 1-1 matching, `[]` for other gates.
	target_bit: BitIndex[]
	// [0] is for equal to 0
	// [1] is for equal to 1
	// [null] is for optional (either 0 or 1 is fine)
	// length equals to bit_count
	condition?: ClassicalBitCondition[]
}

export type QubitCount = number
export type BitCount = number
export type DefinitionString = string

export interface QemmetParserOutput {
	qubit_count: QubitCount
	bit_count: BitCount
	gate_info: QemmetGateInfo[]
	definition_string: DefinitionString
	options: QemmetStringOptions
}

export interface QemmetMetadata {
	qubit_count: QubitCount
	bit_count: BitCount
	gate_string: string
	definition_string: DefinitionString
	options: QemmetStringOptions
}
