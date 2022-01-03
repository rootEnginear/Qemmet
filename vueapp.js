import { parseQemmetString } from './build/qemmet.js'

import { translateQemmetString as getQiskitString } from './build/translators/qiskit.js'
import { translateQemmetString as getQASMString } from './build/translators/qasm3.js'
import { translateQemmetString as getQemmetString } from './build/translators/qemmet.js'
import { translateQemmetString as getSVG } from './build/translators/svg.js'

new Vue({
	el: '#app',
	data: {
		// raw_string: '2;;hh1h2h3',
		raw_string: "4;3;x4h'ccx134h1-3x1-3ccz1-3x1-3h1-3'*2m1-3",
		// raw_string: '4;;h4p814p424p234h3p413p223h2p2h1sw14sw23;p8=cp[pi/8],p4=cp[pi/4],p2=cp[pi/2]',
		// raw_string:
		// 	'2;;xyzhssdgttdgp[pi]/xsxrxryrzu1u2u3[3*pi/4,3*pi/4,3*pi/4]iswbmcxcyczchcscsdgctctdgcp[pi]c/xcsxcrxcrycrzcu1cu2cu3cicscwcbcm',
		target_lang: 'qiskit03',
		// target_lang: 'openqasm3',
	},
	computed: {
		qemmet_info: function () {
			try {
				return parseQemmetString(this.raw_string || ';;')
			} catch (e) {
				return `Hmm there are some errors: ${e.message}`
			}
		},
		transpiled_code: function () {
			if (typeof this.qemmet_info === 'string') return this.qemmet_info
			console.log('Expanded string:', getQemmetString(this.qemmet_info))
			switch (this.target_lang) {
				case 'openqasm3':
					return getQASMString(this.qemmet_info)
				case 'svg':
					return this.svg
				default:
					return getQiskitString(this.qemmet_info)
			}
		},
		svg: function () {
			return getSVG(this.qemmet_info)
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
