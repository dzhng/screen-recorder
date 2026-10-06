import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** The personal root every local peer shares. `YAP_HOME` relocates it, as tests do. */
export function personalHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.YAP_HOME;
  return override ? resolve(override) : join(homedir(), ".yap");
}

/** The private directory a running service owns inside a personal root. */
export function serviceRuntimeDirectory(home: string): string {
  return join(home, "run");
}

/** The one socket a runtime directory holds. */
export function serviceSocketPath(runtimeDirectory: string): string {
  return join(runtimeDirectory, "service.sock");
}
