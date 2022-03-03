import { ESLintUtils } from '@typescript-eslint/experimental-utils'

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/boon-tv/eslint-plugin/tree/main/src/rules/${name}.ts`
)
