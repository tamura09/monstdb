import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'prisma/migrations/**', 'prisma/migrations.backup/**'],
  },
  // 既存コードベースに対して大量に発生する厳しめのルールを warn に緩和する。
  // next/core-web-vitals (eslint-plugin-react-hooks v7) から導入された
  // React Compiler 向けの新しいルールが既存コードで多数 error になるため。
  {
    rules: {
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default eslintConfig
