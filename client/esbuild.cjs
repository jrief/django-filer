const { build } = require('esbuild');
const buildOptions = require('yargs-parser')(process.argv.slice(2), {
  boolean: ['debug'],
});

build({
  entryPoints: ['client/filer.tsx'],
  bundle: true,
  minify: !buildOptions.debug,
  sourcemap: buildOptions.debug,
  outfile: 'filer/static/admin/filer/js/filer.js',
  splitting: false,
  format: 'esm',
  jsx: 'automatic',
  plugins: [],
  loader: {'.svg': 'text', '.jsx': 'jsx' },
  target: ['es2020', 'chrome84', 'firefox84', 'safari14', 'edge84']
}).catch(() => process.exit(1));
