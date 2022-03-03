"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRule = void 0;
const experimental_utils_1 = require("@typescript-eslint/experimental-utils");
exports.createRule = experimental_utils_1.ESLintUtils.RuleCreator((name) => `https://github.com/boon-tv/eslint-plugin/tree/main/src/rules/${name}.ts`);
