import { QemmetGateInfo, QemmetParserOutput } from '../types'

// TODO: implement this in qemmet core
const normalizeAdjacentGate = (raw_gate_info: QemmetGateInfo[]): QemmetGateInfo[] => {
	let gate_info = JSON.parse(JSON.stringify(raw_gate_info)) as QemmetGateInfo[]
	let gate_info_len = gate_info.length

	for (let i = 0; i + 1 < gate_info_len; i++) {
		const curr_gate = gate_info[i]
		const next_gate = gate_info[i + 1]

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

const generateQubits = (qubit_count: number, depth: number): string => {
	return new Array(qubit_count)
		.fill('')
		.map(
			(_, i) =>
				`<use xlink:href="#ket0" x="0" y="${i * 48}"></use><line x1="36" y1="${i * 48 + 16}" x2="${
					(depth + 1) * 40 + 8
				}" y2="${i * 48 + 16}" stroke="black" stroke-width="1" />`
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
	}" stroke="black" stroke-width="1" /><use xlink:href="#measure" x="${40 * (column + 1) + 8}" y="${
		48 * qubit
	}"></use><use xlink:href="#arrow" x="${40 * (column + 1) + 16 + 4 - 1}" y="${
		48 * (qubit + qubit_count) + 8 - 2
	}"></use>`
}

