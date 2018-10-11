import { EOF, Lexer as ChevLexer, Parser as ChevParser } from 'chevrotain'

import {
  ALL_TOKENS,
  COMMENT,
  FI,
  IDENTIFIER,
  IF,
  NEWLINE,
  REDIRECTION_FORWARD_DOUBLE,
  REDIRECTION_FORWARD_SINGLE,
  SEMICOLON,
  SQ_BRAQUET_LEFT,
  SQ_BRAQUET_RIGHT,
  STRING,
  THEN,
} from './tokens'

const Lexer = new ChevLexer(ALL_TOKENS, {
  deferDefinitionErrorsHandling: true,
  ensureOptimizations: true,
  positionTracking: 'onlyStart',
})

export class Parser extends ChevParser {
  public Script = this.RULE('Script', () => {
    this.OPTION1(() => {
      this.SUBRULE(this.MultipleCommand)
    })

    this.OPTION2(() => {
      this.CONSUME(EOF)
    })
  })

  protected MultipleCommand = this.RULE('MultipleCommand', () => {
    this.AT_LEAST_ONE(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.Termination) },
        { ALT: () => this.SUBRULE(this.Command) },
        { ALT: () => this.SUBRULE(this.IfExpression) },
        { ALT: () => this.SUBRULE(this.Comment) },
      ])
    })
  })

  protected MultipleCommandWithTerminator = this.RULE(
    'MultipleCommandWithTerminator',
    () => {
      this.AT_LEAST_ONE(() => {
        this.OR([
          { ALT: () => this.SUBRULE(this.Command) },
          { ALT: () => this.SUBRULE(this.IfExpression) },
        ])

        this.SUBRULE(this.Termination)
      })
    }
  )

  protected Termination = this.RULE('Termination', () => {
    this.OR([
      { ALT: () => this.CONSUME(SEMICOLON) },
      { ALT: () => this.CONSUME(NEWLINE) },
    ])
  })

  protected Command = this.RULE('Command', () => {
    this.AT_LEAST_ONE(() => {
      this.SUBRULE(this.Literal)
    })

    this.OPTION(() => {
      this.SUBRULE2(this.Redirection)
    })
  })

  protected WordList = this.RULE('WordList', () => {
    this.AT_LEAST_ONE(() => {
      this.CONSUME(IDENTIFIER)
    })
  })

  protected Redirection = this.RULE('Redirection', () => {
    this.OR([
      {
        ALT: () => this.SUBRULE(this.RedirectionA),
      },
      {
        ALT: () => this.SUBRULE(this.RedirectionB),
      },
    ])
  })

  protected RedirectionA = this.RULE('RedirectionA', () => {
    this.CONSUME(REDIRECTION_FORWARD_SINGLE)
    this.CONSUME(IDENTIFIER)
  })

  protected RedirectionB = this.RULE('RedirectionB', () => {
    this.CONSUME(REDIRECTION_FORWARD_DOUBLE)
    this.CONSUME(IDENTIFIER)
  })

  protected IfCondition = this.RULE('IfCondition', () => {
    this.CONSUME(SQ_BRAQUET_LEFT)
    this.CONSUME(IDENTIFIER)
    this.CONSUME(SQ_BRAQUET_RIGHT)

    this.SUBRULE(this.Termination)
  })

  protected Comment = this.RULE('Comment', () => {
    this.CONSUME(COMMENT)
  })

  protected Literal = this.RULE('Literal', () => {
    this.OR([
      { ALT: () => this.CONSUME(STRING) },
      { ALT: () => this.CONSUME(IDENTIFIER) },
    ])
  })

  protected IfExpression = this.RULE('IfExpression', () => {
    this.CONSUME(IF)
    this.SUBRULE(this.IfCondition)
    this.CONSUME(THEN)
    this.OPTION(() => {
      this.CONSUME(NEWLINE)
    })
    this.SUBRULE(this.MultipleCommandWithTerminator)
    this.CONSUME(FI)
  })

  constructor(input) {
    super(input, ALL_TOKENS, {
      // maxLookahead: 0, // tune this to detect and debug bottle-necks
      outputCst: true,
      recoveryEnabled: false,
    })

    Parser.performSelfAnalysis(this)
  }
}

const tokens = (list = []) => {
  return list.map(t => {
    const { length } = t.image
    const range: [number, number] = [t.startOffset, t.startOffset + length]

    return {
      loc: {
        end: { column: t.startColumn + length, line: t.startLine },
        start: { column: t.startColumn, line: t.startLine },
      },
      range,
      type: t.tokenType.tokenName,
      value: t.image,
    }
  })
}

const errors = (list = []) =>
  list.map(({ name, message, token }) => {
    const location = {
      end: {
        column: token.startColumn + token.image.length,
        line: token.startLine,
      },
      start: { line: token.startLine, column: token.startColumn },
    }

    return { name, message, location }
  })

// defining the parser once improves performance and is recommended
const parser = new Parser([])

export const parse = source => {
  if (typeof source !== 'string') {
    throw new Error('You must pass a string as source')
  }

  const lexingResult = Lexer.tokenize(source)

  if (lexingResult.errors.length > 0) {
    // @TODO: Improve this
    throw {
      data: lexingResult.errors,
    }
  }

  parser.input = lexingResult.tokens

  const value = parser.Script()
  const parseErrors = errors(parser.errors)

  if (parseErrors.length) {
    const { message, location } = parseErrors[0]
    const { column, line } = location.start

    const err = new SyntaxError(`${message} at ${line}:${column}`)

    throw err
  }

  return {
    lexErrors: lexingResult.errors,
    parseErrors,
    parser,
    tokens: tokens(lexingResult.tokens),
    value,
  }
}
