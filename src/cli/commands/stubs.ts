import type { Io } from "../io.js";

/** Placeholder until model validation is built; exits cleanly. */
export function runValidate(io: Io): number {
  io.log("validate is not implemented yet.");
  return 0;
}

/** Placeholder until the dev server is built; exits cleanly. */
export function runDev(io: Io): number {
  io.log("dev is not implemented yet.");
  return 0;
}
