import { QemmetGateInfo, QemmetParserOutput, QemmetStringOptions } from './types'

import { deepEqual, equal, throws } from 'assert'

import {
	parseQemmetString,
	expandStringRepeatSyntax,
	expandCharRepeatSyntax,
	expandRepeatSyntax,
	generateRange,
	expandRangeSyntax,
	ensureParameterizedGate,
	ensureInstruction,
	transformOptionString,
} from './qemmet'

describe('Qemmet', function () {
	describe('parseQemmetString', function () {
		it('should parse ";;x" without error', function () {
			parseQemmetString(';;x')
		})
		it('should parse ";;" with error', function () {
			throws(function () {
				parseQemmetString(';;')
			}, new Error('`gates_string` part does not found. Required at least 1 gate.'))
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

		// Normal Intended way
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

	describe('expandCharRepeatSyntax', function () {
		function test(input: string, output: string) {
			return it(`should expand "${input}" into "${output}"`, function () {
				const expanded = expandCharRepeatSyntax(input)
				equal(expanded, output)
			})
		}

		// Normal Intended way
		test(`x*3`, `xxx`)

		// Nesting
		test(`x*2*3`, `xxxx`)
		test(`x*2y*3`, `xxyyy`)

		// Eh?
		test(`**3`, ``)
	})

	describe('expandRepeatSyntax CROSSCHECK', function () {
		function test(input: string, output: string) {
			return it(`should expand "${input}" into "${output}"`, function () {
				const expanded = expandRepeatSyntax(input)
				equal(expanded, output)
			})
		}

		// Normal Intended way
		test(`'x*3y'*2`, `xxxyxxxy`)

		// * as params
		test(`'p[3*pi/2]'*2`, `p[3*pi/2]p[3*pi/2]`)
	})

	describe('generateRange', function () {
		function test(start: string, end: string, output: string) {
			return it(`should generate "${output}" from (${start}, ${end})`, function () {
				const expanded = generateRange(start, end)
				equal(expanded, output)
			})
		}

		// Only check whole number because the input will
		// always be a whole number (no minus sign, no dot)
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

		// Invalid range
		test('A-5', 'A5')
		test('5-A', '5A')
		test('A-Z', 'AZ')
		test('3-5.5', '3 4 5.5')
		test('3.2-5.5', '3.2 3 4 5.5')
		test('-3--1', '31')
		test('-3-1', '3 2 1')
		test('5-', '5')
		test('-5', '5')
		test('5--', '5')
		test('--5', '5')
		test('2-5-', '2 3 4 5')
		test('-5-3', '5 4 3')
		test('-7-5-', '7 6 5')
		test('1-A-5', '1A5')
		test('G-1-5', 'G1 2 3 4 5')
		test('8-10-Y', '8 9 10Y')
		test('1--A-5', '1A5')
		test('G-1--5', 'G15')
		test('8--10-Y', '810Y')
		test('1--3', '13')
		test('3--1', '31')
		test('3--5', '35')
		test('5--3', '53')
		test('9--12', '912')
		test('12--9', '129')
	})

	describe('ensureParameterizedGate', function () {
		function test(input: QemmetGateInfo, output: string) {
			return it(`should fix "${input.gate_params}" of the gate "${input.gate_name}" into "${output}"`, function () {
				const expanded = ensureParameterizedGate([input])[0].gate_params
				equal(expanded, output)
			})
		}

		function generate_input(gate_name: string, gate_params: string): QemmetGateInfo {
			return { control_count: 0, gate_name, gate_params, gate_registers: [0] }
		}

		// 0 params required
		test(generate_input('x', '0'), '')
		test(generate_input('y', '0'), '')
		test(generate_input('z', '0'), '')
		test(generate_input('h', '0'), '')

		// 1 param required
		test(generate_input('p', ''), `0`)
		test(generate_input('p', '1'), `1`)
		test(generate_input('p', '1,2'), `1`)
		test(generate_input('rx', ''), `0`)
		test(generate_input('rx', '1'), `1`)
		test(generate_input('rx', '1,2'), `1`)
		test(generate_input('ry', ''), `0`)
		test(generate_input('ry', '1'), `1`)
		test(generate_input('ry', '1,2'), `1`)
		test(generate_input('rz', ''), `0`)
		test(generate_input('rz', '1'), `1`)
		test(generate_input('rz', '1,2'), `1`)
		test(generate_input('u1', ''), `0`)
		test(generate_input('u1', '1'), `1`)
		test(generate_input('u1', '1,2'), `1`)

		// 2 params required
		test(generate_input('u2', ''), `0, 0`)
		test(generate_input('u2', '1'), `1, 0`)
		test(generate_input('u2', '1,2'), `1, 2`)
		test(generate_input('u2', '1,2,3'), `1, 2`)

		// 3 params required
		test(generate_input('u3', ''), `0, 0, 0`)
		test(generate_input('u3', '1'), `1, 0, 0`)
		test(generate_input('u3', '1,2'), `1, 2, 0`)
		test(generate_input('u3', '1,2,3'), `1, 2, 3`)
		test(generate_input('u3', '1,2,3,4'), `1, 2, 3`)
	})

	describe('ensureInstruction', function () {
		function test(input: QemmetGateInfo, output: number) {
			return it(`should fix "${input.control_count}" of the gate "${input.gate_name}" into "${output}"`, function () {
				const expanded = ensureInstruction([input])[0].control_count
				equal(expanded, output)
			})
		}

		function generate_input(gate_name: string, control_count: number): QemmetGateInfo {
			return { control_count, gate_name, gate_params: '', gate_registers: [0] }
		}

		test(generate_input('x', 0), 0)
		test(generate_input('x', 1), 1)
		test(generate_input('y', 0), 0)
		test(generate_input('y', 1), 1)
		test(generate_input('z', 0), 0)
		test(generate_input('z', 1), 1)
		test(generate_input('h', 0), 0)
		test(generate_input('h', 1), 1)

		test(generate_input('b', 0), 0)
		test(generate_input('b', 1), 0)
		test(generate_input('m', 0), 0)
		test(generate_input('m', 1), 0)
	})

	describe('transformOptionString', function () {
		function test(input: string, output: QemmetStringOptions) {
			return it(`should transform "${input}" to "${output}"`, function () {
				const expanded = transformOptionString(input)
				deepEqual(expanded, output)
			})
		}

		test('00', { start_from_one: false, normalize_adjacent_gates: false })
		test('01', { start_from_one: false, normalize_adjacent_gates: true })
		test('0 ', { start_from_one: false, normalize_adjacent_gates: true /* default */ })
		test('10', { start_from_one: true, normalize_adjacent_gates: false })
		test('11', { start_from_one: true, normalize_adjacent_gates: true })
		test('1 ', { start_from_one: true, normalize_adjacent_gates: true /* default */ })
		test(' 0', { start_from_one: true /* default */, normalize_adjacent_gates: false })
		test(' 1', { start_from_one: true /* default */, normalize_adjacent_gates: true })
		test('  ', { start_from_one: true /* default */, normalize_adjacent_gates: true /* default */ })
	})
})
