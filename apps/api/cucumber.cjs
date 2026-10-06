// cucumber-js config. Steps are TypeScript, executed by Bun (see "test:bdd").
module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    import: ["features/support/**/*.ts", "features/steps/**/*.ts"],
    format: ["progress"],
    publishQuiet: true,
  },
}
