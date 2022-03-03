import { ESLintUtils } from '@typescript-eslint/experimental-utils'

export * from '@typescript-eslint/type-utils'
export * from './createRule'
export * from './createPreset'

const {
  getParserServices,
} = ESLintUtils

export {
  getParserServices
}