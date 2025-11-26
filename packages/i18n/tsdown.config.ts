import { defineConfig } from "tsdown";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		sourcemap: true,
		dts: true,
	},
	{
		entry: ["src/locales/*.ts"],
		sourcemap: true,
		dts: false, // Skip declaration generation for locale files
	},
]);

