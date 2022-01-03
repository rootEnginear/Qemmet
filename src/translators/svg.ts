import { QemmetGateInfo, QemmetParserOutput } from '../types'

const generateQubits = (qubit_count: number, depth: number): string => {
	return new Array(qubit_count)
		.fill('')
		.map(
			(_, i) =>
				`<use href="#ket0" x="0" y="${i * 48}" width="32" height="32"></use><line x1="36" y1="${
					i * 48 + 16
				}" x2="${(depth + 1) * 40 + 8}" y2="${i * 48 + 16}" stroke="black" stroke-width="1" />`
		)
		.join('')
}

const generateBits = (bit_count: number, qubit_count: number, depth: number): string => {
	return new Array(bit_count)
		.fill('')
		.map((_, i) => {
			const pos_index = i + qubit_count
			return `<line x1="36" y1="${pos_index * 48 + 16 - 1.5}" x2="${(depth + 1) * 40 + 8}" y2="${
				pos_index * 48 + 16 - 1.5
			}" stroke="black" stroke-width="1" /><line x1="36" y1="${pos_index * 48 + 16 + 1.5}" x2="${
				(depth + 1) * 40 + 8
			}" y2="${pos_index * 48 + 16 + 1.5}" stroke="black" stroke-width="1" />`
		})
		.join('')
}

const generateMeasure = (qubit: number, qubit_count: number, column: number) => {
	return `<line x1="${40 * (column + 1) + 16 + 8 - 1.5}" y1="${48 * qubit + 16}" x2="${
		40 * (column + 1) + 16 + 8 - 1.5
	}" y2="${
		48 * (qubit + qubit_count) + 16 - 1.5 - 6
	}" stroke="black" stroke-width="1" /><line x1="${40 * (column + 1) + 16 + 8 + 1.5}" y1="${
		48 * qubit + 16
	}" x2="${40 * (column + 1) + 16 + 8 + 1.5}" y2="${
		48 * (qubit + qubit_count) + 16 - 1.5 - 6
	}" stroke="black" stroke-width="1" /><use href="#measure" x="${40 * (column + 1) + 8}" y="${
		48 * qubit
	}" width="32" height="32"></use><use href="#arrow" x="${40 * (column + 1) + 16 + 4 - 1}" y="${
		48 * (qubit + qubit_count) + 8 - 2
	}" width="10" height="8"></use>`
}

const generateGate = (
	gate_name: QemmetGateInfo['gate_name'],
	gate_params: QemmetGateInfo['gate_params']
): ((qubit: number, column: number) => string) => {
	return (qubit: number, column: number) => {
		switch (gate_name) {
			case 'sw':
			case 'sdg':
			case 'tdg':
				return `<use href="#${gate_name}" x="${40 * (column + 1) + 8}" y="${
					48 * qubit
				}" width="32" height="32"></use>`
			case '/x':
			case 'sx':
				return `<use href="#sqrt_x" x="${40 * (column + 1) + 8}" y="${
					48 * qubit
				}" width="32" height="32"></use>`
		}

		const formatted_params = gate_params
			.replace(/pi/g, 'π')
			.replace(/euler/g, 'e')
			.replace(/\s/g, '')
		const params_str = gate_params
			? `<text class="params" x="${40 * (column + 1) + 8 + 16 - 1}" y="${
					48 * qubit + 32 + 8 - 1
			  }" dominant-baseline="middle" text-anchor="middle">(${formatted_params})</text>`
			: ''

		// No param
		return (
			`<use href="#gate" x="${40 * (column + 1) + 8}" y="${
				48 * qubit
			}" width="32" height="32"></use><text x="${40 * (column + 1) + 8 + 16 - 1}" y="${
				48 * qubit + 16 + 2
			}" dominant-baseline="middle" text-anchor="middle">${gate_name.toUpperCase()}</text>` +
			params_str
		)
	}
}

const generateGateCol = (
	gate_name: QemmetGateInfo['gate_name'],
	gate_registers: QemmetGateInfo['gate_registers'],
	gate_params: QemmetGateInfo['gate_params'],
	column: number
): string => {
	const gateGenerator = generateGate(gate_name, gate_params)

	return new Array(gate_registers.length)
		.fill('')
		.map((_, i) => {
			return gateGenerator(gate_registers[i], column)
		})
		.join('')
}

