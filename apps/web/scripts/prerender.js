import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync, existsSync, createReadStream, statSync } from "fs";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routes = ["/", "/login"];
const distPath = resolve(__dirname, "../dist");
const indexPath = join(distPath, "index.html");

if (!existsSync(indexPath)) {
  console.error("❌ Build output not found. Please run 'vite build' first.");
  process.exit(1);
}

console.log("🚀 Starting pre-rendering...");

// Simple static file server for pre-rendering
function createStaticServer(distPath, port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let filePath = join(distPath, req.url === "/" ? "index.html" : req.url);

      // Handle SPA routing - serve index.html for all routes
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = indexPath;
      }

      // Set proper content type
      const ext = filePath.split(".").pop();
      const contentTypes = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        svg: "image/svg+xml",
        ico: "image/x-icon",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";

      try {
        const stream = createReadStream(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        stream.pipe(res);
      } catch (error) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      console.log(`📡 Started local server on port ${port}`);
      resolve(server);
    });
  });
}

async function prerender() {
  const port = 4174; // Use a different port than preview
  const server = await createStaticServer(distPath, port);
  const baseUrl = `http://localhost:${port}`;

  // Try to find Chrome/Chromium executable
  let executablePath;
  try {
    // Try to use the Chromium bundled with puppeteer
    executablePath = puppeteer.executablePath();
    if (!existsSync(executablePath)) {
      throw new Error("Bundled Chromium not found");
    }
  } catch (error) {
    // If that fails, try common Chrome/Chromium locations
    const possiblePaths = [
      // Windows paths
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      // Linux paths
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      // Environment variable
      process.env.CHROME_PATH,
      process.env.PUPPETEER_EXECUTABLE_PATH,
    ].filter(Boolean);

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        executablePath = path;
        console.log(`📦 Using system Chrome/Chromium: ${path}`);
        break;
      }
    }

    if (!executablePath) {
      console.error("❌ Chrome/Chromium not found!");
      console.error("\nPlease install Chrome/Chromium by running one of the following:");
      console.error("  npx puppeteer browsers install chrome");
      console.error("  OR");
      console.error("  Install Google Chrome and set CHROME_PATH environment variable");
      process.exit(1);
    }
  }

  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (error) {
    console.error("❌ Failed to launch browser:", error.message);
    console.error("\nPlease install Chrome/Chromium by running:");
    console.error("  npx puppeteer browsers install chrome");
    process.exit(1);
  }

  try {
    for (const route of routes) {
      console.log(`📄 Pre-rendering route: ${route}`);

      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the route
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: "networkidle0",
      });

      // Wait for render-complete event or timeout after 3 seconds
      await Promise.race([
        page.evaluate(() => {
          return new Promise((resolve) => {
            const handler = () => {
              document.removeEventListener("render-complete", handler);
              resolve();
            };
            document.addEventListener("render-complete", handler);
            // Fallback timeout
            setTimeout(resolve, 2000);
          });
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);

      // Get the rendered HTML
      const html = await page.content();

      // Fix asset paths - use absolute paths from root so they work from any directory
      const fixedHtml = html
        .replace(new RegExp(`${baseUrl}`, "g"), "")
        // Fix relative asset paths to be absolute from root
        .replace(/href="\.\//g, 'href="/')
        .replace(/src="\.\//g, 'src="/')
        .replace(/href="assets\//g, 'href="/assets/')
        .replace(/src="assets\//g, 'src="/assets/')
        // Fix any other relative paths
        .replace(/href="([^"]*)\/([^\/"]+)"/g, (match, path, file) => {
          // If it's a relative path starting with /, keep it
          if (path.startsWith('/')) return match;
          // Otherwise make it absolute
          return `href="/${path}/${file}"`;
        });

      // Save to appropriate path
      if (route === "/") {
        writeFileSync(indexPath, fixedHtml);
        console.log(`✅ Pre-rendered: ${route} -> index.html`);
      } else {
        const routePath = join(distPath, route);
        mkdirSync(routePath, { recursive: true });
        writeFileSync(join(routePath, "index.html"), fixedHtml);
        console.log(`✅ Pre-rendered: ${route} -> ${route}/index.html`);
      }

      await page.close();
    }

    console.log("✨ Pre-rendering complete!");
  } catch (error) {
    console.error("❌ Pre-rendering failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
}

prerender();

