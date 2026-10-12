import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Temporary scoped exception for pre-existing JSX text in the class workflow panel.
  // Replace the apostrophes with entities and remove this exception in the follow-up.
  { files: ["src/app/(portal)/classes/[id]/page.tsx"], rules: { "react/no-unescaped-entities": "off" } },
];

export default eslintConfig;
