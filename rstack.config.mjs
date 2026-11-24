import tanstackQuery from '@tanstack/eslint-plugin-query'
import vitest from '@vitest/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import { define } from 'rstack'

const FRONTEND = 'apps/frontend'

const LAYERS = ['domain', 'application', 'adapters', 'ui', 'ds', 'app']

const layers = (...names) => names.map(name => `@/${name}/**`)

const EVERYWHERE = [
  { group: ['cozy-ui', 'cozy-ui/**'], message: 'cozy-ui is never used.' },
  {
    group: ['@linagora/twake-mui/*'],
    message: 'Import from the @linagora/twake-mui entry point.'
  },
  {
    group: ['posthog-js', 'posthog-js/**'],
    message: 'Only adapters/posthog/ imports posthog-js.'
  }
]

const NO_SENTRY = [
  {
    group: ['@linagora/twake-feedback/sentry'],
    message: 'Only adapters/sentry/ imports @linagora/twake-feedback/sentry.'
  }
]

const RAW_UI = [
  {
    group: ['@mui/*', '@mui/*/**', '@emotion/*', '@emotion/*/**'],
    message: 'Import from @linagora/twake-mui. Missing UI goes to @/ds/.'
  }
]

const NO_STYLED = {
  name: '@linagora/twake-mui',
  importNames: ['styled'],
  message: 'No styled components outside @/ds/.'
}

const FRAMEWORKS = [
  'react',
  'react-dom',
  'react-router',
  'twake-i18n',
  '@tanstack/*',
  '@linagora/*'
]

const BOUNDARIES = {
  domain: [...layers(...LAYERS.filter(l => l !== 'domain')), ...FRAMEWORKS],
  // The embed contract with the framed apps is pure: no framework in it
  application: [
    ...layers('adapters', 'ui', 'ds', 'app'),
    ...FRAMEWORKS,
    '!@linagora/twake-embed'
  ],
  adapters: layers('ui', 'ds', 'app'),
  ui: layers('adapters', 'app'),
  ds: [
    ...layers('domain', 'application', 'adapters', 'ui', 'app'),
    'react-router',
    'twake-i18n',
    '@tanstack/*'
  ],
  app: []
}

const restrictImports = layer => {
  const patterns = [...EVERYWHERE, ...NO_SENTRY]
  if (layer !== 'ds') patterns.push(...RAW_UI)
  if (BOUNDARIES[layer].length > 0) {
    patterns.push({
      group: BOUNDARIES[layer],
      message: `Not allowed from ${layer}/ (hexagonal boundaries).`
    })
  }
  return ['error', { paths: layer === 'ds' ? [] : [NO_STYLED], patterns }]
}

const FORBIDDEN_SYNTAX = [
  {
    selector: 'ExportDefaultDeclaration',
    message: 'Named exports only.'
  },
  { selector: 'TSEnumDeclaration', message: 'Use a string union.' },
  {
    selector: 'JSXAttribute[name.name="style"]',
    message: 'No inline style: use twake-mui props or twake-css classes.'
  },
  {
    selector:
      'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
    message: 'No `as unknown as T`.'
  }
]

const NO_SX = {
  selector: 'JSXAttribute[name.name="sx"]',
  message: 'No sx outside @/ds/.'
}

// The React Compiler rules of eslint-plugin-react-hooks, which Rslint does not
// port. Rslint reserves the react-hooks prefix for its own rules.
const reactCompilerRules = Object.fromEntries(
  Object.entries(reactHooks.configs['recommended-latest'].rules)
    .filter(([rule]) => !/\/(rules-of-hooks|exhaustive-deps)$/.test(rule))
    .map(([rule, level]) => [
      rule.replace('react-hooks/', 'react-compiler/'),
      level
    ])
)

// Rslint's no-restricted-syntax does not match TypeScript nodes such as
// TSAsExpression (web-infra-dev/rslint#2626). ESLint's rule runs those
// selectors, through the JS plugins.
const TS_NODE = /\bTS(?!EnumDeclaration)/

const tsSyntax = {
  rules: {
    'no-restricted-syntax': {
      meta: { schema: false },
      create: context =>
        Object.fromEntries(
          context.options.map(({ selector, message }) => [
            selector,
            node => context.report({ node, message })
          ])
        )
    }
  }
}

// Splits "a, b" at the commas outside brackets, parentheses and quotes
const splitSelector = selector => {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]
    if (quote) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      parts.push(selector.slice(start, i).trim())
      start = i + 1
    }
  }
  return [...parts, selector.slice(start).trim()]
}

