import { QemmetGateInfo, QemmetParserOutput, QemmetStringOptions } from './types'

// Utils
const _pipe = (a: (fn_arg: any) => any, b: (fn_arg: any) => any) => (arg: any) => b(a(arg))
export const pipe = (...ops: ((fn_arg: any) => any)[]) => ops.reduce(_pipe)

// Parser
const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi]', 'g')

const substituteDefinition = (raw_string: string, definition_string: string) => {
	const formatted_definition_string = definition_string.trim().replace(/\s+/g, ' ')
	if (formatted_definition_string === '') return raw_string
	const definition = formatted_definition_string
		.split(',')
		.map((def) =>
			def
				.trim()
				.split('=')
				.map((el) => el.trim())
		)
		.map(([name, meaning]) => ({ name, meaning }))
	const processed_raw_string = definition.reduce(
		(string, { name, meaning }) => string.replace(new RegExp(name, 'g'), meaning),
		raw_string
	)
	return processed_raw_string
}

export const expandStringRepeatSyntax = (repeat_string: string): string => {
	// replace ' with E000 and E000* with E001
	const repl_quo = repeat_string.replace(/'/g, '\uE000').replace(/\uE000\*/g, '\uE001')
	// expand
	const expanded_text = repl_quo.replace(
		/\uE000([^\uE000\uE001]*?)\uE001(\d+)/g,
		(_, inner_text, repeat_count) => inner_text.repeat(+repeat_count)
	)
	// rollback
	const final_text = expanded_text.replace(/\uE001/g, '\uE000*').replace(/\uE000/g, "'")
	return final_text !== repeat_string
		? expandStringRepeatSyntax(final_text)
		: final_text.replace(/'/g, '')
}

export const expandCharRepeatSyntax = (repeat_string: string): string => {
	const expanded_text = repeat_string.replace(/(.)\*(\d+)/g, (_, inner_text, repeat_count) =>
		inner_text.repeat(+repeat_count)
	)
	return expanded_text !== repeat_string
		? expandCharRepeatSyntax(expanded_text)
		: expanded_text.replace(/\*/g, '')
}

export const expandRepeatSyntax = (repeat_string: string): string => {
	// preserve `*` inside `[...]`
	const escaped_asterisk = repeat_string.replace(
		/(?:\[(.*?)\])/g,
		(_, inside) => `[${inside.replace(/\*/g, '\uE002')}]`
	)
	// execute syntax
	const expanded_repeat_string = pipe(
		expandStringRepeatSyntax,
		expandCharRepeatSyntax
	)(escaped_asterisk)
	// rollback `*`
	return expanded_repeat_string.replace(/\uE002/g, '*')
}

export const generateRange = (start: string, end: string) => {
	const max = Math.max(+start, +end)
	const min = Math.min(+start, +end)
	const sorted_range = Array.from({ length: max - min + 1 }, (_, i) => min + i)
	const range_arr = +start === min ? sorted_range : sorted_range.reverse()
	const range_string = range_arr.join(' ')
	return range_string
}

export const expandRangeSyntax = (range_string: string): string => {
	const expanded_text = range_string.replace(/(\d+)-(\d+)/g, (_, start, end) =>
		generateRange(start, end)
	)
	return expanded_text !== range_string ? expandRangeSyntax(expanded_text) : expanded_text
}

const expandMeasureArrowSyntax = (qemmet_string: string): string =>
	qemmet_string
		.replace(/m([\d\s]*?)->(\d+)/g, (_, qubits, bit) => `m[${bit}]${qubits}`)
		.replace(/-/g, '')
		.replace(/>/g, '')

const preprocessString = (string: string): string =>
	pipe(expandRepeatSyntax, expandRangeSyntax, expandMeasureArrowSyntax)(string)

export const transformOptionString = (option_string: string): QemmetStringOptions => {
	const formatted_option_string = option_string.padEnd(2, ' ').slice(0, 2)
	const option_array = [...formatted_option_string].map((c) =>
		['0', '1'].includes(c) ? !!+c : null
	)

	return {
		start_from_one: option_array[0] ?? true,
		normalize_adjacent_gates: option_array[1] ?? true,
	}
}

const parseMetadata = (qemmet_string: string) => {
	const preprocessed_qemmet_string = preprocessString(qemmet_string.trim())

	const [a, b, c, d = '', option_string = ''] = preprocessed_qemmet_string.toLowerCase().split(';')

	const [qr_string, cr_string, raw_gate_string, definition_string] = [a, b, c, d].map((s) =>
		s?.trim()
	)

	const qubit_count = qr_string === '' ? 1 : +qr_string
	const bit_count = +cr_string

	if (Number.isNaN(qubit_count)) throw new Error('Quantum register is not a number.')

	if (Number.isNaN(bit_count)) throw new Error('Classical register is not a number.')

	if (!raw_gate_string)
		throw new Error('`gates_string` part does not found. Required at least 1 gate.')

	const gate_string = substituteDefinition(raw_gate_string, definition_string)

	const options = transformOptionString(option_string)

	return { qubit_count, bit_count, gate_string, definition_string, options }
}

const tokenizeGateString = (gate_string: string) => [
	...gate_string.matchAll(
		new RegExp(
			`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\[((?:[\\d\\s,+\\-*/]|pi|euler)*?)\\])*([\\d\\s]*)`,
			'g'
		)
	),
]

const ensureMultipleRegister = (registers: number[], gate_control_length: number) => {
	// it's fine if it has no controls OR registers length are enough for the controls and the gate
	if (!(gate_control_length - 1) || registers.length === gate_control_length) return registers
	// if the reg is too much, slice off
	if (registers.length > gate_control_length) return registers.slice(0, gate_control_length)
	// If not, it need to fill the registers as much as the gate + controls requires
	// first, generate possible reg
	const possible_reg = new Array(gate_control_length).fill(0).map((_, i) => i)
	// then, remove the regs that are already in the reg_arr
	const filled_reg = [...new Set(registers.concat(possible_reg))]
	// finally, trim the excess
	return filled_reg.slice(0, gate_control_length)
}

const formatParameter = (params: string[], count: number): string[] => {
	const fill_empty_str = params.map((p) => (p.trim() === '' ? '0' : p))
	const params_count = fill_empty_str.length

	if (params_count > count) return fill_empty_str.slice(0, count)
	if (params_count < count) return fill_empty_str.concat(new Array(count - params_count).fill('0'))
	return fill_empty_str
}

export const ensureParameterizedGate = (gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	return gate_info.map(({ gate_name, gate_params, ...rest }) => {
		const params_arr = gate_params.split(',')
		let formatted_params: string[] = []

		switch (gate_name) {
			case 'm':
			case 'p':
			case 'rx':
			case 'ry':
			case 'rz':
			case 'u1':
				formatted_params = formatParameter(params_arr, 1)
				break
			case 'u2':
				formatted_params = formatParameter(params_arr, 2)
				break
			case 'u3':
				formatted_params = formatParameter(params_arr, 3)
				break
			// If it's not a parameterized gate, it will remove any params attached
		}

		return {
			...rest,
			gate_name,
			gate_params: formatted_params.join(', '),
		}
	})
}

// instructions should not have any controls
export const ensureInstruction = (gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	return gate_info.map(({ gate_name, control_count, ...rest }) => {
		switch (gate_name) {
			case 'b':
			case 'm':
				return {
					...rest,
					gate_name,
					control_count: 0,
				}
		}

		return {
			...rest,
			gate_name,
			control_count,
		}
	})
}

const failsafePipeline = (gate_info: QemmetGateInfo[]) =>
	pipe(ensureParameterizedGate, ensureInstruction)(gate_info)

const parseRegister = (
	gate_register_string: string,
	qubit_count: number,
	control_count: number,
	options: QemmetStringOptions
) => {
	const { start_from_one: is_start_from_one } = options
	const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ')
	const gate_control_length = control_count + 1
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
			if (control_count) return new Array(gate_control_length).fill(0).map((_, i) => i)
			// if it's not a controlled gate: fill the gate into all registers
			return new Array(qubit_count).fill(0).map((_, i) => i)
		}
		// Case 2
		const register_arr = [...gate_register_array[0]].map((n) => (is_start_from_one ? +n - 1 : +n))
		return ensureMultipleRegister(register_arr, gate_control_length)
	}
	// Case 3 & 4 & 5
	const register_arr = gate_register_array
		.filter(Boolean)
		.map((n) => (is_start_from_one ? +n - 1 : +n))
	return ensureMultipleRegister(register_arr, gate_control_length)
}

