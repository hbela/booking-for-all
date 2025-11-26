import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distLocalesDir = join(__dirname, "..", "dist", "locales");

// Ensure dist/locales directory exists
mkdirSync(distLocalesDir, { recursive: true });

// Generate simple declaration files for locale wrappers
const locales = ["en", "hu", "de"];

for (const locale of locales) {
  const content = `declare const ${locale}: Record<string, any>;
export default ${locale};
`;
  writeFileSync(join(distLocalesDir, `${locale}.d.ts`), content);
}

console.log("Generated locale declaration files");

