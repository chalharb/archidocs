#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { consoleIo } from "./io.js";
import { runProgram } from "./program.js";

// The bundled CLI sits at dist/cli/index.js and the prebuilt viewer at dist/viewer.
const viewerDir = fileURLToPath(new URL("../viewer/", import.meta.url));

process.exitCode = await runProgram(process.argv.slice(2), {
  io: consoleIo,
  cwd: process.cwd(),
  viewerDir,
});
