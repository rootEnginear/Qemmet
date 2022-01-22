const DEFAULT_OPTIONS = Object.freeze({
    X_MARGIN: 8,
    Y_MARGIN: 16,
    KET_MARGIN: 4,
    LINE_TRAIL_LEFT: 12,
    LINE_TRAIL_RIGHT: 12,
    LINE_SPACE: 3,
    SVG_MARGIN: 8,
    BACKGROUND_COLOR: '#fff',
    LINE_COLOR: '#222',
    FONT_COLOR: '#222',
    GATE_BACKGROUND_COLOR: '#fff',
});
const RENDER_STYLE = Object.seal({
    // Strict Constant
    get GATE_SIZE() {
        return 32;
    },
    // Adjustable Constants
    ...DEFAULT_OPTIONS,
    // Computed Constants
    get HALF_GATE() {
        return this.GATE_SIZE / 2;
    },
    get HORZ_BOX() {
        return this.GATE_SIZE + this.X_MARGIN;
    },
    get VERT_BOX() {
        return this.GATE_SIZE + this.Y_MARGIN;
    },
    get HALF_LINE_SPACE() {
        return this.LINE_SPACE / 2;
    },
});
const generateQubits = (qubit_count, depth) => {
    return new Array(qubit_count)
        .fill('')
        .map((_, i) => {
        const text_x = RENDER_STYLE.HALF_GATE;
        const text_y = i * RENDER_STYLE.VERT_BOX + RENDER_STYLE.HALF_GATE;
        const line_x_start = RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN - RENDER_STYLE.LINE_TRAIL_LEFT;
        const line_x_end = depth * RENDER_STYLE.HORZ_BOX +
            RENDER_STYLE.GATE_SIZE +
            RENDER_STYLE.KET_MARGIN +
            RENDER_STYLE.LINE_TRAIL_RIGHT;
        const text = `<text x="${text_x}" y="${text_y}" dominant-baseline="middle" text-anchor="middle">q<tspan dy="7" dx="1" font-size=".7em">${i}</tspan></text>`;
        const line = `<line x1="${line_x_start}" y1="${text_y}" x2="${line_x_end}" y2="${text_y}" stroke="var(--line-color)" stroke-width="1" />`;
        return text + line;
    })
        .join('');
};
const generateBits = (bit_count, qubit_count, depth) => {
    return new Array(bit_count)
        .fill('')
        .map((_, i) => {
        const text_x = RENDER_STYLE.HALF_GATE;
        const y_base = (i + qubit_count) * RENDER_STYLE.VERT_BOX + RENDER_STYLE.HALF_GATE;
        const y_up = y_base - RENDER_STYLE.HALF_LINE_SPACE;
        const y_down = y_base + RENDER_STYLE.HALF_LINE_SPACE;
        const x_start = RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN - RENDER_STYLE.LINE_TRAIL_LEFT;
        const x_end = (depth + 1) * RENDER_STYLE.HORZ_BOX + RENDER_STYLE.LINE_TRAIL_RIGHT;
        const text = `<text x="${text_x}" y="${y_base}" dominant-baseline="middle" text-anchor="middle">c<tspan dy="7" dx="1" font-size=".7em">${i}</tspan></text>`;
        const line = `<line x1="${x_start}" y1="${y_up}" x2="${x_end}" y2="${y_up}" stroke="var(--line-color)" stroke-width="1" /><line x1="${x_start}" y1="${y_down}" x2="${x_end}" y2="${y_down}" stroke="var(--line-color)" stroke-width="1" />`;
        return text + line;
    })
        .join('');
};
const generateMeasure = (qubit, bit, qubit_count, column) => {
    const gate_x = (column + 1) * RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN;
    const gate_y = qubit * RENDER_STYLE.VERT_BOX;
    const line_x_base = gate_x + RENDER_STYLE.HALF_GATE;
    const line_x_left = line_x_base - RENDER_STYLE.HALF_LINE_SPACE;
    const line_x_right = line_x_base + RENDER_STYLE.HALF_LINE_SPACE;
    const line_y_top = gate_y + RENDER_STYLE.HALF_GATE;
    const line_y_bottom = (qubit_count + bit) * RENDER_STYLE.VERT_BOX +
        RENDER_STYLE.HALF_GATE -
        RENDER_STYLE.HALF_LINE_SPACE -
        8; // -8 -> arrow height
    const arrow_x = line_x_base - 5; // -5 -> half arrow width
    return `<line x1="${line_x_left}" y1="${line_y_top}" x2="${line_x_left}" y2="${line_y_bottom}" stroke="var(--line-color)" stroke-width="1" /><line x1="${line_x_right}" y1="${line_y_top}" x2="${line_x_right}" y2="${line_y_bottom}" stroke="var(--line-color)" stroke-width="1" /><use href="#arrow" x="${arrow_x}" y="${line_y_bottom}" width="10" height="8"></use><use href="#measure" x="${gate_x}" y="${gate_y}" width="32" height="32"></use>`;
};
const generateGate = (gate_name, gate_params) => {
    return (qubit, column) => {
        const gate_x = (column + 1) * RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN;
        const gate_y = qubit * RENDER_STYLE.VERT_BOX;
        switch (gate_name) {
            case 'sw':
            case 'sdg':
            case 'tdg':
                return `<use href="#${gate_name}" x="${gate_x}" y="${gate_y}" width="32" height="32"></use>`;
            case '/x':
            case 'sx':
                return `<use href="#sx" x="${gate_x}" y="${gate_y}" width="32" height="32"></use>`;
            case 'r':
                return `<use href="#reset" x="${gate_x}" y="${gate_y}" width="32" height="32"></use>`;
        }
        const text_x = gate_x + RENDER_STYLE.HALF_GATE;
        const text_y = gate_y + RENDER_STYLE.HALF_GATE + 2; // +2 -> center capital letter
        const param_y = gate_y + RENDER_STYLE.GATE_SIZE + RENDER_STYLE.Y_MARGIN / 2;
        const formatted_params = gate_params
            .join(',')
            .replace(/pi/g, 'π')
            .replace(/euler/g, 'e')
            .replace(/\*/g, '');
        const params_str = formatted_params
            ? `<text class="params" x="${text_x}" y="${param_y}" dominant-baseline="middle" text-anchor="middle" stroke-width="3">(${formatted_params})</text><text class="params" x="${text_x}" y="${param_y}" dominant-baseline="middle" text-anchor="middle">(${formatted_params})</text>`
            : '';
        const formatted_gate_name = gate_name.toLocaleUpperCase();
        // No param
        // text_x - 1 -> center slant
        return (`<use href="#gate" x="${gate_x}" y="${gate_y}" width="32" height="32"></use><text x="${text_x - 1}" y="${text_y}" dominant-baseline="middle" text-anchor="middle">${formatted_gate_name}</text>` +
            params_str);
    };
};
const generateGateCol = (gate_name, gate_registers, gate_params, column) => {
    const gateGenerator = generateGate(gate_name, gate_params);
    return new Array(gate_registers.length)
        .fill('')
        .map((_, i) => {
        return gateGenerator(gate_registers[i], column);
    })
        .join('');
};
const generateVerticalLine = (qubits, column, options = {}) => {
    const default_options = Object.seal({ is_barrier: false, x_shift: 0 });
    const applied_options = Object.assign(default_options, options);
    const max = Math.max(...qubits);
    const min = Math.min(...qubits);
    const barrier_modifier = +applied_options.is_barrier * (RENDER_STYLE.HALF_GATE - 1);
    const x = (column + 1) * RENDER_STYLE.HORZ_BOX +
        RENDER_STYLE.KET_MARGIN +
        RENDER_STYLE.HALF_GATE +
        applied_options.x_shift;
    const y1 = min * RENDER_STYLE.VERT_BOX + RENDER_STYLE.HALF_GATE - barrier_modifier;
    const y2 = max * RENDER_STYLE.VERT_BOX + RENDER_STYLE.HALF_GATE + barrier_modifier;
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="var(--line-color)" stroke-width="1" ${applied_options.is_barrier ? `stroke-dasharray="4"` : ''}/>`;
};
const generateControls = (qubits, column, isNegative = false) => {
    return qubits
        .map((qubit) => {
        const x = (column + 1) * RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN;
        const y = qubit * RENDER_STYLE.VERT_BOX;
        return `<use href="${isNegative ? '#neg_control' : '#control'}" x="${x}" y="${y}" width="32" height="32"></use>`;
    })
        .join('');
};
const generateConditionLine = (qubit, values, qubit_count, column) => {
    const max_bit = values.length - 1;
    const left_line = generateVerticalLine([qubit, qubit_count + max_bit], column, {
        x_shift: -RENDER_STYLE.HALF_LINE_SPACE,
    });
    const right_line = generateVerticalLine([qubit, qubit_count + max_bit], column, {
        x_shift: RENDER_STYLE.HALF_LINE_SPACE,
    });
    const dot = values
        .map((value, bit) => value == null ? '' : generateControls([qubit_count + bit], column, !value))
        .join('');
    return left_line + right_line + dot;
};
const splitControlledQubits = (qubits, isSwapGate = false) => {
    const ctrls = qubits.slice(0, isSwapGate ? -2 : -1);
    const gate_qb = qubits.slice(isSwapGate ? -2 : -1);
    return [ctrls, gate_qb];
};
const applyOptions = (options = {
    style: DEFAULT_OPTIONS,
}) => {
    const { style } = options;
    Object.assign(RENDER_STYLE, style);
};
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
const expandMultipleConditions = (gate_info) => {
    return gate_info
        .map(({ control_count, gate_name, gate_params, gate_registers, target_bit, condition }) => condition && gate_registers.length > 1 && !control_count
        ? gate_registers.map((reg) => ({
            control_count,
            gate_name,
            gate_params,
            gate_registers: [reg],
            target_bit,
            condition,
        }))
        : { control_count, gate_name, gate_params, gate_registers, target_bit, condition })
        .flat();
};
export const translateQemmetString = ({ qubit_count, bit_count, gate_info }, options = {
    style: DEFAULT_OPTIONS,
}) => {
    applyOptions(options);
    const expanded_gate_info = expandMultipleConditions(expandMeasurements(gate_info));
    const gates = expanded_gate_info
        .map(({ gate_name, control_count, gate_registers, gate_params, target_bit, condition }, column) => {
        if (gate_name === 'm')
            // they will always have 1 reg and 1 target (because of the expansion)
            return generateMeasure(gate_registers[0], target_bit?.[0] ?? gate_registers[0], qubit_count, column);
        if (gate_name === 'b')
            return generateVerticalLine(gate_registers, column, { is_barrier: true });
        const [control_qb, gate_qb] = control_count
            ? splitControlledQubits(gate_registers, gate_name === 'sw')
            : [[], gate_registers];
        const lines = control_count ? generateVerticalLine(gate_registers, column) : '';
        const controls = control_qb.length ? generateControls(control_qb, column) : '';
        const condition_elements = condition
            ? generateConditionLine(Math.max(...gate_registers), condition, qubit_count, column)
            : '';
        const gates = gate_name === 'x' && control_count
            ? `<use href="#target" x="${(column + 1) * RENDER_STYLE.HORZ_BOX + RENDER_STYLE.KET_MARGIN}" y="${RENDER_STYLE.VERT_BOX * gate_qb[0]}" width="32" height="32"></use>`
            : generateGateCol(gate_name, gate_qb, gate_params, column);
        return lines + controls + condition_elements + gates;
    })
        .join('\n  ');
    const svg_width = (expanded_gate_info.length + 1) * RENDER_STYLE.HORZ_BOX +
        RENDER_STYLE.KET_MARGIN +
        RENDER_STYLE.LINE_TRAIL_RIGHT -
        RENDER_STYLE.X_MARGIN;
    const svg_height = (qubit_count + bit_count) * RENDER_STYLE.VERT_BOX;
    return `<svg width="${svg_width + RENDER_STYLE.SVG_MARGIN}" height="${svg_height + RENDER_STYLE.SVG_MARGIN}" viewBox="${-RENDER_STYLE.SVG_MARGIN / 2} ${-RENDER_STYLE.SVG_MARGIN / 2} ${svg_width + RENDER_STYLE.SVG_MARGIN} ${svg_height + RENDER_STYLE.SVG_MARGIN}" xmlns="http://www.w3.org/2000/svg" style="background:${RENDER_STYLE.BACKGROUND_COLOR}">
  <style>
    @import url("https://cdn.jsdelivr.net/gh/rootEnginear/Qemmet/fonts/fonts.css");

    :root {
      --line-color: ${RENDER_STYLE.LINE_COLOR};
      --font-color: ${RENDER_STYLE.FONT_COLOR};
      --background-color: ${RENDER_STYLE.BACKGROUND_COLOR};
      --gate-background-color: ${RENDER_STYLE.GATE_BACKGROUND_COLOR};
    }

    text {
      fill: var(--font-color);
      font-family: LMR, LMM, 'Latin Modern Roman', 'Latin Modern Math', 'Computer Modern', serif;
      font-style: oblique;
    }

    tspan {
      font-style: normal;
    }

    text.params {
      font-size: 0.625rem;
      font-style: normal;
    }

    text[stroke-width] {
      stroke: var(--background-color);
    }
  </style>

  ${generateQubits(qubit_count, expanded_gate_info.length)}
  ${generateBits(bit_count, qubit_count, expanded_gate_info.length)}
  ${gates}

  <symbol id="gate" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="var(--gate-background-color)" stroke="var(--line-color)" />
  </symbol>

  <symbol id="measure" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M26.8182 26H25.8182C25.8182 20.5274 21.3817 16.0909 15.9091 16.0909C10.4365 16.0909 6 20.5274 6 26L5 26C5 19.9751 9.88417 15.0909 15.9091 15.0909C21.934 15.0909 26.8182 19.9751 26.8182 26Z"
      fill="var(--line-color)" />
    <path d="M15.9091 26L25 6" stroke="var(--line-color)" />
  </symbol>

  <symbol id="sw" width="32" height="32" viewBox="0 0 32 32">
    <path d="M6 6L26 26M26 6L6 26" stroke="var(--line-color)"/>
  </symbol>

  <symbol id="control" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="4" fill="var(--line-color)"/>
  </symbol>

  <symbol id="neg_control" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="3.5" fill="var(--background-color)" stroke="var(--line-color)"/>
  </symbol>

  <symbol id="arrow" width="10" height="8" viewBox="0 0 10 8">
    <path d="M0 0L5 8L10 0H0Z" fill="var(--line-color)"/>
  </symbol>

  <symbol id="target" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="11.5" fill="var(--background-color)" stroke="var(--line-color)"/>
    <path d="M16 4V28M28 16H4" stroke="var(--line-color)"/>
  </symbol>

  <symbol id="sx" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path d="M9.82662 20.838L7.69534 16.1274C7.61057 15.9337 7.55002 15.9337 7.51369 15.9337C7.50158 15.9337 7.44104 15.9337 7.30783 16.0306L6.15742 16.9024C6 17.0235 6 17.0599 6 17.0962C6 17.1567 6.03633 17.2294 6.1211 17.2294C6.19375 17.2294 6.39962 17.0599 6.53282 16.963C6.60548 16.9024 6.78712 16.7692 6.92033 16.6724L9.30591 21.9158C9.39067 22.1095 9.45122 22.1095 9.56021 22.1095C9.74185 22.1095 9.77818 22.0369 9.86295 21.8674L15.3607 10.4844C15.4454 10.3148 15.4454 10.2664 15.4454 10.2422C15.4454 10.1211 15.3486 10 15.2033 10C15.1064 10 15.0216 10.0605 14.9247 10.2543L9.82662 20.838Z" fill="var(--font-color)"/>
    <path d="M26 10H15.2073V10.4844H26V10Z" fill="var(--font-color)"/>
    <text x="19.5" y="18.5" dominant-baseline="middle" text-anchor="middle" font-size=".7em">X</text>
  </symbol>

  <symbol id="sdg" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <text x="16" y="20" dominant-baseline="middle" text-anchor="middle">S<tspan dy="-6" dx="1" font-size=".7em">†</tspan></text>
  </symbol>

  <symbol id="tdg" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <text x="16" y="20" dominant-baseline="middle" text-anchor="middle">T<tspan dy="-6" dx="1" font-size=".7em">†</tspan></text>
  </symbol>

  <symbol id="reset" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path d="M7.25 6V26" stroke="var(--font-color)"/>
    <path d="M21.3409 6L25.4318 16L21.3409 26" fill="none" stroke="var(--font-color)"/>
    <text x="15.5" y="18" dominant-baseline="middle" text-anchor="middle" style="font-style:normal;font-size:1.15em">0</text>
  </symbol>
</svg>`;
};