const generateVerticalLine = (qubits: number[], column: number, isBarrier = false) => {
	const max = Math.max(...qubits)
	const min = Math.min(...qubits)

	const x = 40 * (column + 1) + 16 + 8
	const y1 = 48 * min + 16 - +isBarrier * 15
	const y2 = 48 * max + 16 + +isBarrier * 15

	return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="black" stroke-width="1" ${
		isBarrier ? `stroke-dasharray="4"` : ''
	}/>`
}

const generateControls = (qubits: number[], column: number) => {
	return qubits
		.map((qubit) => {
			return `<use href="#control" x="${40 * (column + 1) + 8}" y="${
				qubit * 48
			}" width="32" height="32"></use>`
		})
		.join('')
}

const splitControlledQubits = (qubits: number[], isSwapGate = false): [number[], number[]] => {
	const ctrls = qubits.slice(0, isSwapGate ? -2 : -1)
	const gate_qb = qubits.slice(isSwapGate ? -2 : -1)
	return [ctrls, gate_qb]
}

const separateMeasures = (gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	return gate_info
		.map(({ control_count, gate_name, gate_params, gate_registers }) =>
			gate_name === 'm'
				? gate_registers.map((reg) => ({
						control_count,
						gate_name,
						gate_params,
						gate_registers: [reg],
				  }))
				: { control_count, gate_name, gate_params, gate_registers }
		)
		.flat()
}