const parseGateParams = (gate_params: string | undefined) => {
	if (typeof gate_params === 'string') {
		const trimmed_gate_params = gate_params.replace(/\s/g, '')
		if (trimmed_gate_params === '') return '0'
		return trimmed_gate_params.replace(/,,/g, ',0,').replace(/,$/, ',0').replace(/^,/, '0,')
	}
	return ''
}

const formatMeasureParam = (measure_params: string, register: number) => {
	if (!measure_params) return `${register}`
	const shifted_params = +measure_params.split(',')[0] - 1
	return `${shifted_params < 1 ? 0 : shifted_params}`
}

const formatMeasure = (gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	return gate_info
		.map(({ control_count, gate_name, gate_params, gate_registers }) =>
			gate_name === 'm'
				? gate_registers.map((reg) => ({
						control_count,
						gate_name,
						gate_params: formatMeasureParam(gate_params, reg),
						gate_registers: [reg],
				  }))
				: { control_count, gate_name, gate_params, gate_registers }
		)
		.flat()
}

const parseGateToken = (
	gate_token: RegExpMatchArray[],
	qubit_count: number,
	options: QemmetStringOptions
): QemmetGateInfo[] => {
	const structured_data = gate_token.map(
		([, control_string, gate_name, gate_params, gate_register_string]) => {
			const control_count = control_string.length + +(gate_name === 'sw')
			return {
				control_count,
				gate_name,
				gate_params: parseGateParams(gate_params),
				gate_registers: parseRegister(gate_register_string, qubit_count, control_count, options),
			}
		}
	)

	return formatMeasure(structured_data)
}

