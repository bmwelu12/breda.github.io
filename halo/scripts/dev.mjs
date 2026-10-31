// npm run dev: model service (Python, :8100) + API (Node, :8787) + app (Vite, :5173).
import { spawn, spawnSync } from "node:child_process";
const py = process.env.PYTHON ?? "python3";
const ok = spawnSync(py, ["-c", "import fastapi, uvicorn"], { stdio: "ignore" }).status === 0;
const procs = [];
const run = (name, cmd, args, opts = {}) => {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32", ...opts });
  const tag = (d) => d.toString().split("\n").filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on("data", tag); p.stderr.on("data", tag);
  procs.push(p);
};
if (ok) run("ml", py, ["-m", "uvicorn", "serve.app:app", "--host", "127.0.0.1", "--port", "8100"], { cwd: "ml" });
else console.log("[ml] Python deps missing: run `make setup`. The app will fall back to the in-browser demo engine.");
if (ok) run("api", "npx", ["tsx", "watch", "server/src/index.ts"]);
run("app", "npx", ["vite", "--config", "app/vite.config.ts"]);
console.log("\n  Halo → http://localhost:5173\n");
const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
