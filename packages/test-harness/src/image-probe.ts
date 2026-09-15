import { appendFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const directory = process.env.SCREENREC_PROBE_DIR;
if (!directory) throw new Error("SCREENREC_PROBE_DIR must name generated fixture images");
const frameId = z.enum(["first", "second"]);
const imagePath = (id: z.infer<typeof frameId>) => resolve(directory, `${id}.png`);

if (process.argv[2] === "--file") {
  const id = frameId.parse(process.argv[3]);
  await readFile(imagePath(id));
  process.stdout.write(JSON.stringify({ path: imagePath(id), mimeType: "image/png" }) + "\n");
} else {
  const server = new McpServer({ name: "screenrec-image-probe", version: "0.0.0" });
  server.registerTool(
    "frame",
    {
      description: "Return one generated test image. Read its visible digits.",
      inputSchema: { id: frameId },
    },
    async ({ id }) => {
      await appendFile(join(directory, "calls.jsonl"), JSON.stringify({ id }) + "\n");
      const bytes = await readFile(imagePath(id));
      return {
        content: [{ type: "image", mimeType: "image/png", data: bytes.toString("base64") }],
      };
    },
  );
  await server.connect(new StdioServerTransport());
}
