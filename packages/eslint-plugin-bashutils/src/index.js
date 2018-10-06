// @flow

import { buildESTreeAstFromSource } from '@bash-utils/parser'

import { version, name } from '../package.json'

import * as rules from './rules'

const { experimental: experimentalRules, ...normalRules } = rules

const finalRules = process.env.BASH_UTILS_USE_EXPERIMENTAL_RULES
  ? { ...normalRules, ...experimentalRules }
  : normalRules

const allRulesEnabled = Object.keys(finalRules).reduce((acc, ruleKey) => {
  return {
    ...acc,
    [`bashutils/${ruleKey}`]: 2,
  }
}, {})

const FAKE_AST = {
  tokens: [],
  comments: [],
  loc: [],
  range: [],
}

const FAKE_VISITOR_KEYS = {
  Program: ['body'],
  Command: ['children'],
}

const parseForESLint = (code: string) => {
  const value = buildESTreeAstFromSource(code)

  return {
    ast: {
      ...FAKE_AST,
      ...value,
    },
    code,
    scopeManager: {
      getDeclaredVariables: () => [],
      scopes: [
        {
          through: [],
        },
      ],
    },
    services: {},
    visitorKeys: FAKE_VISITOR_KEYS,
  }
}

const configs = {
  recommended: {
    env: {
      builtin: false,
      node: false,
    },
    globals: {},
    parser: name,
    plugins: ['bashutils'],
    rules: allRulesEnabled,
  },
}

export { configs, finalRules as rules, parseForESLint, version }