const splitRestrictedSyntax = ([level, ...restrictions]) => {
  const native = []
  const ts = []
  for (const { selector, message } of restrictions) {
    const parts = splitSelector(selector)
    const nativeParts = parts.filter(part => !TS_NODE.test(part))
    const tsParts = parts.filter(part => TS_NODE.test(part))
    if (nativeParts.length > 0) {
      native.push({ selector: nativeParts.join(', '), message })
    }
    if (tsParts.length > 0) ts.push({ selector: tsParts.join(', '), message })
  }
  return {
    'no-restricted-syntax': [level, ...native],
    'ts-syntax/no-restricted-syntax': [level, ...ts]
  }
}

// Paths below are relative to the repository root, whichever workspace runs
// the lint with --config.
const frontend = ({ rules, ...entry }) => ({
  ...entry,
  files: entry.files.map(file => `${FRONTEND}/${file}`),
  ...(entry.ignores && {
    ignores: entry.ignores.map(file => `${FRONTEND}/${file}`)
  }),
  ...(rules && {
    rules: rules['no-restricted-syntax']
      ? { ...rules, ...splitRestrictedSyntax(rules['no-restricted-syntax']) }
      : rules
  })
})

// The handlers of eslint-plugin-jsx-a11y's strict preset
const HANDLERS = [
  'onFocus',
  'onBlur',
  'onKeyDown',
  'onKeyPress',
  'onKeyUp',
  'onClick',
  'onContextMenu',
  'onDblClick',
  'onDoubleClick',
  'onDrag',
  'onDragEnd',
  'onDragEnter',
  'onDragExit',
  'onDragLeave',
  'onDragOver',
  'onDragStart',
  'onDrop',
  'onMouseDown',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseMove',
  'onMouseOut',
  'onMouseOver',
  'onMouseUp'
]

const frontendConfig = ({ jsxA11yPlugin }) => [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Turned off by eslint-config-prettier
      'no-unexpected-multiline': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' }
      ]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: ['jsx-a11y', 'react-hooks'],
    rules: {
      ...jsxA11yPlugin.configs.recommended.rules,
      // eslint-plugin-jsx-a11y's strict preset, where it differs from the
      // recommended one
      'jsx-a11y/interactive-supports-focus': [
        'error',
        {
          tabbable: [
            'button',
            'checkbox',
            'link',
            'progressbar',
            'searchbox',
            'slider',
            'spinbutton',
            'switch',
            'textbox'
          ]
        }
      ],
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': [
        'error',
        {
          handlers: [...HANDLERS, 'onLoad', 'onError'],
          body: ['onError', 'onLoad'],
          iframe: ['onError', 'onLoad'],
          img: ['onError', 'onLoad']
        }
      ],
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: [], tags: [] }],
      'jsx-a11y/no-static-element-interactions': [
        'error',
        { handlers: HANDLERS }
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX, NO_SX]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-compiler': reactHooks },
    rules: reactCompilerRules
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'ts-syntax': tsSyntax }
  },
  ...LAYERS.map(layer => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: { 'no-restricted-imports': restrictImports(layer) }
  })),
  {
    files: ['src/ds/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...FORBIDDEN_SYNTAX] }
  },
  {
    files: ['src/adapters/posthog/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: EVERYWHERE.filter(p => !p.group.includes('posthog-js')) }
      ]
    }
  },
  {
    files: ['src/adapters/sentry/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [NO_STYLED],
          patterns: [
            ...EVERYWHERE,
            ...RAW_UI,
            {
              group: layers('ui', 'ds', 'app'),
              message: 'Not allowed from adapters/ (hexagonal boundaries).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@tanstack/query': tanstackQuery },
    rules: tanstackQuery.configs['flat/recommended'][0].rules
  },
  {
    files: ['src/**/*.spec.{ts,tsx}'],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules
  }
]

const config = lint => [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/drizzle/**',
      'scripts/**',
      `${FRONTEND}/public/**`
    ]
  },
  lint.js.configs.recommended,
  ...lint.ts.configs.strictTypeChecked,
  {
    files: [`${FRONTEND}/**/*.{ts,tsx}`],
    rules: lint.ts.configs.stylisticTypeChecked.at(-1).rules
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Rslint's preset ignores the names that start with an underscore
      '@typescript-eslint/no-unused-vars': ['error', {}]
    }
  },
  {
    // ESLint's recommended preset has it, Rslint's does not
    files: ['**/*.{js,mjs,cjs}'],
    rules: { 'no-undef': 'error' }
  },
  ...frontendConfig(lint).map(frontend)
]

define.lint(lint =>
  config(lint).map(entry => ({ ...entry, basePath: import.meta.dirname }))
)

define.fmt({
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 80,
  arrowParens: 'avoid',
  ignorePatterns: [
    'apps/backend/drizzle/',
    'apps/backend/**/*.md',
    `${FRONTEND}/**/*.md`
  ]
})
