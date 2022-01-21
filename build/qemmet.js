// -----------------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------------
const _pipe = (a, b) => (arg) => b(a(arg));
const pipe = (...ops) => ops.reduce(_pipe);
// -----------------------------------------------------------------------------
// STRING PREPROCESSORS
// -----------------------------------------------------------------------------
export const expandStringRepeatSyntax = (repeat_string) => {
    // replace `'` -> `\uE100` and `\uE100*` -> `\uE101`
    const repl_quo = repeat_string.replace(/'/g, '\uE100').replace(/\uE100\*/g, '\uE101');
    // expand
    const expanded_text = repl_quo.replace(/\uE100([^\uE100\uE101]*?)\uE101(\d+)/g, (_, inner_text, repeat_count) => inner_text.repeat(+repeat_count));
    // rollback
    const final_text = expanded_text.replace(/\uE101/g, '\uE100*').replace(/\uE100/g, "'");
    return final_text !== repeat_string
        ? expandStringRepeatSyntax(final_text)
        : final_text.replace(/'/g, ''); // remove remaining `'`
};
export const expandCharRepeatSyntax = (repeat_string) => {
    const expanded_text = repeat_string.replace(/(.)\*(\d+)/g, (_, inner_text, repeat_count) => inner_text.repeat(+repeat_count));
    return expanded_text !== repeat_string
        ? expandCharRepeatSyntax(expanded_text)
        : expanded_text.replace(/\*/g, ''); // remove remaining `*`
};
export const expandRepeatSyntax = (repeat_string) => pipe(expandStringRepeatSyntax, expandCharRepeatSyntax)(repeat_string);
/**
 * Eg: generateRange(1, 3) -> '1 2 3'
 */
export const generateRangeString = (start, end) => {
    const max = Math.max(start, end);
    const min = Math.min(start, end);
    const sorted_range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const range_arr = start === min ? sorted_range : sorted_range.reverse();
    const range_string = range_arr.join(' ');
    return range_string;
};
export const expandRangeSyntax = (range_string) => {
    const expanded_text = range_string.replace(/(\d+)-(\d+)/g, (_, start, end) => generateRangeString(+start, +end));
    return expanded_text !== range_string
        ? expandRangeSyntax(expanded_text)
        : expanded_text.replace(/-/g, ''); // remove remaining `-`
};
const preprocessString = (string) => {
    // preserve `*` & `-` inside `[...]`
    // `*` -> `\uE000`
    // `-` -> `\uE001`
    // preserve `->` everywhere
    // `->` -> `\uE002`
    const escaped = string
        .replace(/(?:\[(.*?)\])/g, (_, inside) => `[${inside.replace(/\*/g, '\uE000').replace(/-/g, '\uE001')}]`)
        .replace(/->/g, '\uE002');
    // execute syntax
    const expanded = pipe(expandRepeatSyntax, expandRangeSyntax)(escaped);
    // rollback
    // `\uE000` -> `*`
    // `\uE001` -> `-`
    // `\uE002` -> `->`
    return expanded
        .replace(/\uE000/g, '*')
        .replace(/\uE001/g, '-')
        .replace(/\uE002/g, '->');
};
// -----------------------------------------------------------------------------
// DEFINITION SUBSITUTIONS
// -----------------------------------------------------------------------------
const substituteDefinition = (raw_string, definition_string) => {
    const formatted_definition_string = definition_string.trim().replace(/\s+/g, ' ');
    if (formatted_definition_string === '')
        return raw_string;
    const definition = formatted_definition_string
        .split(',')
        .map((def) => def
        .trim()
        .split('=')
        .map((el) => el.trim()))
        .map(([name, meaning]) => ({ name, meaning }));
    const processed_raw_string = definition.reduce((string, { name, meaning }) => string.replace(new RegExp(name, 'g'), meaning), raw_string);
    return processed_raw_string;
};
// -----------------------------------------------------------------------------
// PARSE OPTION STRING
// -----------------------------------------------------------------------------
export const parseOptionString = (option_string) => {
    const formatted_option_string = option_string.padEnd(2, ' ').slice(0, 2);
    const option_array = [...formatted_option_string].map((c) => ['0', '1'].includes(c) ? !!+c : null);
    return {
        start_from_one: option_array[0] ?? true,
        normalize_adjacent_gates: option_array[1] ?? true,
    };
};
// -----------------------------------------------------------------------------
// METADATA PARSER
// -----------------------------------------------------------------------------
const parseMetadata = (qemmet_string) => {
    const preprocessed_qemmet_string = preprocessString(qemmet_string.trim());
    const [a = '', b = '', c = '', d = '', option_string = ''] = preprocessed_qemmet_string
        .toLowerCase()
        .split(';');
    const [qr_string, cr_string, raw_gate_string, definition_string] = [a, b, c, d].map((s) => s?.trim());
    const qubit_count = qr_string === '' ? 1 : +qr_string;
    const bit_count = +cr_string;
    if (Number.isNaN(qubit_count))
        throw new Error('Quantum register is not a number.');
    if (Number.isNaN(bit_count))
        throw new Error('Classical register is not a number.');
    const gate_string = substituteDefinition(raw_gate_string, definition_string);
    const options = parseOptionString(option_string);
    return { qubit_count, bit_count, gate_string, definition_string, options };
};
// -----------------------------------------------------------------------------
// TOKENIZER
// -----------------------------------------------------------------------------
const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[xyzhstpibmr]', 'g');
const tokenizeGateString = (gate_string) => [
    ...gate_string.matchAll(new RegExp(`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\[((?:[\\d\\s,+\\-*/]|pi|euler)*?)\\])?([\\d\\s]*)(?:->(\\d+))?(?:\\?([01.]+))?`, 'g')),
];
// -----------------------------------------------------------------------------
// QUANTUM REGISTER PARSING
// -----------------------------------------------------------------------------
/**
 * Make sure that a controlled gate has a feasible number of quantum registers for the whole gate.
 *
 * Example 1: `cx1` does not have enough quantum registers. We need to fill in the missing quantum registers.
 *
 * Example 2: `cx123` has too much quantum registers. We need to remove the extra quantum registers.
 */
const ensureControlledGateRegisters = (registers, total_gate_length) => {
    // it's fine if
    // - it has no controls *OR*
    // - registers length are enough for the controlled gate
    if (!(total_gate_length - 1) || registers.length === total_gate_length)
        return registers;
    // if the reg is too much, slice off
    if (registers.length > total_gate_length)
        return registers.slice(0, total_gate_length);
    // If not, it need to fill the registers as much as the gate + controls requires
    // first, generate possible reg
    const possible_reg = new Array(total_gate_length).fill(0).map((_, i) => i);
    // then, remove the regs that are already in the reg_arr
    const filled_reg = [...new Set(registers.concat(possible_reg))];
    // finally, trim the excess
    return filled_reg.slice(0, total_gate_length);
};
/**
 * Cases:
 * 1. "" -> [""] -> Expand to qubits
 * 2. "123" -> ["123"] -> Split
 * 3. " 123" -> ["", "123"] -> Apply to 123
 * 4. "12 34 56" -> ["12", "34", "56"] -> Apply to 12 34 56
 * 5. " 12 34 56" -> ["", "12", "34", "56"] -> Apply to 12 34 56
 */
const parseRegister = (gate_register_string, qubit_count, control_count, options) => {
    const { start_from_one: is_start_from_one } = options;
    const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ');
    const total_gate_length = control_count + 1;
    // Case 1 & 2
    if (gate_register_array.length === 1) {
        // Case 1
        if (gate_register_array[0].length === 0) {
            // if it is a controled gate: fill the registers as much as the gate requires
            if (control_count)
                return new Array(total_gate_length).fill(0).map((_, i) => i);
            // if it's not a controlled gate: fill the gate into all registers
            return new Array(qubit_count).fill(0).map((_, i) => i);
        }
        // Case 2
        const register_arr = [...gate_register_array[0]].map((n) => (is_start_from_one ? +n - 1 : +n));
        return ensureControlledGateRegisters(register_arr, total_gate_length);
    }
    // Case 3 & 4 & 5
    const register_arr = gate_register_array
        .filter(Boolean)
        .map((n) => (is_start_from_one ? +n - 1 : +n));
    return ensureControlledGateRegisters(register_arr, total_gate_length);
};
// -----------------------------------------------------------------------------
// PARSE GATE PARAMETERS
// -----------------------------------------------------------------------------
const ensureParameterCount = (params, count) => {
    const params_count = params.length;
    if (params_count > count)
        return params.slice(0, count);
    if (params_count < count)
        return params.concat(new Array(count - params_count).fill('0'));
    return params;
};
const parseGateParams = (gate_name, gate_params) => {
    if (typeof gate_params !== 'string')
        return [];
    let param_count = 0;
    switch (gate_name) {
        case 'p':
        case 'rx':
        case 'ry':
        case 'rz':
        case 'u1':
            param_count = 1;
        case 'u2':
            param_count = 2;
        case 'u3':
            param_count = 3;
            const trimmed_gate_params = gate_params.replace(/\s/g, '');
            const params = trimmed_gate_params
                ? ['0']
                : trimmed_gate_params
                    .replace(/,,/g, ',0,')
                    .replace(/,$/, ',0')
                    .replace(/^,/, '0,')
                    .split(',');
            // params now doesn't have to trim, because it's does not have any spaces
            // all possible `''` between `,` is now not there because of replacing process
            return ensureParameterCount(params, param_count);
    }
    return [];
};
// -----------------------------------------------------------------------------
// PARSE CLASSICAL CONDITION
// -----------------------------------------------------------------------------
const is0or1 = (n) => n === 0 || n === 1;
const parseClassicalCondition = (condition, bit_count) => {
    // condition is [01.]+
    const formatted_condition = condition.padEnd(bit_count, '.').replace(/\.+$/g, '');
    if (!formatted_condition.length)
        return undefined;
    return [...formatted_condition].map((b) => {
        // fun fact: +"." || +"-." will return NaN,
        // but +".0" || +"-.0" will return 0
        const b_num = +b;
        return is0or1(b_num) ? b_num : null;
    });
};
// -----------------------------------------------------------------------------
// PARSE GATE TOKEN
// -----------------------------------------------------------------------------
const INSTRUCTIONS = ['r', 'b', 'm'];
const parseGateToken = (gate_token, qubit_count, bit_count, options) => {
    const structured_data = gate_token.map(([, control_string, gate_name, _gate_params, _gate_registers, _target_bit, _condition]) => {
        // Instruction must not have any controls
        const control_count = INSTRUCTIONS.includes(gate_name)
            ? 0
            : control_string.length + +(gate_name === 'sw');
        // ParamSafe is built in
        const gate_params = parseGateParams(gate_name, _gate_params);
        const gate_registers = parseRegister(_gate_registers, qubit_count, control_count, options);
        const target_bit_num = +_target_bit;
        const target_bit = gate_name === 'm'
            ? isNaN(target_bit_num)
                ? gate_registers
                : new Array(gate_registers.length).fill(target_bit_num - +options.start_from_one)
            : [];
        const condition = _condition
            ? parseClassicalCondition(_condition, bit_count)
            : undefined;
        return {
            control_count,
            gate_name,
            gate_params,
            gate_registers,
            target_bit,
            condition,
        };
    });
    return structured_data;
};
// -----------------------------------------------------------------------------
// NORMALIZE ADJACENT GATE
// -----------------------------------------------------------------------------
export const normalizeAdjacentGate = (raw_gate_info) => {
    let gate_info = JSON.parse(JSON.stringify(raw_gate_info));
    let gate_info_len = gate_info.length;
    for (let i = 0; i + 1 < gate_info_len; i++) {
        const curr_gate = gate_info[i];
        const next_gate = gate_info[i + 1];
        // measure don't collapse
        if (curr_gate.gate_name === 'm' || next_gate.gate_name === 'm')
            continue;
        if (curr_gate.control_count !== next_gate.control_count || curr_gate.control_count !== 0)
            continue;
        if (curr_gate.gate_name === next_gate.gate_name &&
            JSON.stringify(curr_gate.gate_params) === JSON.stringify(next_gate.gate_params) &&
            curr_gate.gate_registers.filter((value) => next_gate.gate_registers.includes(value))
                .length === 0) {
            gate_info[i].gate_registers = curr_gate.gate_registers.concat(next_gate.gate_registers);
            gate_info.splice(i + 1, 1);
            i--;
            gate_info_len--;
        }
    }
    return gate_info;
};
// -----------------------------------------------------------------------------
// BITSAFE
// -----------------------------------------------------------------------------
const bitSafe = (register_count, bit_count, gate_info) => gate_info
    .reduce(([max_qreg, max_clreg], { gate_registers, target_bit, condition }) => {
    return [
        Math.max(max_qreg, ...gate_registers),
        Math.max(max_clreg, ...target_bit, (condition ?? []).length - 1 ?? max_clreg),
    ];
}, [register_count - 1, bit_count - 1])
    .map((value) => value + 1);
// -----------------------------------------------------------------------------
// PARSE QEMMET STRING
// -----------------------------------------------------------------------------
export const parseQemmetString = (qemmet_string) => {
    const { qubit_count: raw_qubit_count, bit_count: raw_bit_count, gate_string, definition_string, options, } = parseMetadata(qemmet_string);
    const gate_token = tokenizeGateString(gate_string);
    const raw_gate_info = parseGateToken(gate_token, raw_qubit_count, raw_bit_count, options);
    // Normalize Adjacent Gate
    const gate_info = options.normalize_adjacent_gates
        ? normalizeAdjacentGate(raw_gate_info)
        : raw_gate_info;
    // BitSafe
    const [qubit_count, bit_count] = bitSafe(raw_qubit_count, raw_bit_count, gate_info);
    return {
        qubit_count,
        bit_count,
        gate_info,
        definition_string,
        options,
    };
};
