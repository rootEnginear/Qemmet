const AVAILABLE_GATES_REGEXP = new RegExp('[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi]', 'g');
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
const _pipe = (a, b) => (arg) => b(a(arg));
const pipe = (...ops) => ops.reduce(_pipe);
export const expandStringRepeatSyntax = (repeat_string) => {
    // replace ' with E000 and E000* with E001
    const repl_quo = repeat_string.replace(/'/g, '\uE000').replace(/\uE000\*/g, '\uE001');
    // expand
    const expanded_text = repl_quo.replace(/\uE000([^\uE000\uE001]*?)\uE001(\d+)/g, (_, inner_text, repeat_count) => inner_text.repeat(+repeat_count));
    // rollback
    const final_text = expanded_text.replace(/\uE001/g, '\uE000*').replace(/\uE000/g, "'");
    return final_text !== repeat_string
        ? expandStringRepeatSyntax(final_text)
        : final_text.replace(/'/g, '');
};
const expandCharRepeatSyntax = (repeat_string) => {
    const expanded_text = repeat_string.replace(/(.)\*(\d+)/g, (_, inner_text, repeat_count) => inner_text.repeat(+repeat_count));
    return expanded_text !== repeat_string ? expandStringRepeatSyntax(expanded_text) : expanded_text;
};
const expandRangeSyntax = (range_string) => range_string.replace(/(\d+)-(\d+)/g, (_, start, end) => {
    const max = Math.max(+start, +end);
    const min = Math.min(+start, +end);
    const sorted_range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const range_arr = +start === min ? sorted_range : sorted_range.reverse();
    const range_string = range_arr.join(' ');
    return range_string;
});
const preprocessString = (string) => pipe(expandStringRepeatSyntax, expandCharRepeatSyntax, expandRangeSyntax)(string);
const transformOptionString = (option_string) => {
    if (!option_string)
        return { start_from_one: true };
    const option_array = [...option_string].map(Number);
    return {
        start_from_one: !!option_array[0],
    };
};
const parseMetadata = (qemmet_string) => {
    const preprocessed_qemmet_string = preprocessString(qemmet_string.trim());
    const [qr_string, cr_string, raw_gate_string, definition_string = '', option_string = ''] = preprocessed_qemmet_string.split(';').map((s) => s.trim().toLowerCase());
    const qubit_count = qr_string === '' ? 1 : +qr_string;
    const bit_count = +cr_string;
    if (Number.isNaN(qubit_count))
        throw new Error('Quantum register is not a number. Must be a number or leave it blank for a quantum register.');
    if (Number.isNaN(bit_count))
        throw new Error('Classical register is not a number. Must be a number or leave it blank for no classical register.');
    if (!raw_gate_string)
        throw new Error('`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`');
    const gate_string = substituteDefinition(raw_gate_string, definition_string);
    const options = transformOptionString(option_string);
    return { qubit_count, bit_count, gate_string, definition_string, options };
};
const tokenizeGateString = (gate_string) => [
    ...gate_string.matchAll(new RegExp(`(c*?)(${AVAILABLE_GATES_REGEXP.source})(?:\\[(.*?)\\])*([\\d\\s]*)`, 'g')),
];
const ensureMultipleRegister = (registers, gate_control_length) => {
    // it's fine if it has no controls OR registers length are enough for the controls and the gate
    if (!(gate_control_length - 1) || registers.length === gate_control_length)
        return registers;
    // if the reg is too much, slice off
    if (registers.length > gate_control_length)
        return registers.slice(0, gate_control_length);
    // If not, it need to fill the registers as much as the gate + controls requires
    // first, generate possible reg
    const possible_reg = new Array(gate_control_length).fill(0).map((_, i) => i);
    // then, remove the regs that are already in the reg_arr
    const filled_reg = [...new Set(registers.concat(possible_reg))];
    // finally, trim the excess
    return filled_reg.slice(0, gate_control_length);
};
const parseRegister = (gate_register_string, qubit_count, control_count, options) => {
    const { start_from_one: is_start_from_one } = options;
    const gate_register_array = gate_register_string.trimEnd().replace(/\s+/g, ' ').split(' ');
    const gate_control_length = control_count + 1;
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
            if (control_count)
                return new Array(gate_control_length).fill(0).map((_, i) => i);
            // if it's not a controlled gate: fill the gate into all registers
            return new Array(qubit_count).fill(0).map((_, i) => i);
        }
        // Case 2
        const register_arr = [...gate_register_array[0]].map((n) => (is_start_from_one ? +n - 1 : +n));
        return ensureMultipleRegister(register_arr, gate_control_length);
    }
    // Case 3 & 4 & 5
    const register_arr = gate_register_array
        .filter(Boolean)
        .map((n) => (is_start_from_one ? +n - 1 : +n));
    return ensureMultipleRegister(register_arr, gate_control_length);
};
const parseGateParams = (gate_params) => {
    if (typeof gate_params === 'string') {
        const trimmed_gate_params = gate_params.replace(/\s/g, '');
        if (trimmed_gate_params === '')
            return '0';
        return trimmed_gate_params
            .replace(/,,/g, ',0,')
            .replace(/,$/, ',0')
            .replace(/^,/, '0,')
            .replace(/,/g, ', ');
    }
    return '';
};
const parseGateToken = (gate_token, qubit_count, options) => {
    return gate_token.map(([, control_string, gate_name, gate_params, gate_register_string]) => {
        const control_count = control_string.length + +(gate_name === 'sw');
        return {
            control_count,
            gate_name,
            gate_params: parseGateParams(gate_params),
            gate_registers: parseRegister(gate_register_string, qubit_count, control_count, options),
        };
    });
};
const getMaxRegister = (register_count, gate_info) => gate_info.reduce((max, { gate_registers }) => {
    return Math.max(max, ...gate_registers);
}, register_count - 1) + 1;
const getMaxBitRegister = (bit_count, gate_info) => getMaxRegister(bit_count, gate_info.filter(({ gate_name }) => gate_name === 'm'));
export const parseQemmetString = (qemmet_string) => {
    const { qubit_count: raw_qubit_count, bit_count: raw_bit_count, gate_string, definition_string, options, } = parseMetadata(qemmet_string);
    const gate_token = tokenizeGateString(gate_string);
    const gate_info = parseGateToken(gate_token, raw_qubit_count, options);
    // BitSafe: safe guarding registers so the transpiled circuit won't error.
    const qubit_count = getMaxRegister(raw_qubit_count, gate_info);
    const bit_count = getMaxBitRegister(raw_bit_count, gate_info);
    return {
        qubit_count,
        bit_count,
        gate_info,
        definition_string,
        options,
    };
};
