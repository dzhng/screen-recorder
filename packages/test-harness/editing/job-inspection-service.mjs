// Read-only SQL instrumentation for the public job-inspection workload.
import { DatabaseSync } from "node:sqlite";
const sqls = new WeakMap(),
  queries = [];
const prepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function (sql) {
  const statement = prepare.call(this, sql);
  sqls.set(statement, sql);
  return statement;
};
const temporary = new DatabaseSync(":memory:");
const prototype = Object.getPrototypeOf(temporary.prepare("SELECT 1"));
const get = prototype.get;
temporary.close();
let enabled = false;
prototype.get = function (...args) {
  const at = performance.now();
  let row;
  try {
    return (row = get.apply(this, args));
  } finally {
    if (enabled)
      queries.push({
        sql: sqls.get(this),
        ms: performance.now() - at,
        boundStringCharacters: args.reduce((n, x) => n + (typeof x === "string" ? x.length : 0), 0),
        returnedInputCharacters: typeof row?.input === "string" ? row.input.length : 0,
        returnedContentCharacters: typeof row?.content === "string" ? row.content.length : 0,
      });
  }
};
process.on("message", (message) => {
  if (message?.type === "profile.snapshot") {
    const previous = queries.splice(0);
    enabled = message.enable === true;
    process.send({
      id: message.id,
      type: "profile.snapshot",
      queries: previous,
      memory: process.memoryUsage(),
      resource: process.resourceUsage(),
    });
  }
});
await import("./source-acquisition-service.mjs");
