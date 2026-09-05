// Deterministische Struktur-Checks (nicht Stil/Formatierung) — Teil des
// Audit-Prozesses in audits/README.md. Feste Schwellen statt LLM-Ermessen:
// derselbe Code liefert bei jedem Lauf exakt dasselbe Ergebnis.
//
// Absichtlich getrennt von einer etwaigen künftigen Lint-Config fürs normale
// Entwickeln (Stilregeln, Formatierung) — dieses Config-File prüft NUR drei
// Struktur-Metriken (Dateigröße, Funktionsgröße, zyklomatische Komplexität)
// und schaltet alle anderen Regeln (Vue-Attribut-Stil, no-unused-vars, etc.)
// bewusst ab, damit `npm run audit:structure` nicht mit stilistischem Rauschen
// von den strukturellen Befunden ablenkt.

import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import importX from 'eslint-plugin-import-x'

const STRUCTURE_RULES = {
  'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ['warn', 15],
  'import-x/no-cycle': ['warn', { maxDepth: Infinity }],
}

// Alle Vue-Stilregeln aus flat/recommended abschalten — für diesen Check
// zählen nur STRUCTURE_RULES. `off` statt die Config wegzulassen, da
// flat/recommended sonst weiterhin mit Default-Severity greifen würde.
const allVueRuleNames = new Set()
for (const cfg of vue.configs['flat/recommended']) {
  for (const ruleName of Object.keys(cfg.rules ?? {})) allVueRuleNames.add(ruleName)
}
const vueStyleRulesOff = Object.fromEntries([...allVueRuleNames].map(r => [r, 'off']))

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/data/**',
      'web-app/src/components/ui/**', // generierte/Drittanbieter-UI-Primitives (reka-ui-Wrapper)
    ],
  },
  ...vue.configs['flat/recommended'],
  {
    files: ['server/**/*.js', 'shared/**/*.js'],
    plugins: { 'import-x': importX },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    settings: { 'import-x/resolver': { node: { extensions: ['.js'] } } },
    rules: { ...vueStyleRulesOff, ...STRUCTURE_RULES },
  },
  {
    files: ['web-app/src/**/*.{js,ts}'],
    plugins: { 'import-x': importX },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    settings: { 'import-x/resolver': { node: { extensions: ['.js', '.ts', '.vue'] } } },
    rules: { ...vueStyleRulesOff, ...STRUCTURE_RULES },
  },
  {
    files: ['web-app/src/**/*.vue'],
    plugins: { 'import-x': importX },
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { parser: tsParser },
    },
    settings: { 'import-x/resolver': { node: { extensions: ['.js', '.ts', '.vue'] } } },
    rules: { ...vueStyleRulesOff, ...STRUCTURE_RULES },
  },
]
