import { parseQemmetString } from './build/qemmet.js'

import { translateQemmetString as getQiskitString } from './build/translators/qiskit.js'
import { translateQemmetString as getQASMString } from './build/translators/qasm3.js'
import { translateQemmetString as getQemmetString } from './build/translators/qemmet.js'
import { translateQemmetString as getSVG } from './build/translators/svg.js'

const EXAMPLES = [
	{
		code: '2;;h1cx12',
		name: "Bell's state",
	},
	{
		code: '2;2;hm',
		name: '2-bit randomizer',
	},
	{
		code: "4;3;x4h'ccx134h1-3x1-3ccz3-1x1-3h1-3'*2m1-3",
		name: "Grover's search",
	},
	{
		code: "3;;x4hh4'ccx134hxcczxh'*2m",
		name: "Grover's search as above, just shorter by using the <a href='https://github.com/rootEnginear/Qemmet/wiki/Failsafe-Mechanisms' target='_blank' rel='noopener nofollow noreferrer'>failsafe mechanisms</a>",
	},
	{
		code: '3;;h2cx23cxh1m12cx23cz13',
		name: 'Quantum teleportation',
	},
	{
		code: '3;;h2cx23cxh1m12x3?.1z3?1',
		name: "Quantum teleportation using <a href='https://github.com/rootEnginear/Qemmet/wiki/Classical-Condition' target='_blank' rel='noopener nofollow noreferrer'>classical condition</a>",
	},
	{
		code: '4;;h4p814p424p234h3p413p223h2p2h1sw14sw23;p8=cp[pi/8],p4=cp[pi/4],p2=cp[pi/2]',
		name: 'Quantum Fourier transform',
	},
	{
		code: '4;;hbh1m1p22?1h2m2p43?1p23?.1h3m3p84?1p44?.1p24?..1h4m4;p2=p[-pi/2],p4=p[-pi/4],p8=p[-pi/8]',
		name: 'Fourier sampling circuit',
	},
]

const DEFAULT_OPTIONS = {
	X_MARGIN: 8,
	Y_MARGIN: 16,
	KET_MARGIN: 4,
	LINE_TRAIL_LEFT: 12,
	LINE_TRAIL_RIGHT: 12,
	LINE_SPACE: 3,
	SVG_MARGIN: 8,
	BACKGROUND_COLOR: '#ffffff',
	LINE_COLOR: '#222222',
	FONT_COLOR: '#222222',
	GATE_BACKGROUND_COLOR: '#ffffff',
}

let background_color_timeout
let line_color_timeout
let font_color_timeout
let gate_background_color_timeout

