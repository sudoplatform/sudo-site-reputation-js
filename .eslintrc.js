module.exports = {
  root: true,
  ignorePatterns: [
    '/build/',
    '/docs/',
    '/lib/',
    'cjs',
    'types',
    '/node_modules/',
  ],
  overrides: [
    {
      files: ['*.js'],
      parserOptions: { ecmaVersion: 2018 },
      env: { node: true },
    },
    {
      files: ['**/*.ts'],
      plugins: ['@typescript-eslint', 'import', 'jest', 'tree-shaking'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
      },
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      rules: {
        // Disallow `any`.  (This is overridden for test files, below)
        '@typescript-eslint/no-explicit-any': 'error',

        // Allow "newspaper" code structure
        '@typescript-eslint/no-use-before-define': 'off',

        // Allow TS convention of ignoring args
        // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#flag-unused-declarations-with---nounusedparameters-and---nounusedlocals
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_' },
        ],

        // Soften eslint defaults so that callbacks don't need to be as verbose
        '@typescript-eslint/explicit-function-return-type': [
          'error',
          {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
          },
        ],

        // Avoids side effects in initialization
        // https://www.npmjs.com/package/eslint-plugin-tree-shaking
        'tree-shaking/no-side-effects-in-initialization': [
          'error',
          {
            noSideEffectsWhenCalled: [{ module: 'io-ts', functions: ['type'] }],
          },
        ],
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Unit tests
    {
      files: ['**/*.spec.ts', 'src/utils/testing/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'tree-shaking/no-side-effects-in-initialization': 'off',
      },
      parserOptions: {
        project: './tsconfig.test.json',
      },
    },
    // System tests
    {
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'tree-shaking/no-side-effects-in-initialization': 'off',
      },
      parserOptions: {
        project: './tsconfig.system.json',
      },
    },
  ],
}
