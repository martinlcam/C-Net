const allowedTypes = process.env.COMMIT_TYPES
  ? process.env.COMMIT_TYPES.split(",")
  : [
    "feat",
    "fix",
    "docs",
    "refactor",
    "chore",
    "test",
    "ci",
    "deps",
    "style",
    "security",
    "fml"
  ];

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", allowedTypes],
  },
};
