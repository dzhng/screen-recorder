import { closeSync, constants, openSync } from "node:fs";
import { lstat, unlink } from "node:fs/promises";
import { connect } from "node:net";
import { join } from "node:path";
import { serviceSocketPath } from "@yap/protocol";
import { prepareRuntimeDirectory } from "./index.js";

/**
 * macOS `open(2)` takes an exclusive advisory lock atomically with the open under
 * this flag, which Node passes straight through as numeric flags. The lock belongs to
 * the open file description, so the kernel releases it when the owning process dies
 * however it dies. Node exposes no `flock`, and this is the same primitive.
 */
const O_EXLOCK = 0x0020;
const LOCK_FILE = "service.lock";
const PROBE_TIMEOUT_MS = 1_000;

export class StartupFailure extends Error {
  constructor(
    readonly code: "SOCKET_IN_USE" | "SERVICE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

export type StartupClaim = { release(): void };

/**
 * The one place a service instance becomes the owner of a personal runtime directory.
 * Probing a socket and then removing it is two steps, so proving the previous owner
 * gone does not by itself make this instance the next owner: two starters can both see
 * a refused connection, and the loser then unlinks the winner's live socket. Holding an
 * OS lock the kernel releases on death is what makes the whole probe-remove-bind
 * sequence exclusive; a PID file or an inode comparison cannot, because nothing outside
 * the kernel observes an abrupt death or closes the window between two syscalls.
 */
export async function claimStartup(runtimeDirectory: string): Promise<StartupClaim> {
  const directory = await prepare(runtimeDirectory);
  const descriptor = lock(join(directory, LOCK_FILE));
  const socketPath = serviceSocketPath(directory);
  try {
    await reclaimDeadSocket(socketPath);
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
  let held = true;
  return {
    release: () => {
      if (!held) return;
      held = false;
      closeSync(descriptor);
    },
  };
}

async function prepare(runtimeDirectory: string): Promise<string> {
  try {
    return await prepareRuntimeDirectory(runtimeDirectory);
  } catch (error) {
    throw new StartupFailure(
      "SERVICE_UNAVAILABLE",
      `Service could not open ${runtimeDirectory}: ${(error as Error).message}`,
    );
  }
}

function lock(lockPath: string): number {
  try {
    // O_NOFOLLOW refuses a symlinked lock path outright rather than locking whatever it
    // aims at. The lock file is never unlinked: removing it would hand a later starter a
    // different inode to lock, which is no lock at all.
    return openSync(
      lockPath,
      constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | O_EXLOCK | constants.O_NONBLOCK,
      0o600,
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EAGAIN" || code === "EWOULDBLOCK")
      throw new StartupFailure(
        "SOCKET_IN_USE",
        `Another live service is already starting or serving ${lockPath}`,
      );
    throw new StartupFailure(
      "SERVICE_UNAVAILABLE",
      `Service could not lock ${lockPath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Removes a leftover socket, and only a leftover. A refused connection means nothing is
 * listening; a successful one means a live owner that is never unlinked and never
 * killed. Anything at that path that is not a socket — a regular file, a directory, a
 * symlink to either — is refused rather than removed, because this lifecycle never
 * created it and cannot know what it is.
 */
async function reclaimDeadSocket(socketPath: string): Promise<void> {
  const existing = await lstat(socketPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw new StartupFailure(
      "SERVICE_UNAVAILABLE",
      `Service could not inspect ${socketPath}: ${error.message}`,
    );
  });
  if (!existing) return;
  if (!existing.isSocket())
    throw new StartupFailure(
      "SERVICE_UNAVAILABLE",
      `${socketPath} is not a socket; remove it before starting the service`,
    );
  if (await listening(socketPath))
    throw new StartupFailure("SOCKET_IN_USE", `Another live service already owns ${socketPath}`);
  await unlink(socketPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT")
      throw new StartupFailure(
        "SERVICE_UNAVAILABLE",
        `Service could not remove the stale ${socketPath}: ${error.message}`,
      );
  });
}

function listening(socketPath: string): Promise<boolean> {
  return new Promise<boolean>((settle) => {
    const probe = connect(socketPath);
    const finish = (value: boolean) => {
      clearTimeout(timer);
      probe.destroy();
      settle(value);
    };
    // A path that accepts nothing within the probe budget is treated as live: the only
    // mutation this answer permits is removal, and refusing to remove is always safe.
    const timer = setTimeout(() => finish(true), PROBE_TIMEOUT_MS);
    probe.on("connect", () => finish(true));
    probe.on("error", (error) =>
      finish(!["ECONNREFUSED", "ENOENT"].includes((error as NodeJS.ErrnoException).code ?? "")),
    );
  });
}
