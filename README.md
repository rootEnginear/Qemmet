# Qemmet
A shorthand notation for generating a quantum circuit.

## A shorthand notation?
Well, I was creating some random circuits in Qiskit and I'm kind of lazy. So I thought, "It would be cool if we had something like Emmet, but in Quantum". So I create a new syntax that can hold enough information about a circuit and, yeah, this is it. Now I can write a simple Bell's state in a syntax of `h1cx12` instead of a lengthy `qc.h(0)` and `qc.cx(0,1)`.

## How does this work?
Good question! Since writing all of the rules here are going to be pretty long and boring, I suggest you to look up our [wiki](https://github.com/rootEnginear/Qemmet/wiki) to learn more about the syntax and mechanics behind Qemmet. When you're ready, you can try the syntax out in our [playground website](https://rootenginear.github.io/Qemmet/) too!

## How can I use this with my project?
You can download the compiled build in the `build` folder. You will required to import the parser and (at least) one translator as modules into your HTML file like this:

```html
<script type="module">
    import { parseQemmetString } from 'qemmet.js';
    import { translateQemmetString } from 'translators/qiskit.js';
</script>
```

First, you need to parse a Qemmet string by using the function `parseQemmetString(qemmet_string)`.

```js
const parsed_qemmet = parseQemmetString("2;;h1cx");
```

After the parsing, you can translate the output into the target language by using the function `translateQemmetString(parsed_qemmet)` from the translating module.

```js
const output = translateQemmetString(parsed_qemmet);
```

If you have multiple translating modules, you can rename each of them to differentiate the languages.

```js
import { translateQemmetString as getQiskitString } from 'translators/qiskit.js';
import { translateQemmetString as getQASMString } from 'translators/qasm3.js';

const qiskit_code = getQiskitString(parsed_qemmet);
const qasm3_code = getQASMString(parsed_qemmet);
```
