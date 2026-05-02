module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: [
    "airbnb",
    "airbnb/hooks",
    "airbnb-typescript",
    "plugin:jsx-a11y/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "jsx-a11y", "react", "react-hooks"],
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      typescript: {
        project: "./tsconfig.json",
      },
    },
  },
  rules: {
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["vite.config.ts", "src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"]
      }
    ],
    "import/prefer-default-export": "off",
    "jsx-a11y/media-has-caption": "off",
    "no-nested-ternary": "off",
    "no-void": "off",
    "prefer-destructuring": "off",
    "react/jsx-no-bind": "off",
    "react/require-default-props": "off",
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never"
      }
    ],
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "function-declaration",
        unnamedComponents: "arrow-function"
      }
    ],
    "react/jsx-props-no-spreading": [
      "error",
      {
        custom: "ignore"
      }
    ],
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-use-before-define": ["error", { functions: false }]
  }
};
