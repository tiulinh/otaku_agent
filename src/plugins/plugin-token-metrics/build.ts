#!/usr/bin/env bun
/**
 * Build script for plugin-token-metrics
 */

async function build() {
  console.log('Building plugin-token-metrics...');

  const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'node',
    format: 'esm',
    external: [
      '@elizaos/core',
      'tmai-api',
    ],
    sourcemap: 'external',
    minify: false,
  });

  if (!result.success) {
    console.error('Build failed');
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log('Build completed successfully!');
  console.log(`Generated ${result.outputs.length} output(s)`);
}

build().catch((error) => {
  console.error('Build script error:', error);
  process.exit(1);
});
