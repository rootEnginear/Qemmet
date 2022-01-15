const expandMeasurements = (gate_info) => {
    return gate_info
        .map(({ control_count, gate_name, gate_params, gate_registers, target_bit, condition }) => gate_name === 'm'
        ? gate_registers.map((reg, index) => ({
            control_count,
            gate_name,
            gate_params,
            gate_registers: [reg],
            target_bit: [target_bit?.[index] ?? reg],
            condition,
        }))
        : { control_count, gate_name, gate_params, gate_registers, target_bit, condition })
        .flat();
};
const getGateString = (gate_info) => {
    const expanded_gate_info = expandMeasurements(gate_info);
    const processed_qemmet_string = expanded_gate_info
        .map(({ control_count, gate_name, gate_params, gate_registers, target_bit, condition }) => {
        const control_string = 'c'.repeat(control_count);
        const param_string = gate_params ? `[${gate_params}]` : '';
        const measure_target = target_bit.length ? `->${target_bit}` : '';
        const condition_string = condition
            ? `?${condition.map((c) => (c == null ? '.' : c)).join('')}`
            : '';
        return `${control_string}${gate_name}${param_string}${gate_registers.join(' ')}${measure_target}${condition_string}`;
    })
        .join('');
    return processed_qemmet_string;
};
export const translateQemmetString = ({ qubit_count, bit_count, gate_info, }) => {
    const gate_string = getGateString(gate_info);
    return `${qubit_count};${bit_count};${gate_string};;0`;
};
