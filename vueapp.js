new Vue({
	el: '#app',
	data: {
		raw_string: '2;;h1cx',
		target_lang: 'qiskit03',
	},
	computed: {
		transpiled_code: function () {
			try {
				switch (this.target_lang) {
					case 'qiskit03':
						return getQiskitString(this.raw_string || ';;')
					default:
						return getOpenQASMString(this.raw_string || ';;')
				}
			} catch (e) {
				return `Hmm there are some errors: ${e.message}`
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
