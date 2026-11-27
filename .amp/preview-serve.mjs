// Review preview for the Amp Box: runs mint dev on a local port and serves it on 0.0.0.0:$PORT.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT);
const inner = port + 1000;
const MINT_VERSION = "4.3.96";
// Installed on the Box at start, so its native modules match the Box's Node.
const deps = path.join(process.env.HOME, `mint-${MINT_VERSION}`);
const mint = path.join(deps, "node_modules/.bin/mint");


const server = http.createServer((req, res) => {
  const upstream = http.request(
    { host: "localhost", port: inner, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${inner}` } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("The docs preview is starting. Refresh in a minute.");
  });
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const up = net.connect(inner, "localhost", () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(port, "0.0.0.0", () => {
  if (!fs.existsSync(mint)) {
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--prefix", deps, `mint@${MINT_VERSION}`], { stdio: "inherit" });
  }

  const child = spawn(mint, ["dev", "--port", String(inner), "--no-open"], { cwd: root, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
});
