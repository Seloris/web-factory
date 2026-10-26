import angular from "angular-eslint";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", ".angular/", "src/api/"] },
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Elements in kebab-case (`app-panel`), attributes in camelCase (`button[appButton]`).
      "@angular-eslint/component-selector": [
        "error",
        [
          { type: "element", prefix: "app", style: "kebab-case" },
          { type: "attribute", prefix: "app", style: "camelCase" },
        ],
      ],
      "@angular-eslint/directive-selector": ["error", { type: "attribute", prefix: "app", style: "camelCase" }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
