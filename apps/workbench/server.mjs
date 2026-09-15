import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const routes = new Map([
  ["/", ["index.html", "text/html"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/style.css", ["style.css", "text/css"]],
]);
export function createWorkbenchServer() {
  return createServer(async (request, response) => {
    const asset = routes.get(request.url?.split("?")[0]);
    if (!asset || !["GET", "HEAD"].includes(request.method)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    try {
      const bytes = await readFile(new URL(`./public/${asset[0]}`, import.meta.url));
      response.writeHead(200, {
        "Content-Type": `${asset[1]}; charset=utf-8`,
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(500);
      response.end("Fixture asset unavailable");
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createWorkbenchServer();
  server.listen(Number(process.env.PORT ?? 4318), "127.0.0.1", () =>
    console.log(`Recorder workbench: http://127.0.0.1:${server.address().port}`),
  );
}
