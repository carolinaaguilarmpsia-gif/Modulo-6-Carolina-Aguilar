/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  watchman: false,
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'backend/tsconfig.json',
      },
    ],
  },
  testMatch: [
    '**/backend/domain/**/*.test.ts',
    '**/backend/infrastructure/mcp/**/*.test.ts',
    '**/backend/infrastructure/persistence/**/*.test.ts',
  ],
};
