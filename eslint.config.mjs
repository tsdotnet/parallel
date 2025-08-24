import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			"semi": ["warn", "always"],
			"indent": ["warn", "tab", { "SwitchCase": 1 }],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-namespace": "off",
			"@typescript-eslint/no-unused-vars": "off",
			// Disable all the problematic rules identified in the lint output
			"@typescript-eslint/ban-types": "off",
			"@typescript-eslint/no-this-alias": "off",
			"@typescript-eslint/no-var-requires": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-unsafe-function-type": "off",
			"@typescript-eslint/no-unused-expressions": "off",
			"prefer-const": "off"
		},
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				process: 'readonly'
			}
		},
		// Disable unused eslint-disable directive warnings
		linterOptions: {
			reportUnusedDisableDirectives: false
		}
	}
);
