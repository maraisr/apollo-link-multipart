import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';

const shared = () => ({
	external: [
		...require('module').builtinModules,
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
		/@apollo\/.*/
	],
	plugins: [
		resolve({ extensions: ['.js', '.ts'] }),
		typescript({
			check: false,
			useTsconfigDeclarationDir: true,
		}),
	],
});

export default {
	input: 'src/multipartLink.ts',
	output: [
		{
			format: 'esm',
			file: pkg.module,
			sourcemap: false,
		},
		{
			format: 'cjs',
			file: pkg.main,
			sourcemap: false,
		},
	],
	...shared(),
}
