import { rename, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await rename("out", "dist");
