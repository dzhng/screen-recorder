import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { AssetStore } from "@screenrec/core/assets";
import { Catalog, CatalogError } from "@screenrec/core/catalog";
import { JobQueue, type JobTargets } from "@screenrec/core/jobs";
import {
  operationSchema,
  operationNames,
  operationError,
  type OperationResult,
} from "@screenrec/protocol";
import {
  listenLocal,
  prepareRuntimeDirectory,
  type LocalHandler,
  type LocalListener,
} from "./index.js";
import { claimStartup } from "./startup.js";
import { mediaWorker, nativeResult, type MediaWorker } from "./worker.js";
import { operationFailure } from "./operations.js";

/** Isolated development entry; production capture switches to these owners at cutover. */
export async function startProjectService(options: { home: string; worker?: MediaWorker }) {
  const library = join(options.home, "library");
  const runtime = join(library, "run");
  await prepareRuntimeDirectory(library);
  const ownership = await claimStartup(runtime);
  let catalog: Catalog | undefined;
  let jobs: JobQueue | undefined;
  let listener: LocalListener | undefined;
  try {
    catalog = new Catalog(join(library, "catalog.sqlite"));
    const assets = new AssetStore(catalog, library);
    await assets.recover();
    const worker = options.worker ?? mediaWorker();
    const targets: JobTargets = {
      pin(target) {
        if (target.kind !== "import")
          throw new CatalogError("NOT_READY", "This service currently admits import jobs only");
        assets.intent(target.importId);
        return target;
      },
      isAvailable(target) {
        if (target.kind !== "import") return false;
        try {
          assets.intent(target.importId);
          return true;
        } catch (error) {
          if (error instanceof CatalogError && error.code === "NOT_FOUND") return false;
          throw error;
        }
      },
      isDeleting: () => false,
      isCapturing: () => false,
    };
    const queue = new JobQueue({
      store: catalog,
      targets,
      providers: { newId: randomUUID },
      execute: async ({ job, signal }) => {
        if (job.target.kind !== "import" || job.artifact !== "asset.import")
          throw new CatalogError("NOT_READY", "Unsupported preparation job");
        const asset = await assets.executeImport(
          job.target.importId,
          async (path, probeSignal) =>
            nativeResult(await worker("media.probe", { path }, { signal: probeSignal })),
          signal,
          { kind: "job", id: job.jobId },
        );
        return JSON.stringify({ assetId: asset.id });
      },
    });
    jobs = queue;
    const status = (jobId: string) => {
      const job = queue.job(jobId);
      const publication = queue.status(job).published;
      return { ...job, result: publication ? (JSON.parse(publication.result) as unknown) : null };
    };
    const pending = new Set<Promise<OperationResult>>();
    let closing = false;
    const handle: LocalHandler = async (request): Promise<OperationResult> => {
      if (!operationNames.has(request.operation))
        return operationError("UNKNOWN_OPERATION", "Unknown service operation");
      const parsed = operationSchema.safeParse({
        operation: request.operation,
        params: request.params,
      });
      if (!parsed.success)
        return operationError("INVALID_PARAMS", "Parameters do not match the operation schema");
      const operation = parsed.data;
      try {
        switch (operation.operation) {
          case "asset.import": {
            const prepared = await assets.prepareImport(
              operation.params.requestId,
              operation.params.path,
            );
            if (closing) throw new CatalogError("SERVICE_STOPPED", "Service is closing", {}, true);
            const job = queue.submit(() => {
              const intent = assets.admitImport(prepared);
              return {
                target: { kind: "import", importId: intent.importId },
                artifact: "asset.import",
                lane: "heavy",
                input: JSON.stringify(intent.source),
              };
            });
            return { ok: true, data: status(job.jobId) };
          }
          case "asset.get":
            return { ok: true, data: assets.get(operation.params.assetId) };
          case "asset.origins":
            return {
              ok: true,
              data: assets.origins(operation.params.assetId, {
                ...operation.params.cursor,
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "asset.list":
            return {
              ok: true,
              data: assets.list({
                ...operation.params.cursor,
                ...(operation.params.limit === undefined ? {} : { limit: operation.params.limit }),
              }),
            };
          case "job.get":
            return { ok: true, data: status(operation.params.jobId) };
          case "job.retry":
            queue.retry(operation.params.jobId);
            return { ok: true, data: status(operation.params.jobId) };
          case "job.cancel":
            await queue.drainJob(operation.params.jobId);
            return { ok: true, data: status(operation.params.jobId) };
          default:
            return operationError("NOT_READY", "Operation is not available in the project service");
        }
      } catch (error) {
        return operationFailure(error);
      }
    };
    listener = await listenLocal({
      runtimeDirectory: runtime,
      handler: (request, signal) => {
        const task = Promise.resolve(handle(request, signal));
        pending.add(task);
        void task.then(
          () => pending.delete(task),
          () => pending.delete(task),
        );
        return task;
      },
    });
    let closed: Promise<void> | undefined;
    return {
      socketPath: listener.socketPath,
      assets,
      close() {
        if (!closed)
          closed = (async () => {
            closing = true;
            await listener!.close();
            await Promise.allSettled(pending);
            await queue.close();
            catalog!.close();
            ownership.release();
          })();
        return closed;
      },
    };
  } catch (error) {
    await listener?.close();
    await jobs?.close();
    catalog?.close();
    ownership.release();
    throw error;
  }
}
