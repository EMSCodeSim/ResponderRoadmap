import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const mobileRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, "../Roadmap"));
const contractPath = path.join(repoRoot, "openapi/mobile-v1.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const router = fs.readFileSync(path.join(repoRoot, "src/server/api/router.ts"), "utf8");
const client = fs.readFileSync(path.join(mobileRoot, "lib/services/responder_roadmap_api.dart"), "utf8");

function normalizeTemplate(value) {
  return value
    .replace(/\$\{Uri\.encodeComponent\(([^)]+)\)\}/g, "{$1}")
    // Optional template expressions are only used to append query strings;
    // path parameters are encoded with Uri.encodeComponent above.
    .replace(/\$\{[^}]*\}/g, "")
    .split("?")[0]
    .replace(/^\/+|\/+$/g, "");
}

function compatiblePath(expected, actual) {
  const left = expected.split("/");
  const right = actual.split("/");
  return left.length === right.length && left.every((part, index) =>
    /^\{[^}]+\}$/.test(part) || part === right[index],
  );
}

const mobileOperations = [];
const requestPattern = /_request\(\s*'([A-Z]+)'\s*,\s*'([^']+)'/gs;
const requestSource = client.replace(/\$\{includeArchived \? '\?archived=all' : ''\}/g, "");
for (const match of requestSource.matchAll(requestPattern)) {
  mobileOperations.push({ method: match[1].toLowerCase(), path: normalizeTemplate(match[2]) });
}
// CSV exports use a direct request to preserve the text/csv response.
mobileOperations.push({ method: "get", path: "classes/{classId}/export.csv" });

const failures = [];
let operationCount = 0;
for (const [openApiPath, methods] of Object.entries(contract.paths)) {
  const expectedPath = normalizeTemplate(openApiPath.slice(1));
  const backendPath = expectedPath.replace(/\{[^}]+\}/g, (part) => `:${part.slice(1, -1)}`);
  for (const method of Object.keys(methods).filter((key) => ["get", "post", "put", "patch", "delete"].includes(key))) {
    operationCount += 1;
    const quotedRoute = `"${backendPath}"`;
    const routeIndex = router.indexOf(quotedRoute);
    const routeWindow = routeIndex < 0 ? "" : router.slice(Math.max(0, routeIndex - 220), routeIndex + quotedRoute.length + 260);
    if (!routeWindow.includes(`method === "${method.toUpperCase()}"`)) {
      failures.push(`Backend route/method missing: ${method.toUpperCase()} /api/v1/${expectedPath}`);
    }
    if (!mobileOperations.some((operation) => operation.method === method && compatiblePath(expectedPath, operation.path))) {
      failures.push(`Flutter client request missing: ${method.toUpperCase()} /api/v1/${expectedPath}`);
    }
  }
}

if (failures.length) {
  console.error(`Mobile API contract v${contract.info.version} failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Mobile API contract v${contract.info.version} passed: ${operationCount} backend and Flutter operations verified.`);
}
