import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        diagnostics: { warnOnly: true },
      },
    ],
  },
  moduleNameMapper: {
    "^@aht/config$": "<rootDir>/../../packages/config/src",
    "^@aht/database$": "<rootDir>/../../packages/database/src",
    "^@aht/types$": "<rootDir>/../../packages/types/src",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "<rootDir>/src/events/**/*.ts",
    "<rootDir>/src/crbl/**/*.ts",
    "!<rootDir>/src/**/*.module.ts",
    "!<rootDir>/src/**/*.constants.ts",
    "!<rootDir>/src/**main.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  verbose: true,
  testTimeout: 30000,
};

export default config;