const generateGate = (
	gate_name: QemmetGateInfo['gate_name'],
	gate_params: QemmetGateInfo['gate_params']
): ((qubit: number, column: number) => string) => {
	return (qubit: number, column: number) => {
		if (gate_name === 'sw')
			return `<use xlink:href="#sw" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use>`
		if (gate_name === '/x')
			return `<use xlink:href="#sqrt_x" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use>`
		if (gate_name === 'sx')
			return `<use xlink:href="#sqrt_x" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use>`
		if (gate_name === 'tdg')
			return `<use xlink:href="#tdg" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use>`
		if (gate_name === 'sdg')
			return `<use xlink:href="#sdg" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use>`

		const formatted_params = gate_params
			.replace(/pi/g, 'π')
			.replace(/euler/g, 'e')
			.replace(/\s/g, '')
		const params_str = gate_params
			? `<text x="${40 * (column + 1) + 8 + 16 - 1}" y="${
					48 * qubit + 32 + 8 - 1
			  }" dominant-baseline="middle" text-anchor="middle" font-family="LMRoman10, serif" font-size='0.625rem'>(${formatted_params})</text>`
			: ''

		// No param
		return (
			`<use xlink:href="#gate" x="${40 * (column + 1) + 8}" y="${48 * qubit}"></use><text x="${
				40 * (column + 1) + 8 + 16 - 1
			}" y="${
				48 * qubit + 16 + 2
			}" dominant-baseline="middle" text-anchor="middle" font-family="LMRomanSlant10, serif">${gate_name.toUpperCase()}</text>` +
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
	return new Array(gate_registers.length)
		.fill('')
		.map((_, i) => {
			return generateGate(gate_name, gate_params)(gate_registers[i], column)
		})
		.join('')
}

const generateVerticalLine = (qubits: number[], column: number, isBarrier = false) => {
	const [max, min] = qubits.reduce(
		([max, min], qubit) => [Math.max(max, qubit), Math.min(min, qubit)],
		[-Infinity, Infinity]
	)
	return `<line x1="${40 * (column + 1) + 16 + 8}" y1="${min * 48 + 16}" x2="${
		40 * (column + 1) + 16 + 8
	}" y2="${max * 48 + 16}" stroke="black" stroke-width="1" ${
		isBarrier ? `stroke-dasharray="4"` : ''
	}/>`
}

const generateControls = (qubits: number[], column: number) => {
	return qubits
		.map((qubit) => {
			return `<use xlink:href="#control" x="${40 * (column + 1) + 8}" y="${qubit * 48}"></use>`
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
	const normalized_gate_info = separateMeasures(normalizeAdjacentGate(gate_info))
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
					? `<use xlink:href="#x_gate" x="${40 * (column + 1) + 8}" y="${48 * gate_qb[0]}"></use>`
					: generateGateCol(gate_name, gate_qb, gate_params, column)

			return lines + controls + gates
		})
		.join('')

	return `<svg width="${(normalized_gate_info.length + 1) * 40 + 16}" height="${
		(qubit_count + bit_count) * 48
	}">
  <style>
    @import url("https://fonts.cdnfonts.com/css/latin-modern-roman");
  </style>

  ${generateQubits(qubit_count, normalized_gate_info.length)}${generateBits(
		bit_count,
		qubit_count,
		normalized_gate_info.length
	)}${gates}

  <symbol id="ket0" width="32" height="32" viewBox="0 0 32 32">
    <path d="M4.12268 3.008C4.12268 2.504 4.12268 2 3.56134 2C3 2 3 2.504 3 3.008V28.992C3 29.496 3 30 3.56134 30C4.12268 30 4.12268 29.496 4.12268 28.992V3.008Z" fill="black"/>
    <path d="M20.0304 16.035C20.0304 13.711 19.8901 11.443 18.8797 9.315C17.7289 6.991 15.7081 6.375 14.3328 6.375C12.705 6.375 10.7122 7.187 9.67372 9.511C8.88785 11.275 8.60718 13.011 8.60718 16.035C8.60718 18.751 8.80365 20.795 9.81406 22.783C10.9087 24.911 12.8453 25.583 14.3048 25.583C16.7466 25.583 18.1499 24.127 18.9639 22.503C19.9743 20.403 20.0304 17.659 20.0304 16.035ZM14.3048 25.023C13.4066 25.023 11.5823 24.519 11.049 21.467C10.7403 19.787 10.7403 17.659 10.7403 15.699C10.7403 13.403 10.7403 11.331 11.1893 9.679C11.6665 7.803 13.0979 6.935 14.3048 6.935C15.3713 6.935 16.9992 7.579 17.5325 9.987C17.8973 11.583 17.8973 13.795 17.8973 15.699C17.8973 17.575 17.8973 19.703 17.5886 21.411C17.0553 24.491 15.2871 25.023 14.3048 25.023Z" fill="black"/>
    <path d="M28.8597 16.476C29 16.14 29 16.084 29 16C29 15.916 29 15.86 28.8597 15.524L23.948 2.644C23.7795 2.168 23.6111 2 23.3024 2C22.9937 2 22.7411 2.252 22.7411 2.56C22.7411 2.644 22.7411 2.7 22.8814 3.008L27.8493 16L22.8814 28.936C22.7411 29.244 22.7411 29.3 22.7411 29.44C22.7411 29.748 22.9937 30 23.3024 30C23.6673 30 23.7796 29.72 23.8918 29.44L28.8597 16.476Z" fill="black"/>
  </symbol>

  <symbol id="measure" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black" />
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M26.8182 26H25.8182C25.8182 20.5274 21.3817 16.0909 15.9091 16.0909C10.4365 16.0909 6 20.5274 6 26L5 26C5 19.9751 9.88417 15.0909 15.9091 15.0909C21.934 15.0909 26.8182 19.9751 26.8182 26Z"
      fill="black" />
    <path d="M15.9091 26L25 6" stroke="black" />
  </symbol>

  <symbol id="gate" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black" />
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
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black"/>
    <path d="M9.82662 20.838L7.69534 16.1274C7.61057 15.9337 7.55002 15.9337 7.51369 15.9337C7.50158 15.9337 7.44104 15.9337 7.30783 16.0306L6.15742 16.9024C6 17.0235 6 17.0599 6 17.0962C6 17.1567 6.03633 17.2294 6.1211 17.2294C6.19375 17.2294 6.39962 17.0599 6.53282 16.963C6.60548 16.9024 6.78712 16.7692 6.92033 16.6724L9.30591 21.9158C9.39067 22.1095 9.45122 22.1095 9.56021 22.1095C9.74185 22.1095 9.77818 22.0369 9.86295 21.8674L15.3607 10.4844C15.4454 10.3148 15.4454 10.2664 15.4454 10.2422C15.4454 10.1211 15.3486 10 15.2033 10C15.1064 10 15.0216 10.0605 14.9247 10.2543L9.82662 20.838Z" fill="black"/>
    <path d="M26 10H15.2073V10.4844H26V10Z" fill="black"/>
    <path d="M20.9594 16.4118L19.8211 13.7598C19.9785 13.4692 20.3418 13.4208 20.4871 13.4086C20.5597 13.4086 20.6929 13.3965 20.6929 13.1907C20.6929 13.0575 20.584 13.0575 20.5113 13.0575C20.3054 13.0575 20.0632 13.0817 19.8574 13.0817H19.155C18.4163 13.0817 17.8835 13.0575 17.8714 13.0575C17.7745 13.0575 17.6534 13.0575 17.6534 13.2875C17.6534 13.4086 17.7624 13.4086 17.9199 13.4086C18.6222 13.4086 18.6706 13.5297 18.7917 13.8204L20.2328 17.1868L17.605 19.9962C17.1691 20.4685 16.6484 20.9287 15.7522 20.9771C15.6069 20.9892 15.5101 20.9892 15.5101 21.2072C15.5101 21.2435 15.5222 21.3283 15.6554 21.3283C15.8249 21.3283 16.0065 21.3041 16.1761 21.3041H16.7452C17.1327 21.3041 17.5566 21.3283 17.932 21.3283C18.0167 21.3283 18.162 21.3283 18.162 21.1103C18.162 20.9892 18.0773 20.9771 18.0046 20.9771C17.7624 20.9529 17.605 20.8197 17.605 20.6259C17.605 20.4201 17.7503 20.2748 18.1015 19.9115L19.1792 18.7368C19.4457 18.4583 20.0875 17.756 20.3539 17.4896L21.6254 20.4685C21.6375 20.4927 21.6859 20.6138 21.6859 20.6259C21.6859 20.7349 21.4195 20.9529 21.032 20.9771C20.9594 20.9771 20.8261 20.9892 20.8261 21.2072C20.8261 21.3283 20.9472 21.3283 21.0078 21.3283C21.2137 21.3283 21.4558 21.3041 21.6617 21.3041H22.9938C23.2117 21.3041 23.4418 21.3283 23.6477 21.3283C23.7324 21.3283 23.8656 21.3283 23.8656 21.0982C23.8656 20.9771 23.7445 20.9771 23.6356 20.9771C22.909 20.965 22.8848 20.9044 22.6789 20.4564L21.0804 16.7024L22.6184 15.0555C22.7395 14.9344 23.018 14.6317 23.127 14.5106C23.6477 13.9657 24.1321 13.4692 25.1129 13.4086C25.234 13.3965 25.3551 13.3965 25.3551 13.1907C25.3551 13.0575 25.2461 13.0575 25.1977 13.0575C25.0282 13.0575 24.8465 13.0817 24.677 13.0817H24.1199C23.7324 13.0817 23.3086 13.0575 22.9332 13.0575C22.8484 13.0575 22.7031 13.0575 22.7031 13.2754C22.7031 13.3965 22.7879 13.4086 22.8605 13.4086C23.0543 13.4329 23.2602 13.5297 23.2602 13.7598L23.2481 13.784C23.2359 13.8688 23.2117 13.9899 23.0785 14.1352L20.9594 16.4118Z" fill="black"/>
  </symbol>

  <symbol id="sdg" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black"/>
    <path d="M18.6986 12.1093C18.6986 11.9598 18.5823 11.9598 18.5491 11.9598C18.4827 11.9598 18.4661 11.9764 18.2668 12.2255C18.1672 12.3418 17.4863 13.2053 17.4697 13.222C16.9216 12.1425 15.8255 11.9598 15.128 11.9598C13.0189 11.9598 11.1091 13.8862 11.1091 15.7628C11.1091 17.0084 11.8564 17.7391 12.6702 18.0214C12.8529 18.0879 13.8327 18.3536 14.3309 18.4698C15.1779 18.7023 15.3938 18.7687 15.7425 19.1341C15.8089 19.2171 16.1411 19.5991 16.1411 20.3796C16.1411 21.9241 14.7129 23.5184 13.0521 23.5184C11.6904 23.5184 10.1791 22.9371 10.1791 21.0771C10.1791 20.7616 10.2455 20.363 10.2954 20.197C10.2954 20.1471 10.312 20.0641 10.312 20.0309C10.312 19.9645 10.2788 19.8814 10.1459 19.8814C9.99643 19.8814 9.97982 19.9146 9.91339 20.197L9.06643 23.6014C9.06643 23.618 9 23.8339 9 23.8505C9 24 9.13286 24 9.16607 24C9.2325 24 9.24911 23.9834 9.44839 23.7343L10.2123 22.7379C10.6109 23.3357 11.4745 24 13.0189 24C15.1613 24 17.1209 21.9241 17.1209 19.8482C17.1209 19.1507 16.9548 18.5362 16.3238 17.9218C15.975 17.573 15.6761 17.49 14.1482 17.0914C13.0355 16.7925 12.8861 16.7427 12.5871 16.477C12.3048 16.1946 12.0889 15.7961 12.0889 15.2314C12.0889 13.8364 13.5005 12.4082 15.0782 12.4082C16.7057 12.4082 17.4697 13.4046 17.4697 14.9823C17.4697 15.4141 17.3866 15.8625 17.3866 15.9289C17.3866 16.0784 17.5195 16.0784 17.5693 16.0784C17.7188 16.0784 17.7354 16.0286 17.8018 15.7628L18.6986 12.1093Z" fill="black"/>
    <path d="M21.8663 12.1775C22.132 12.2107 22.1542 12.2107 22.6413 12.3436C22.8074 12.3879 23.051 12.4432 23.2281 12.4432C23.6599 12.4432 23.682 12.0779 23.682 12.0336C23.682 11.9118 23.6267 11.6129 23.2281 11.6129C22.9734 11.6129 22.6413 11.7014 22.442 11.7679C22.1542 11.8454 22.0877 11.8564 21.8663 11.8786C21.8884 11.5575 21.9217 11.2254 22.0324 10.5279C22.0988 10.1846 22.1431 9.84143 22.1431 9.49821C22.1431 9.33214 22.0988 9 21.7334 9C21.3127 9 21.3127 9.39857 21.3127 9.49821C21.3127 9.53143 21.3127 9.91893 21.4234 10.5279C21.512 11.1036 21.5674 11.48 21.5895 11.8786C21.3238 11.8454 21.3017 11.8454 20.8145 11.7125C20.6484 11.6682 20.4049 11.6129 20.2277 11.6129C19.7959 11.6129 19.7738 11.9782 19.7738 12.0225C19.7738 12.1443 19.8292 12.4432 20.2277 12.4432C20.4824 12.4432 20.8145 12.3546 21.0138 12.2882C21.3017 12.2107 21.3681 12.1996 21.5895 12.1775C21.5674 12.4764 21.5231 12.6979 21.4567 12.9857C21.3127 13.6943 21.3127 13.805 21.3127 14.3696C21.3127 16.44 21.512 18.6322 21.5452 18.9422C21.5674 19.0972 21.5674 19.1747 21.7224 19.1747C21.8774 19.1747 21.8884 19.0972 21.9106 18.9643C21.9659 18.4993 22.0102 17.7907 22.0434 17.3036C22.0767 16.8386 22.1431 15.4436 22.1431 14.3696C22.1431 13.8714 22.1431 13.6832 22.0102 13.0854C22.0102 13.0521 21.8884 12.4986 21.8663 12.1775Z" fill="black"/>
  </symbol>

  <symbol id="tdg" width="32" height="32" viewBox="0 0 32 32">
    <rect x="1.5" y="1.5" width="29" height="29" fill="white" stroke="black"/>
    <path d="M14.682 13.6285C14.784 13.2204 14.818 13.0674 15.073 12.9994C15.209 12.9654 15.7701 12.9654 16.1272 12.9654C17.8274 12.9654 18.6265 13.0334 18.6265 14.3596C18.6265 14.6146 18.5585 15.2607 18.4565 15.8898L18.4395 16.0938C18.4395 16.1619 18.5075 16.2639 18.6095 16.2639C18.7796 16.2639 18.7796 16.1789 18.8306 15.9068L19.3236 12.8974C19.3577 12.7444 19.3576 12.7104 19.3576 12.6593C19.3576 12.4723 19.2556 12.4723 18.9156 12.4723H9.61523C9.22418 12.4723 9.20718 12.4893 9.10516 12.7954L8.06801 15.8558C8.05101 15.8898 8 16.0768 8 16.0938C8 16.1789 8.06801 16.2639 8.17003 16.2639C8.30604 16.2639 8.34005 16.1959 8.40806 15.9748C9.12216 13.9175 9.47922 12.9654 11.7405 12.9654H12.8797C13.2878 12.9654 13.4578 12.9654 13.4578 13.1524C13.4578 13.2034 13.4578 13.2374 13.3728 13.5435L11.0944 22.6738C10.9244 23.3369 10.8904 23.5069 9.08816 23.5069C8.6631 23.5069 8.54408 23.5069 8.54408 23.83C8.54408 24 8.73111 24 8.81612 24C9.24118 24 9.68324 23.966 10.1083 23.966H12.7607C13.1858 23.966 13.6448 24 14.0699 24C14.2569 24 14.4269 24 14.4269 23.6769C14.4269 23.5069 14.3079 23.5069 13.8659 23.5069C12.3356 23.5069 12.3356 23.3539 12.3356 23.0989C12.3356 23.0819 12.3356 22.9628 12.4036 22.6908L14.682 13.6285Z" fill="black"/>
    <path d="M22.4729 12.2531C22.7449 12.2871 22.7676 12.2871 23.2663 12.4232C23.4364 12.4685 23.6857 12.5252 23.8671 12.5252C24.3091 12.5252 24.3318 12.1511 24.3318 12.1058C24.3318 11.9811 24.2751 11.6751 23.8671 11.6751C23.6064 11.6751 23.2663 11.7657 23.0623 11.8337C22.7676 11.9131 22.6996 11.9244 22.4729 11.9471C22.4955 11.6184 22.5296 11.2783 22.6429 10.5642C22.7109 10.2128 22.7563 9.86146 22.7563 9.51007C22.7563 9.34005 22.7109 9 22.3369 9C21.9061 9 21.9061 9.40806 21.9061 9.51007C21.9061 9.54408 21.9061 9.9408 22.0195 10.5642C22.1102 11.1536 22.1668 11.539 22.1895 11.9471C21.9175 11.9131 21.8948 11.9131 21.3961 11.7771C21.226 11.7317 20.9767 11.6751 20.7953 11.6751C20.3532 11.6751 20.3306 12.0491 20.3306 12.0945C20.3306 12.2191 20.3872 12.5252 20.7953 12.5252C21.056 12.5252 21.3961 12.4345 21.6001 12.3665C21.8948 12.2871 21.9628 12.2758 22.1895 12.2531C22.1668 12.5592 22.1215 12.7859 22.0535 13.0806C21.9061 13.806 21.9061 13.9194 21.9061 14.4975C21.9061 16.6171 22.1102 18.8614 22.1442 19.1788C22.1668 19.3375 22.1668 19.4168 22.3255 19.4168C22.4842 19.4168 22.4955 19.3375 22.5182 19.2015C22.5749 18.7254 22.6202 18 22.6542 17.5012C22.6882 17.0252 22.7563 15.597 22.7563 14.4975C22.7563 13.9874 22.7563 13.7947 22.6202 13.1826C22.6202 13.1486 22.4955 12.5819 22.4729 12.2531Z" fill="black"/>
  </symbol>
</svg>`
}
