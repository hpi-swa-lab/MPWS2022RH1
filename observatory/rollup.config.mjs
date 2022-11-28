import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript  from '@rollup/plugin-typescript';

export default [
    {
        input: "assets/js/src/main.ts",
        output: {
            name: "Observatory",
            file: "assets/js/dist/observatory.umd.js",
            format: 'umd', // browser-friendly UMD build for both browsers and Node.js:
        },
        plugins: [
            nodeResolve(), // so rollup can find node modules
            typescript(),
        ]
    }
]