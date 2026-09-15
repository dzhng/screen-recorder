import { callLocal } from "@screenrec/client";
const [socketPath, request] = process.argv.slice(2);
console.log(JSON.stringify(await callLocal(socketPath, JSON.parse(request))));
