export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Formatting, missing semicolons, etc.
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "perf", // Performance improvement
        "test", // Adding tests
        "chore", // Maintenance tasks
        "ci", // CI/CD changes
        "build", // Build system changes
        "revert", // Revert a previous commit
      ],
    ],
    "scope-enum": [
      1, // Warning only
      "always",
      [
        "core", // @beans/core package
        "cli", // @beans/cli package
        "eval", // @beans/eval package
        "tools", // Tool system
        "llm", // LLM providers
        "agents", // Agent system
        "memory", // Memory system
        "config", // Configuration
        "ui", // UI components
        "deps", // Dependencies
        "security", // Security fixes
      ],
    ],
    "subject-case": [2, "always", "sentence-case"],
    "header-max-length": [2, "always", 100],
  },
};
