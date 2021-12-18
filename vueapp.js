import Qemmet from './build/qemmet.js'

import QiskitTranslator from './build/translators/qiskit.js'
import QASMTranslator from './build/translators/qasm3.js'

new Vue({
	el: '#app',
	data: {
		raw_string: '4;3;x4h[ccx134h1-3x1-3ccz1-3x1-3h1-3]*2m1-3',
		target_lang: 'qiskit03',
		// target_lang: 'openqasm3',
	},
	computed: {
		qemmet_info: function () {
			try {
				return Qemmet.parseQemmetString(this.raw_string || ';;')
			} catch (e) {
				return `Hmm there are some errors: ${e.message}`
			}
		},
		transpiled_code: function () {
			if (typeof this.qemmet_info === 'string') return this.qemmet_info
			console.log('Expanded string:', this.qemmet_info.expanded_string)
			switch (this.target_lang) {
				case 'openqasm3':
					return QASMTranslator.getQASMString(this.qemmet_info)
				default:
					return QiskitTranslator.getQiskitString(this.qemmet_info)
			}
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
	},
})
