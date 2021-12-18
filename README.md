# Qemmet
A way to generate a Qiskit 0.3X or OpenQASM 3.0 code with a shorthand notation.

## A shorthand notation?
Well, I was creating some random circuits in Qiskit and I'm kind of lazy. So I thought, "It would be cool if we had something like Emmet, but in Quantum". So I create a new syntax that can hold enough information about a circuit and, yeah, this is it. Now I can write a simple Bell's state in a syntax of `h1cx12` instead of a lengthy `qc.h(0)` and `qc.cx(0,1)`.
## How does this work?
You can checkout the syntax in the [playground website](https://rootenginear.github.io/Qemmet/)!

## How can I use this with my project?
You can download the compiled build in the `build` folder and include it in your project like this

```html
<script type="module">
    import Qemmet from 'qemmet.js';
</script>
```

To parse a Qemmet string, use the function `parseQemmetString(qemmet_string)`.

```js
const parsed_qemmet = Qemmet.parseQemmetString("2;;h1cx");
```

After parsing, you can translate the output into the target language by importing the translating module(s).

```js
import getQiskitString from 'translators/qiskit.js';

getQiskitString(parsed_qemmet);
```