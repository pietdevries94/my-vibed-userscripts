// Usage: npm run dev <script>
// Rebuilds dist/dev/<script>.user.js on every change, serves it on
// http://localhost:8786, and starts the script's fake site on :8787 when it has one.
// Install the dev file once from http://localhost:8786/<script>.user.js and use
// Violentmonkey's "Track external edits".
import type { BuildContext, Plugin } from "esbuild";
import { DEV_SERVER_PORT, FAKE_SITE_PORT, esbuildOptions, hasFakeSite } from "./bundle.ts";
import { devFilePath, readScript, scriptJsonPath, selectScripts } from "./scripts.ts";
import type { Script } from "./scripts.ts";
import { context } from "esbuild";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

function writeDevFile(file: string): Plugin {
  return {
    name: "write-dev-file",
    setup(build) {
      build.onEnd((result) => {
        const [output] = result.outputFiles ?? [];
        if (result.errors.length > 0 || output === undefined) {
          console.error(`Build failed: ${result.errors.map((error) => error.text).join("; ")}`);
          return;
        }
        fs.writeFileSync(file, output.text);
        console.log(`${new Date().toLocaleTimeString()} built ${path.basename(file)}`);
      });
    },
  };
}

async function watchScript(id: string, previous: BuildContext | null): Promise<BuildContext> {
  await previous?.dispose();
  const file = devFilePath(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buildContext = await context({
    ...esbuildOptions(readScript(id), "dev"),
    plugins: [writeDevFile(file)],
  });
  await buildContext.watch();
  return buildContext;
}

function serveDevFile(id: string): void {
  const file = devFilePath(id);
  const server = http.createServer((request, response) => {
    const requested = new URL(
      request.url ?? "/",
      `http://localhost:${DEV_SERVER_PORT}`,
    ).pathname.slice(1);
    if (requested !== `${id}.user.js` || !fs.existsSync(file)) {
      response.writeHead(HTTP_NOT_FOUND, { "Content-Type": "text/plain" });
      response.end(`Only ${id}.user.js is served here.`);
      return;
    }
    response.writeHead(HTTP_OK, {
      "Cache-Control": "no-store",
      "Content-Type": "application/javascript",
    });
    response.end(fs.readFileSync(file));
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    const reason =
      error.code === "EADDRINUSE"
        ? `port ${DEV_SERVER_PORT} is in use, probably by another npm run dev. Stop that one first.`
        : error.message;
    console.error(`Dev server: ${reason}`);
    process.exit(1);
  });
  server.listen(DEV_SERVER_PORT, () => {
    console.log(`Dev file: http://localhost:${DEV_SERVER_PORT}/${id}.user.js`);
  });
}

function startFakeSite(script: Script): void {
  const server = path.join(script.directory, "fake-site", "server.ts");
  if (!hasFakeSite(script) || !fs.existsSync(server)) {
    return;
  }
  const fakeSite = spawn(process.execPath, [server], { stdio: "inherit" });
  process.on("exit", () => {
    fakeSite.kill();
  });
  console.log(`Fake site: http://localhost:${FAKE_SITE_PORT}/__dev`);
}

const [name] = process.argv.slice(2);
if (name === undefined) {
  console.error("Usage: npm run dev <script>");
  process.exit(1);
}
const [script] = selectScripts(name);
if (script === undefined) {
  process.exit(1);
}
let buildContext = await watchScript(script.id, null);
// The metadata block comes from script.json, which esbuild does not watch.
fs.watch(scriptJsonPath(script.id), () => {
  void watchScript(script.id, buildContext).then((next) => {
    buildContext = next;
  });
});
serveDevFile(script.id);
startFakeSite(script);
