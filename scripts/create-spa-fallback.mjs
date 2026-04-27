import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const outputDir = path.resolve(process.cwd(), "dist", "public");
const indexPath = path.join(outputDir, "index.html");
const fallbackPath = path.join(outputDir, "404.html");

if (!existsSync(indexPath)) {
  console.error(`Cannot create SPA fallback. Missing ${indexPath}. Run pnpm build first.`);
  process.exit(1);
}

copyFileSync(indexPath, fallbackPath);
console.log(`Created GitHub Pages SPA fallback: ${fallbackPath}`);
