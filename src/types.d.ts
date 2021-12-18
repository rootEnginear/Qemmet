export interface QemmetStringOptions {
	startFromOne: boolean
}

export interface QemmetGateInfo {
	control_count: number
	gate_name: string
	gate_params: string
	gate_registers: number[]
}

export interface ParsedQemmetData {
	qubit_count: number
	bit_count: number
	expanded_string: string
	gate_info: QemmetGateInfo[]
	definition_string: string
	options: QemmetStringOptions
}

export interface QemmetParserOutput extends ParsedQemmetData {
	toQASMString: () => string
	toQiskitString: () => string
}
