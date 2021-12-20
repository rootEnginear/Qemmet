import { deepEqual, equal, throws } from 'assert'

import {
	parseQemmetString,
	expandStringRepeatSyntax,
	generateRange,
	expandRangeSyntax,
} from './qemmet'

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

	describe('expandStringRepeatSyntax', function () {
		function test(input: string, output: string) {
			return it(`should expand "${input}" into "${output}"`, function () {
				const expanded = expandStringRepeatSyntax(input)
				equal(expanded, output)
			})
		}

		// Normal Inteded way
		test(`'x'*3`, `xxx`)

		// Nesting
		test(`''x'*2'*3`, `xxxxxx`)
		test(`''x'*2y'*3`, `xxyxxyxxy`)
		test(`'''x'*2'*3'*2`, `xxxxxxxxxxxx`)
		test(`'h'x'*2'*3`, `hxxhxxhxx`)
		test(`'hx*2'*3`, `hx*2hx*2hx*2`)

		// Parameterized
		test(`'p[pi]'*2`, `p[pi]p[pi]`)

		// Outside quotes
		test(`'''x'*2'*2'`, `xxxx`)

		// Not balance
		test("''x''*2", 'x')
		test("'x'x''*2", 'xx')
		test("'x'x'x'*2", 'xxxx')
		test(`'''*2`, ``)
		test(`'''''*2`, ``)
		test(`'*5'*2`, `*5*2`)
		test(`''*5'*2'`, `*2`)
	})

	describe('generateRange', function () {
		function test(start: string, end: string, output: string) {
			return it(`should generate "${output}" from (${start}, ${end})`, function () {
				const expanded = generateRange(start, end)
				equal(expanded, output)
			})
		}

		test('1', '3', '1 2 3')
		test('3', '1', '3 2 1')
		test('3', '5', '3 4 5')
		test('5', '3', '5 4 3')
		test('9', '12', '9 10 11 12')
		test('12', '9', '12 11 10 9')
	})

	describe('expandRangeSyntax', function () {
		function test(input: string, output: string) {
			return it(`should expand "${input}" into "${output}"`, function () {
				const expanded = expandRangeSyntax(input)
				equal(expanded, output)
			})
		}

		// Normal way
		test('1-3', '1 2 3')
		test('3-1', '3 2 1')
		test('3-5', '3 4 5')
		test('5-3', '5 4 3')
		test('9-12', '9 10 11 12')
		test('12-9', '12 11 10 9')

		// Not intended way but usable
		test('1-3-5', '1 2 3 4 5')
		test('3-1-3', '3 2 1 2 3')
		test('9-12-10', '9 10 11 12 11 10')
	})
})
