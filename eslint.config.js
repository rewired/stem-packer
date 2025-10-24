import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url));

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.vite/**', '**/coverage/**']
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['**/*.tsx', '**/*.mdx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\p{Extended_Pictographic}/u]",
          message: 'Emojis are not allowed in UI layers.'
        },
        {
          selector: "TemplateElement[value.raw=/\\p{Extended_Pictographic}/u]",
          message: 'Emojis are not allowed in UI layers.'
        },
        {
          selector: "JSXText[value=/\\p{Extended_Pictographic}/u]",
          message: 'Emojis are not allowed in UI layers.'
        }
      ]
    }
  }
);
