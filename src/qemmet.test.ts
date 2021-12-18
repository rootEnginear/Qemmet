import { throws } from 'assert'

import { parseQemmetString } from './qemmet'

describe('Qemmet', function () {
	describe('parseQemmetString', function () {
		it('should parse valid string without error', function () {
			parseQemmetString(';;x')
		})
		it('should parse invalid string with error', function () {
			throws(
				function() {
					parseQemmetString(';;')
				},
				new Error('`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`')
			)
		})
	})
})
