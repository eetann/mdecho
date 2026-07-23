import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";

export function startServer(filePath: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      readFile(filePath, "utf-8").then((content) => {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(content);
      });
    });

    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://localhost:${port}/` });
    });
  });
}
