#!/usr/bin/env node
import { run } from "./run.ts";

process.exitCode = await run(process.argv.slice(2), { cwd: process.cwd(), env: process.env, stdout: process.stdout, stderr: process.stderr });
