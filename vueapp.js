import Qemmet from './build/qemmet.js'

const app = new Vue({
	el: '#app',
	data: {
		raw_string: '3;;h2cx23cxh1m12cx23cz13',
		// raw_string:
		// 	'2;;sdgtdg csdgctdg sx/x csxc/x rx()ry()rz() crx()cry()crz() u1()u2(,)u3(,,) cu1()cu2(,)cu3(,,) sw csw ccsw b xyz cxcycz h ch p() cp() st csct i m',
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