export const translateQemmetString = ({
	qubit_count,
	bit_count,
	gate_info,
}: QemmetParserOutput) => {
	const normalized_gate_info = separateMeasures(gate_info)
	const gates = normalized_gate_info
		.map(({ gate_name, control_count, gate_registers, gate_params }, column) => {
			if (gate_name === 'm') return generateMeasure(gate_registers[0], qubit_count, column)
			if (gate_name === 'b') return generateVerticalLine(gate_registers, column, true)
			const [control_qb, gate_qb] = control_count
				? splitControlledQubits(gate_registers, gate_name === 'sw')
				: [[], gate_registers]
			const lines = control_count ? generateVerticalLine(gate_registers, column) : ''
			const controls = control_qb.length ? generateControls(control_qb, column) : ''
			const gates =
				gate_name === 'x' && control_count
					? `<use href="#x_gate" x="${40 * (column + 1) + 8}" y="${
							48 * gate_qb[0]
					  }" width="32" height="32"></use>`
					: generateGateCol(gate_name, gate_qb, gate_params, column)

			return lines + controls + gates
		})
		.join('\n  ')

	const svg_width = (normalized_gate_info.length + 1) * 40 + 16
	const svg_height = (qubit_count + bit_count) * 48

	return `<svg width="${svg_width}" height="${svg_height}" viewBox="0 0 ${svg_width} ${svg_height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    @import url("https://cdn.jsdelivr.net/gh/rootEnginear/Qemmet/fonts/fonts.css");

    text {
      font-family: LMR, LMM, 'Latin Modern Roman', 'Latin Modern Math', 'Computer Modern', serif;
      font-style: oblique;
    }

    text.params {
      font-size: 0.625rem;
      font-style: normal;
    }
  </style>

  ${generateQubits(qubit_count, normalized_gate_info.length)}
  ${generateBits(bit_count, qubit_count, normalized_gate_info.length)}
  ${gates}

  <symbol id="gate" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black" />
  </symbol>

  <symbol id="ket0" width="32" height="32" viewBox="0 0 32 32">
    <path d="M6 5V27" stroke="black"/>
    <path d="M21.5 5L26 16L21.5 27" stroke="black" fill="none"/>
    <path d="M19.46 15.92C19.46 13.78 19.24 12.48 18.58 11.2C17.7 9.44 16.08 9 14.98 9C12.46 9 11.54 10.88 11.26 11.44C10.54 12.9 10.5 14.88 10.5 15.92C10.5 17.24 10.56 19.26 11.52 20.86C12.44 22.34 13.92 22.72 14.98 22.72C15.94 22.72 17.66 22.42 18.66 20.44C19.4 19 19.46 17.22 19.46 15.92ZM17.68 15.68C17.68 16.86 17.68 18.66 17.44 19.78C17.02 21.88 15.64 22.16 14.98 22.16C14.3 22.16 12.92 21.84 12.5 19.74C12.28 18.6 12.28 16.72 12.28 15.68C12.28 14.3 12.28 12.9 12.5 11.8C12.92 9.76 14.48 9.56 14.98 9.56C15.66 9.56 17.04 9.9 17.44 11.72C17.68 12.82 17.68 14.32 17.68 15.68Z" fill="black"/>
  </symbol>

  <symbol id="measure" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M26.8182 26H25.8182C25.8182 20.5274 21.3817 16.0909 15.9091 16.0909C10.4365 16.0909 6 20.5274 6 26L5 26C5 19.9751 9.88417 15.0909 15.9091 15.0909C21.934 15.0909 26.8182 19.9751 26.8182 26Z"
      fill="black" />
    <path d="M15.9091 26L25 6" stroke="black" />
  </symbol>

  <symbol id="sw" width="32" height="32" viewBox="0 0 32 32">
    <path d="M6 6L26 26M26 6L6 26" stroke="black"/>
  </symbol>

  <symbol id="control" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="4" fill="black"/>
  </symbol>

  <symbol id="arrow" width="10" height="8" viewBox="0 0 10 8">
    <path d="M0 0L5 8L10 0H0Z" fill="black"/>
  </symbol>

  <symbol id="x_gate" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="11.5" fill="white" stroke="black"/>
    <path d="M16 4V28M28 16H4" stroke="black"/>
  </symbol>

  <symbol id="sqrt_x" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path d="M9.82662 20.838L7.69534 16.1274C7.61057 15.9337 7.55002 15.9337 7.51369 15.9337C7.50158 15.9337 7.44104 15.9337 7.30783 16.0306L6.15742 16.9024C6 17.0235 6 17.0599 6 17.0962C6 17.1567 6.03633 17.2294 6.1211 17.2294C6.19375 17.2294 6.39962 17.0599 6.53282 16.963C6.60548 16.9024 6.78712 16.7692 6.92033 16.6724L9.30591 21.9158C9.39067 22.1095 9.45122 22.1095 9.56021 22.1095C9.74185 22.1095 9.77818 22.0369 9.86295 21.8674L15.3607 10.4844C15.4454 10.3148 15.4454 10.2664 15.4454 10.2422C15.4454 10.1211 15.3486 10 15.2033 10C15.1064 10 15.0216 10.0605 14.9247 10.2543L9.82662 20.838Z" fill="black"/>
    <path d="M26 10H15.2073V10.4844H26V10Z" fill="black"/>
    <path d="M23.868 21.196L23.94 20.8H23.736C23.004 20.8 22.848 20.692 22.668 20.368L20.556 16.588L22.74 14.176C23.424 13.408 24.348 13.396 24.624 13.396L24.696 13C24.264 13.036 23.616 13.036 23.34 13.036C22.692 13.036 22.584 13.036 21.864 13L21.792 13.396C22.32 13.42 22.404 13.744 22.368 13.912C22.356 14.032 22.296 14.128 22.2 14.236L20.376 16.252L19.068 13.936C19.044 13.888 19.008 13.816 19.008 13.756C19.032 13.612 19.296 13.396 19.776 13.396L19.848 13L18.12 13.036C17.388 13.036 17.232 13.036 16.548 13L16.476 13.396H16.68C17.4 13.396 17.568 13.504 17.748 13.816L19.596 17.116L16.956 20.032C16.272 20.8 15.324 20.8 15.072 20.8L15 21.196C15.432 21.16 16.116 21.16 16.368 21.16C16.968 21.16 17.124 21.16 17.844 21.196L17.916 20.8C17.34 20.776 17.304 20.404 17.328 20.284C17.328 20.248 17.352 20.128 17.532 19.936L19.776 17.452L21.324 20.248C21.408 20.38 21.408 20.404 21.408 20.44C21.372 20.596 21.12 20.788 20.64 20.8L20.568 21.196L22.296 21.16C22.896 21.16 23.232 21.16 23.868 21.196Z" fill="black"/>
  </symbol>

  <symbol id="sdg" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path d="M22.883 12.014C22.883 11.926 22.839 11.596 22.432 11.596C22.267 11.596 22.003 11.64 21.739 11.728C21.453 11.805 21.255 11.849 21.079 11.871C21.09 11.684 21.09 11.431 21.211 10.771C21.255 10.507 21.354 9.869 21.354 9.495C21.354 9.407 21.354 9 20.947 9C20.529 9 20.529 9.396 20.529 9.495C20.529 9.858 20.617 10.408 20.672 10.749C20.793 11.475 20.793 11.629 20.804 11.871C20.606 11.849 20.441 11.805 20.177 11.728C19.935 11.662 19.649 11.596 19.451 11.596C19 11.596 19 12.003 19 12.003C19 12.091 19.044 12.421 19.451 12.421C19.616 12.421 19.88 12.377 20.144 12.289C20.43 12.212 20.628 12.168 20.804 12.146C20.793 12.322 20.782 12.509 20.694 12.905C20.529 13.675 20.529 13.752 20.529 14.335C20.529 15.655 20.617 17.448 20.76 18.867C20.771 19.032 20.782 19.109 20.936 19.109C21.013 19.109 21.09 19.098 21.112 18.966C21.134 18.812 21.354 16.513 21.354 14.335C21.354 13.796 21.354 13.675 21.211 12.993C21.101 12.498 21.101 12.388 21.079 12.146C21.277 12.168 21.442 12.212 21.706 12.289C21.948 12.355 22.234 12.421 22.432 12.421C22.883 12.421 22.883 12.014 22.883 12.014Z" fill="black"/>
    <path d="M17.0516 20.304C17.2756 18.912 16.6036 17.488 15.0356 17.104L12.9236 16.592C11.9316 16.352 11.3236 15.536 11.4836 14.56C11.6596 13.488 12.7476 12.48 14.1396 12.48C16.9076 12.48 16.8436 15.072 16.8276 15.68C16.8276 15.856 16.8276 15.968 17.0356 15.968C17.2916 15.968 17.3076 15.856 17.3556 15.552L17.8836 12.416C17.9316 12.16 17.9476 12 17.7396 12C17.6116 12 17.5796 12.048 17.4356 12.224L16.7316 13.12C16.0756 12.24 15.0836 12 14.2036 12C12.2996 12 10.6516 13.44 10.3796 15.072C10.1876 16.288 10.7636 16.96 11.0196 17.264C11.4996 17.84 11.9956 17.968 13.6596 18.368C14.9876 18.688 15.2116 18.736 15.6436 19.296C15.7876 19.472 16.0916 20.016 15.9636 20.8C15.7716 21.904 14.7316 23.072 13.2276 23.072C11.4676 23.072 9.78759 22.224 10.0596 20C10.0916 19.744 10.1076 19.632 9.88359 19.632C9.62759 19.632 9.61159 19.76 9.54759 20.064L9.03559 23.184C8.98759 23.44 8.95559 23.6 9.16359 23.6C9.29159 23.6 9.32359 23.568 9.45159 23.408C9.53159 23.312 9.62759 23.168 10.1876 22.496C11.0516 23.392 12.1876 23.6 13.1476 23.6C15.1476 23.6 16.7636 22.016 17.0516 20.304Z" fill="black"/>
  </symbol>

  <symbol id="tdg" width="32" height="32" viewBox="0 0 32 32">
    <use href="#gate" x="0" y="0" width="32" height="32"></use>
    <path d="M23.883 12.014C23.883 11.926 23.839 11.596 23.432 11.596C23.267 11.596 23.003 11.64 22.739 11.728C22.453 11.805 22.255 11.849 22.079 11.871C22.09 11.684 22.09 11.431 22.211 10.771C22.255 10.507 22.354 9.869 22.354 9.495C22.354 9.407 22.354 9 21.947 9C21.529 9 21.529 9.396 21.529 9.495C21.529 9.858 21.617 10.408 21.672 10.749C21.793 11.475 21.793 11.629 21.804 11.871C21.606 11.849 21.441 11.805 21.177 11.728C20.935 11.662 20.649 11.596 20.451 11.596C20 11.596 20 12.003 20 12.003C20 12.091 20.044 12.421 20.451 12.421C20.616 12.421 20.88 12.377 21.144 12.289C21.43 12.212 21.628 12.168 21.804 12.146C21.793 12.322 21.782 12.509 21.694 12.905C21.529 13.675 21.529 13.752 21.529 14.335C21.529 15.655 21.617 17.448 21.76 18.867C21.771 19.032 21.782 19.109 21.936 19.109C22.013 19.109 22.09 19.098 22.112 18.966C22.134 18.812 22.354 16.513 22.354 14.335C22.354 13.796 22.354 13.675 22.211 12.993C22.101 12.498 22.101 12.388 22.079 12.146C22.277 12.168 22.442 12.212 22.706 12.289C22.948 12.355 23.234 12.421 23.432 12.421C23.883 12.421 23.883 12.014 23.883 12.014Z" fill="black"/>
    <path d="M19.04 16.632L19.328 13H8.928L8 16.632H8.496C9.168 13.928 9.6 13.528 12.048 13.528C12.352 13.528 12.848 13.528 12.976 13.56C13.264 13.624 13.264 13.784 13.184 14.184L11.808 22.504C11.712 23.064 11.68 23.288 10.016 23.288H9.408L9.312 23.816C9.92 23.768 11.648 23.768 12.336 23.768C13.024 23.768 14.752 23.768 15.328 23.816L15.424 23.288H14.816C13.152 23.288 13.184 23.064 13.28 22.504L14.656 14.184C14.72 13.816 14.752 13.624 15.104 13.56C15.248 13.528 15.712 13.528 16.016 13.528C18.464 13.528 18.768 13.928 18.544 16.632H19.04Z" fill="black"/>
  </symbol>
</svg>`
}
