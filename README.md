# Qemmet
A way to generate a Qiskit 0.3 or OpenQASM 3.0 code with a shorthand notation.

## How does this work?
The syntax consists mainly of 3 parts:

```
<quantum_register_num>;<classical_register_num>;<gate_string>
```

*   The `quantum_register_num` is an integer used to specify the number of qubits in the quantum register. It is optional and defaults to 1.
*   The `classical_register_num` is an integer used to specify the number of bits in the classical register. It is optional and defaults to 0.
*   The `gate_string` is a string in the form of:
    ```
    (?:c*?(?:[st]dg|[s/]x|r[xyz]|u[123]|sw|[bxyzhpstmi])(?:\(.*?\))*[\d\s]*)+
    ```
    <small>[See the visualization](https://regexper.com/#%28%3F%3Ac*%3F%28%3F%3A%5Bst%5Ddg%7C%5Bs%2F%5Dx%7Cr%5Bxyz%5D%7Cu%5B123%5D%7Csw%7C%5Bbxyzhpstmi%5D%29%28%3F%3A%5C%28.*%3F%5C%29%29*%5B%5Cd%5Cs%5D*%29%2B)</small>

As you can see, the `quantum_register_num` and `classical_register_num` is very simple. Now, the `gate_string` part might look very complicated, but the real structure of it is actually very simple:
```
<control_string><gate>(<params>)<qubits>
```

So, how do I start to input my gates?

1.  First, you have to think if your gate you're going to enter will have any controls. If yes, enter the character `c` as much as you want. If not, just skip this part.
2.  Then, you type your gate name which can be found below.
3.  After that, if your gate requires for a parameter, you enter that by surrounding it with a pair of parentheses (Well, if it's not required, you just skip this step without entering any parentheses). If your gate requires more than one parameter, you separate them with a comma. If a comma is adjacent to the other one, being the first, or the last, the 0 will be filled accordingly. For example: `()` is equal to `(0)`, `(,)` is equal to `(0,0)`, `(,,)` is equal to `(0,0,0)`. There are 3 constants supported: `pi`, `tau`, and `euler`. I imported them from numpy.
4.  Finally, you enter the qubit(s) you want to apply. There are some rules apply for shorthand-ness:

    **Case 1:** No number is entered

    *   If no number is entered and it is **a single-qubit gate**, it will apply that gate to **all** of specified qubits.
    *   If no number is entered and it is **a multiple-qubit gate** (maybe with a control modifier or it's a swap gate), it will apply to qubit 1 2 (3 4 ... if there are a lot of controls).
    
    **Case 2:** A number **without any spaces** is entered

    *   If a number is entered with no spaces, it will be treated as a single digit packed together. For example: `123` means qubit 1, 2, and 3.
    
    **Case 3:** Some spaces is entered

    *   If there are some spaces present **at the first or between** the numbers. It will considered as "seperated qubits". For example: `12 3` means qubit 12 and 3, ` 12` means qubit 12 (you see the tiny space in front of the number, right?

There you have it! Now you repeat these steps for the next gate and keep entering them one by one without any spaces. If you're still not understand it, that's fine! You can see more examples below to grasp more concept around the syntax.

**Notes:**

*   For ease of human counting, **the register starts from 1**, not 0.
*   Currently this is only a parser, **not a syntax checker**, so please check the syntax again by yourself.
*   This is a prototype right now. And the code itself is super spaghetti, but if you can stand them and want to add something just open a pull request!

## Available gates/instructions:

*   `x`: Pauli-X gate
*   `y`: Pauli-Y gate
*   `z`: Pauli-Z gate
*   `h`: Hadamard gate
*   `s`: S gate
*   `sdg`: Sdag gate
*   `t`: T gate
*   `tdg`: Tdag gate
*   `p`: Phase gate
*   `sx` (`/x`): Sqrt(X) gate
*   `rx`: Rotation about X gate
*   `ry`: Rotation about Y gate
*   `rz`: Rotation about Z gate
*   `u1`: U1 gate
*   `u2`: U2 gate
*   `u3`: U3 gate
*   `i`: Identity gate
*   `sw`: Swap gate
*   `b`: Barrier instruction
*   `m`: Measure instruction

## Single gate input with/without modifier and its outputs:

*   `x`: Apply the X gate to all qubits.
*   `x12`: Apply the X gate to qubit 1 and 2.
*   `x12 10`: Apply the X gate to qubit 12 and 10.
*   `x 12`: Apply the X gate to qubit 12.
*   `cx`: Apply the CX gate to qubit 1 and 2, where 1 is the control and 2 is the target.
*   `ccx`: Apply the CX gate to qubit 1, 2, and 3, where 1 and 2 is the control and 3 is the target.
*   `cx34`: Apply the CX gate to qubit 3 and 4, where 3 is the control and 4 is the target.
*   `cx 10 1`: Apply the CX gate to qubit 10 and 1, where 10 is the control and 1 is the target.
*   `cccccx123456`: Apply the CCCCCX gate to qubit 1, 2, 3, 4, 5, and 6 where 1, 2, 3, 4, 5 are the controls and 6 is the target.
*   `cccx12 1 11 9`: Apply the CCCX gate to qubit 12, 1, 11 and 9 where 12, 1, and 11 are the controls and 9 is the target.
*   `rz(pi)1`: Apply rotation about Z gate to qubit 1 with a theta of pi
*   `crz(pi)12`: Apply controlled rotation about Z gate to quantum register 1 and 2, where 1 is the control and 2 is the target with a theta of pi.
*   `cu3(pi,,)34`: Apply controlled U3 gate to qubit 3 and 4, where 3 is the control and 4 is the target with values of theta, phi, and lambda of pi, 0, and 0\.
*   `u2(,tau)`: Apply U2 gate to all qubits with a theta and pi of 0 and tau
*   `x12h`: Apply the X gate to qubit 1 and 2, then apply the H gate to all qubits.
*   `hx12`: Apply the H gate to all qubits, then apply the X gate to qubit 1 and 2.

## Example circuits:

*   `2;;h1cx`: Bell's state.
*   `;1;hm`: 1-bit randomizer.
*   `4;3;x4hccx134h123x123ccz123x123h123ccx134h123x123ccz123x123h123m123`: Grover's search.
*   `3;;h2cx23cxh1m12cx23cz13`: Quantum teleportation.
*   `4;4;h4cp(pi/8)14cp(pi/4)24cp(pi/2)34h3cp(pi/4)13cp(pi/2)23h2cp(pi/2)h1sw14sw23`: Quantum Fourier transform
