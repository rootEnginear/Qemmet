import { deepEqual, equal, throws } from 'assert'

import { parseQemmetString } from './qemmet'

describe('Qemmet', function () {
	describe('parseQemmetString', function () {
		it('should parse ";;x" without error', function () {
			parseQemmetString(';;x')
		})
		it('should parse ";;" with error', function () {
			throws(function () {
				parseQemmetString(';;')
			}, new Error(
				'`gates_string` not found. The required format is `quantum_register?;classical_register?;gates_string`'
			))
		})

		it('shoud parse ";;ccx" as same as ";;ccx012"', function () {
			const parsed = parseQemmetString(';;ccx')
			const expected = parseQemmetString(';;ccx123')
			deepEqual(parsed, expected)
		})
		it('shoud parse ";;ccx3" as same as ";;ccx312"', function () {
			const parsed = parseQemmetString(';;ccx3')
			const expected = parseQemmetString(';;ccx312')
			deepEqual(parsed, expected)
		})
	})
})
