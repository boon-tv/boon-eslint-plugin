import {
  AST_NODE_TYPES,
  ParserServices,
  TSESTree,
} from '@typescript-eslint/experimental-utils'
import * as tsutils from 'tsutils'
import * as ts from 'typescript'
import * as util from '../util'

export type Options = []

export type MessageId =
  | 'conditionErrorOther'
  | 'conditionErrorAny'
  | 'conditionErrorNullish'
  | 'conditionErrorString'
  | 'conditionErrorNumber'
  | 'conditionErrorObject'
  | 'noStrictNullCheck'

export default util.createRule<Options, MessageId>({
  name: 'strict-short-circuit-expressions',
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description: 'Restricts the types allowed in boolean expressions',
      recommended: false,
      requiresTypeChecking: true,
    },
    schema: [
      {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    ],
    messages: {
      conditionErrorOther:
        'Unexpected value in conditional. ' +
        'A boolean expression is required.',
      conditionErrorAny:
        'Unexpected any value in conditional. ' +
        'An explicit comparison, type cast or double negation is required.',
      conditionErrorNullish:
        'Unexpected nullish value in conditional. ' +
        'An explicit comparison, type cast or double negation is required.',
      conditionErrorString:
        'Unexpected string value in conditional. ' +
        'An explicit comparison, type cast or double negation is required.',
      conditionErrorNumber:
        'Unexpected number value in conditional. ' +
        'An explicit comparison, type cast or double negation is required.',
      conditionErrorObject:
        'Unexpected object value in conditional. ' +
        'TAn explicit comparison, type cast or double negation is required.',
      noStrictNullCheck:
        'This rule requires the `strictNullChecks` compiler option to be turned on to function correctly.',
    },
  },
  defaultOptions: [],
  create(context) {
    const parserServices = util.getParserServices(context)
    const typeChecker = parserServices.program.getTypeChecker()
    const compilerOptions = parserServices.program.getCompilerOptions()
    const sourceCode = context.getSourceCode()
    const isStrictNullChecks = tsutils.isStrictCompilerOptionEnabled(
      compilerOptions,
      'strictNullChecks'
    )

    if (!isStrictNullChecks) {
      context.report({
        loc: {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 0 },
        },
        messageId: 'noStrictNullCheck',
      })
    }

    const checkedNodes = new Set<TSESTree.Node>()

    return {
      'LogicalExpression[operator!="??"]': checkNode,
    }

    /**
     * This function analyzes the type of a node and checks if it is allowed in a boolean context.
     * It can recurse when checking nested logical operators, so that only the outermost operands are reported.
     * The right operand of a logical expression is ignored unless it's a part of a test expression (if/while/ternary/etc).
     * @param node The AST node to check.
     * @param isTestExpr Whether the node is a descendant of a test expression.
     */
    function checkNode(node: TSESTree.Node, isTestExpr = false): void {
      // prevent checking the same node multiple times
      if (checkedNodes.has(node)) {
        return
      }
      checkedNodes.add(node)

      // for logical operator, we check its operands
      if (
        node.type === AST_NODE_TYPES.LogicalExpression &&
        node.operator !== '??'
      ) {
        checkNode(node.left, isTestExpr)

        // we ignore the right operand when not in a context of a test expression
        if (isTestExpr) {
          checkNode(node.right, isTestExpr)
        }
        return
      }

      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node)
      const type = util.getConstrainedTypeAtLocation(typeChecker, tsNode)
      const types = inspectVariantTypes(tsutils.unionTypeParts(type))

      const is = (...wantedTypes: readonly VariantType[]): boolean =>
        types.size === wantedTypes.length &&
        wantedTypes.every((type) => types.has(type))

      // allowed types
      if (
        is('boolean') ||
        is('truthy boolean') ||
        is('nullish', 'truthy boolean') ||
        is('nullish', 'boolean') ||
        is('never')
      ) {
        return
      }

      // nullish
      if (is('nullish')) {
        if (
          !isLogicalNegationExpression(node.parent!) &&
          !belongsToConditionalStatementTest(node)
        ) {
          context.report({ node, messageId: 'conditionErrorNullish' })
        }
        return
      }

      // string
      if (is('string') || is('truthy string') || is('nullish', 'string')) {
        if (
          !isLogicalNegationExpression(node.parent!) &&
          !belongsToConditionalStatementTest(node)
        ) {
          context.report({
            node,
            messageId: 'conditionErrorString',
          })
        }
        return
      }

      // number
      if (is('number') || is('truthy number') || is('nullish', 'number')) {
        if (
          !isLogicalNegationExpression(node.parent!) &&
          !belongsToConditionalStatementTest(node)
        ) {
          context.report({
            node,
            messageId: 'conditionErrorNumber',
          })
        }
        return
      }

      // object
      if (is('object') || is('nullish', 'object')) {
        if (
          !isLogicalNegationExpression(node.parent!) &&
          !belongsToConditionalStatementTest(node)
        ) {
          context.report({
            node,
            messageId: 'conditionErrorObject',
          })
        }
        return
      }

      // any
      if (is('any')) {
        if (
          !isLogicalNegationExpression(node.parent!) &&
          !belongsToConditionalStatementTest(node)
        ) {
          context.report({
            node,
            messageId: 'conditionErrorAny',
          })
        }
        return
      }

      // other
      context.report({ node, messageId: 'conditionErrorOther' })
    }

    /** The types we care about */
    type VariantType =
      | 'nullish'
      | 'boolean'
      | 'truthy boolean'
      | 'string'
      | 'truthy string'
      | 'number'
      | 'truthy number'
      | 'object'
      | 'any'
      | 'never'

    /**
     * Check union variants for the types we care about
     */
    function inspectVariantTypes(types: ts.Type[]): Set<VariantType> {
      const variantTypes = new Set<VariantType>()

      if (
        types.some((type) =>
          tsutils.isTypeFlagSet(
            type,
            ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.VoidLike
          )
        )
      ) {
        variantTypes.add('nullish')
      }
      const booleans = types.filter((type) =>
        tsutils.isTypeFlagSet(type, ts.TypeFlags.BooleanLike)
      )

      // If incoming type is either "true" or "false", there will be one type
      // object with intrinsicName set accordingly
      // If incoming type is boolean, there will be two type objects with
      // intrinsicName set "true" and "false" each because of tsutils.unionTypeParts()
      if (booleans.length === 1) {
        tsutils.isBooleanLiteralType(booleans[0], true)
          ? variantTypes.add('truthy boolean')
          : variantTypes.add('boolean')
      } else if (booleans.length === 2) {
        variantTypes.add('boolean')
      }

      const strings = types.filter((type) =>
        tsutils.isTypeFlagSet(type, ts.TypeFlags.StringLike)
      )

      if (strings.length) {
        if (
          strings.some((type) => type.isStringLiteral() && type.value !== '')
        ) {
          variantTypes.add('truthy string')
        } else {
          variantTypes.add('string')
        }
      }

      const numbers = types.filter((type) =>
        tsutils.isTypeFlagSet(
          type,
          ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike
        )
      )
      if (numbers.length) {
        if (
          numbers.some((type) => type.isNumberLiteral() && type.value !== 0)
        ) {
          variantTypes.add('truthy number')
        } else {
          variantTypes.add('number')
        }
      }

      if (
        types.some(
          (type) =>
            !tsutils.isTypeFlagSet(
              type,
              ts.TypeFlags.Null |
                ts.TypeFlags.Undefined |
                ts.TypeFlags.VoidLike |
                ts.TypeFlags.BooleanLike |
                ts.TypeFlags.StringLike |
                ts.TypeFlags.NumberLike |
                ts.TypeFlags.BigIntLike |
                ts.TypeFlags.TypeParameter |
                ts.TypeFlags.Any |
                ts.TypeFlags.Unknown |
                ts.TypeFlags.Never
            )
        )
      ) {
        variantTypes.add('object')
      }

      if (
        types.some((type) =>
          util.isTypeFlagSet(
            type,
            ts.TypeFlags.TypeParameter | ts.TypeFlags.Any | ts.TypeFlags.Unknown
          )
        )
      ) {
        variantTypes.add('any')
      }

      if (
        types.some((type) => tsutils.isTypeFlagSet(type, ts.TypeFlags.Never))
      ) {
        variantTypes.add('never')
      }

      return variantTypes
    }
  },
})