new Vue({
	el: '#app',
	data: {
		EXAMPLES,
		raw_string: "4;3;x4 h 'ccx134 h1-3 x1-3 ccz3-1 x1-3 h1-3'*2 m1-3",
		// raw_string: '4;;h4p814p424p234h3p413p223h2p2h1sw14sw23;p8=cp[pi/8],p4=cp[pi/4],p2=cp[pi/2]',
		// raw_string: '2;;m->1',
		// raw_string: ';;x2h2EEFFEEFFEEFF;E=rm,F=rhcxhm',
		// raw_string: ';;h2cx23cxh1m12x3?2z3?1',
		// raw_string:
		// 	'3;;xx?1x1?1x12?1cx?1cx2?1p[]?1rx[]1?1ry[]12?1crz[]?1cu1[]2?1cu2[]?.1cu3[]2?1.101csw2?.10',
		// raw_string: ';;ccpccu3',
		target_lang: 'qiskit03',
		// target_lang: 'openqasm3',
		x_margin: DEFAULT_OPTIONS.X_MARGIN,
		y_margin: DEFAULT_OPTIONS.Y_MARGIN,
		ket_margin: DEFAULT_OPTIONS.KET_MARGIN,
		line_trail_left: DEFAULT_OPTIONS.LINE_TRAIL_LEFT,
		line_trail_right: DEFAULT_OPTIONS.LINE_TRAIL_RIGHT,
		line_space: DEFAULT_OPTIONS.LINE_SPACE,
		svg_margin: DEFAULT_OPTIONS.SVG_MARGIN,

		background_color_input: DEFAULT_OPTIONS.BACKGROUND_COLOR,
		line_color_input: DEFAULT_OPTIONS.LINE_COLOR,
		font_color_input: DEFAULT_OPTIONS.FONT_COLOR,
		gate_background_color_input: DEFAULT_OPTIONS.GATE_BACKGROUND_COLOR,

		background_color: DEFAULT_OPTIONS.BACKGROUND_COLOR,
		line_color: DEFAULT_OPTIONS.LINE_COLOR,
		font_color: DEFAULT_OPTIONS.FONT_COLOR,
		gate_background_color: DEFAULT_OPTIONS.GATE_BACKGROUND_COLOR,
	},
	computed: {
		qemmet_info: function () {
			try {
				return [parseQemmetString(this.raw_string), null]
			} catch (e) {
				return [null, `Hmm there are some errors: ${e.message}`]
			}
		},
		transpiled_code: function () {
			const [qemmet_info, error] = this.qemmet_info
			if (error) return error

			// console.log(qemmet_info.gate_info)
			// console.log(JSON.stringify(qemmet_info.gate_info, null, 2))
			console.log('Expanded string:', getQemmetString(qemmet_info))
			switch (this.target_lang) {
				case 'openqasm3':
					return getQASMString(qemmet_info)
				case 'svg':
					return this.svg
				default:
					return getQiskitString(qemmet_info)
			}
		},
		svg: function () {
			const options = {
				style: {
					X_MARGIN: this.x_margin,
					Y_MARGIN: this.y_margin,
					KET_MARGIN: this.ket_margin,
					LINE_TRAIL_LEFT: this.line_trail_left,
					LINE_TRAIL_RIGHT: this.line_trail_right,
					LINE_SPACE: this.line_space,
					SVG_MARGIN: this.svg_margin,
					BACKGROUND_COLOR: this.background_color,
					LINE_COLOR: this.line_color,
					FONT_COLOR: this.font_color,
					GATE_BACKGROUND_COLOR: this.gate_background_color,
				},
			}
			const [qemmet_info, error] = this.qemmet_info
			return error ? `<svg></svg>` : getSVG(qemmet_info, options)
		},
		svg_object_url: function () {
			const svg = this.svg
			const preface = '<?xml version="1.0" standalone="no"?>\r\n'
			const blob = new Blob([preface, svg], { type: 'image/svg+xml;charset=utf-8' })
			const url = URL.createObjectURL(blob)

			return url
		},
	},
	methods: {
		setQemmet: function (str) {
			this.raw_string = str
		},
		demonstration: function () {
			const original_raw_string = this.raw_string
			this.raw_string = ''
			;[...original_raw_string].forEach((c, i) => {
				setTimeout(() => (this.raw_string += c), 500 * i)
			})
		},
		copyTranspiledCode: function () {
			navigator.clipboard.writeText(this.transpiled_code).then(
				function () {
					console.log('Async: Copying to clipboard was successful!')
				},
				function (err) {
					console.error('Async: Could not copy text: ', err.message)
				}
			)
		},
		downloadSvg: function () {
			const url = this.svg_object_url

			const a = document.createElement('a')
			a.download = 'qemmet.svg'
			a.href = url
			a.click()
		},
		downloadPng: function () {
			const url = this.svg_object_url

			const img = new Image()
			const canvas = document.createElement('canvas')
			const ctx = canvas.getContext('2d')

			img.onload = function () {
				canvas.width = img.width * 3
				canvas.height = img.height * 3
				ctx.scale(3, 3)
				ctx.drawImage(img, 0, 0)

				const a = document.createElement('a')
				a.download = 'qemmet.png'
				a.href = canvas.toDataURL('image/png')
				a.click()
			}

			img.src = url
		},
	},
	watch: {
		background_color_input: function () {
			clearTimeout(background_color_timeout)
			background_color_timeout = setTimeout(() => {
				this.background_color = this.background_color_input
			}, 100)
		},
		line_color_input: function () {
			clearTimeout(line_color_timeout)
			line_color_timeout = setTimeout(() => {
				this.line_color = this.line_color_input
			}, 100)
		},
		font_color_input: function () {
			clearTimeout(font_color_timeout)
			font_color_timeout = setTimeout(() => {
				this.font_color = this.font_color_input
			}, 100)
		},
		gate_background_color_input: function () {
			clearTimeout(gate_background_color_timeout)
			gate_background_color_timeout = setTimeout(() => {
				this.gate_background_color = this.gate_background_color_input
			}, 100)
		},
	},
})
