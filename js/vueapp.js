import Qemmet from './qemmet.js'

const app = new Vue({
	el: '#app',
	data: {
		raw_string: '2;;h1cx',
		target_lang: 'qiskit03',
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
			switch (this.target_lang) {
				case 'openqasm3':
					return this.qemmet_info.toQASMString()
				default:
					return this.qemmet_info.toQiskitString()
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
