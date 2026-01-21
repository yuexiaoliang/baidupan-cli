// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
  },
  {
    rules: {
      // CLI needs console output
      'no-console': 'off',
      // Allow global process and Buffer in Node.js CLI
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'yaml/sort-keys': 'off',
    },
  },
)
