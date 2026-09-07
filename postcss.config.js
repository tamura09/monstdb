module.exports = {
  plugins: {
    // Tailwind v4 の PostCSS プラグインは別パッケージに分離された。
    // ベンダープレフィックスは Tailwind が内部の Lightning CSS で付けるため、
    // autoprefixer は不要（併用すると二重処理になる）。
    '@tailwindcss/postcss': {},
  },
}
