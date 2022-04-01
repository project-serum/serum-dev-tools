/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest/presets/default",
  testEnvironment: "node",
  collectCoverage: true,
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/"],
  roots: ["<rootDir>/tests"],
  testTimeout: 90000,
  resolver: "ts-jest-resolver",
};