function isLogicalNegationExpression(
  node: TSESTree.Node
): node is TSESTree.UnaryExpression {
  return node.type === AST_NODE_TYPES.UnaryExpression && node.operator === '!'
}

function isArrayLengthExpression(
  node: TSESTree.Node,
  typeChecker: ts.TypeChecker,
  parserServices: ParserServices
): node is TSESTree.MemberExpressionNonComputedName {
  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false
  }
  if (node.computed) {
    return false
  }
  if (node.property.name !== 'length') {
    return false
  }
  const objectTsNode = parserServices.esTreeNodeToTSNodeMap.get(node.object)
  const objectType = util.getConstrainedTypeAtLocation(
    typeChecker,
    objectTsNode
  )
  return util.isTypeArrayTypeOrUnionOfArrayTypes(objectType, typeChecker)
}

type ConditionalStatement =
  | TSESTree.IfStatement
  | TSESTree.WhileStatement
  | TSESTree.ForStatement
  | TSESTree.DoWhileStatement

function isConditionalStatement(
  node: TSESTree.Node
): node is ConditionalStatement {
  return [
    AST_NODE_TYPES.IfStatement,
    AST_NODE_TYPES.WhileStatement,
    AST_NODE_TYPES.ForStatement,
    AST_NODE_TYPES.DoWhileStatement,
  ].includes(node.type)
}

// Checks if a node belongs to an if or loop test statement
function belongsToConditionalStatementTest(node: TSESTree.Node) {
  let current = node
  let parent = node.parent
  while (parent) {
    if (isConditionalStatement(parent) && parent.test === current) {
      return true
    }

    current = parent
    parent = current.parent
  }
  return false
}
