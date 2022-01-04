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
		code: "4;3;x4 h 'ccx134 h1-3 x1-3 ccz3-1 x1-3 h1-3'*2 m1-3",
		name: "Grover's search",
	},
	{
		code: "3;;x4hh4'ccx134hxcczxh'*2m",
		name: "Grover's search as above, just shorter by using the failsafe mechanisms",
	},
	{
		code: '3;;h2cx23cxh1m12cx23cz13',
		name: 'Quantum teleportation',
	},
	{
		code: '4;;h4p814p424p234h3p413p223h2p2h1sw14sw23;p8=cp[pi/8],p4=cp[pi/4],p2=cp[pi/2]',
		name: 'Quantum Fourier transform',
	},
]

const DEFAULT_OPTIONS = {
	X_MARGIN: 8,
	Y_MARGIN: 16,
	KET_MARGIN: 8,
	LINE_TRAIL_LEFT: 12,
	LINE_TRAIL_RIGHT: 12,
	LINE_SPACE: 3,
	PARAM_Y_SHIFT: -1,
	SVG_MARGIN: 8,
}

new Vue({
	el: '#app',
	data: {
		EXAMPLES,
		raw_string: "4;3;x4 h 'ccx134 h1-3 x1-3 ccz3-1 x1-3 h1-3'*2 m1-3",
		// raw_string: '4;;h4p814p424p234h3p413p223h2p2h1sw14sw23;p8=cp[pi/8],p4=cp[pi/4],p2=cp[pi/2]',
		target_lang: 'qiskit03',
		// target_lang: 'openqasm3',
		x_margin: DEFAULT_OPTIONS.X_MARGIN,
		y_margin: DEFAULT_OPTIONS.Y_MARGIN,
		ket_margin: DEFAULT_OPTIONS.KET_MARGIN,
		line_trail_left: DEFAULT_OPTIONS.LINE_TRAIL_LEFT,
		line_trail_right: DEFAULT_OPTIONS.LINE_TRAIL_RIGHT,
		line_space: DEFAULT_OPTIONS.LINE_SPACE,
		param_y_shift: DEFAULT_OPTIONS.PARAM_Y_SHIFT,
		svg_margin: DEFAULT_OPTIONS.SVG_MARGIN,
	},
	computed: {
		qemmet_info: function () {
			try {
				return [parseQemmetString(this.raw_string || ';;'), null]
			} catch (e) {
				return [null, `Hmm there are some errors: ${e.message}`]
			}
		},
		transpiled_code: function () {
			const [qemmet_info, error] = this.qemmet_info
			if (error) return error

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
					PARAM_Y_SHIFT: this.param_y_shift,
					SVG_MARGIN: this.svg_margin,
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
			// this.raw_string = ''
			// ;[...str].forEach((c, i) => {
			// 	setTimeout(() => (this.raw_string += c), 50 * i)
			// })
			this.raw_string = str
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
})