const getMaxRegister = (register_count: number, gate_info: QemmetGateInfo[]) =>
	gate_info.reduce((max, { gate_registers }) => {
		return Math.max(max, ...gate_registers)
	}, register_count - 1) + 1

const getMaxBitRegister = (bit_count: number, gate_info: QemmetGateInfo[]) =>
	gate_info.reduce((max, { gate_params }) => {
		return Math.max(max, +gate_params)
	}, bit_count - 1) + 1

export const normalizeAdjacentGate = (raw_gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	let gate_info = JSON.parse(JSON.stringify(raw_gate_info)) as QemmetGateInfo[]
	let gate_info_len = gate_info.length

	for (let i = 0; i + 1 < gate_info_len; i++) {
		const curr_gate = gate_info[i]
		const next_gate = gate_info[i + 1]

		// measure don't collapse
		if (curr_gate.gate_name === 'm' || next_gate.gate_name === 'm') continue

		if (curr_gate.control_count !== next_gate.control_count || curr_gate.control_count !== 0)
			continue

		if (
			curr_gate.gate_name === next_gate.gate_name &&
			curr_gate.gate_params === next_gate.gate_params &&
			curr_gate.gate_registers.filter((value) => next_gate.gate_registers.includes(value))
				.length === 0
		) {
			gate_info[i].gate_registers = curr_gate.gate_registers.concat(next_gate.gate_registers)
			gate_info.splice(i + 1, 1)
			i--
			gate_info_len--
		}
	}

	return gate_info
}

export const parseQemmetString = (qemmet_string: string): QemmetParserOutput => {
	const {
		qubit_count: raw_qubit_count,
		bit_count: raw_bit_count,
		gate_string,
		definition_string,
		options,
	} = parseMetadata(qemmet_string)
	const gate_token = tokenizeGateString(gate_string)
	const raw_gate_info = parseGateToken(gate_token, raw_qubit_count, options)

	// Failsafe
	const safe_gate_info = failsafePipeline(raw_gate_info)

	// Normalize Adjacent Gate
	const gate_info = options.normalize_adjacent_gates
		? normalizeAdjacentGate(safe_gate_info)
		: safe_gate_info

	// BitSafe
	const qubit_count = getMaxRegister(raw_qubit_count, gate_info)
	const bit_count = getMaxBitRegister(raw_bit_count, gate_info)

	return {
		qubit_count,
		bit_count,
		gate_info,
		definition_string,
		options,
	}
}
