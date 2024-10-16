import { run, loadEnv, isNode } from "#std/sk_types";
import { SKDB, SKDBSync, SKDBShared } from "#skdb/skdb_types";
import { SKDBWorker } from "#skdb/skdb_wdatabase";
export { SKDB, RemoteSKDB } from "#skdb/skdb_types";
export { SKDBTable as SKDBTable } from "#skdb/skdb_util";
export { Creds, MuxedSocket } from "#skdb/skdb_orchestration";
export { Environment } from "#std/sk_types";

var wasm64 = "skdb";
// sknpm searches for the modules line verbatim
// prettier-ignore
var modules = [ /*--MODULES--*/];
var extensions = new Map();
/*--EXTENSIONS--*/

export async function createSkdb(
  options: {
    dbName?: string;
    asWorker?: boolean;
    getWasmSource?: () => Promise<Uint8Array>;
  } = {},
): Promise<SKDB> {
  const asWorker =
    options.asWorker != undefined ? options.asWorker : !options.getWasmSource;
  if (!asWorker) {
    return createOnMain(options.dbName, options.getWasmSource);
  } else {
    if (options.getWasmSource) {
      throw new Error("getWasmSource is not compatible with worker");
    }
    return createWorker(options.dbName);
  }
}

async function createSkdbSync(
  options: {
    dbName?: string;
    getWasmSource?: () => Promise<Uint8Array>;
  } = {},
): Promise<SKDBSync> {
  let data = await run(
    wasm64,
    modules,
    extensions,
    "SKDB_factory",
    options.getWasmSource,
  );
  return (data.environment.shared.get("SKDB") as SKDBShared).createSync(
    options.dbName,
  );
}

async function createOnMain(
  dbName?: string,
  getWasmSource?: () => Promise<Uint8Array>,
) {
  let data = await run(
    wasm64,
    modules,
    extensions,
    "SKDB_factory",
    getWasmSource,
  );
  return (data.environment.shared.get("SKDB") as SKDBShared).create(dbName);
}

async function createWorker(dbName?: string) {
  let env = await loadEnv(extensions);
  let path: string;
  if (isNode()) {
    path = import.meta.url.replace("/skdb.mjs", "/skdb_nodeworker.mjs");
    // @ts-ignore
    path = "./" + path.substring(process.cwd().length + 8);
  } else {
    path = import.meta.url.replace("/skdb.mjs", "/skdb_worker.mjs");
  }
  let worker = env.createWorker(path, { type: "module" });
  let skdb = new SKDBWorker(worker);
  await skdb.create(dbName);
  return skdb;
}
