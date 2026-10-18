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

const declaredOperations = [];
for (const [openApiPath, methods] of Object.entries(contract.paths)) {
  const expectedPath = normalizeTemplate(openApiPath.slice(1));
  for (const method of Object.keys(methods).filter((key) => ["get", "post", "put", "patch", "delete"].includes(key))) {
    declaredOperations.push({ method, path: expectedPath });
  }
}

const failures = [];

// Batch grading is safety-critical: verify more than route-name compatibility.
// Keep the mobile payload and server handler aligned when either app evolves.
const batchRoute = "app/training-sheets/\${Uri.encodeComponent(classId)}/skills/batch";
const batchClientIndex = client.indexOf(batchRoute);
const batchClientSource = batchClientIndex < 0 ? "" : client.slice(batchClientIndex, batchClientIndex + 260);
if (batchClientIndex < 0 || !batchClientSource.includes("'requirementId': requirementId") || !batchClientSource.includes("'results': results")) {
  failures.push("Flutter batch grading must POST requirementId and results to the training-sheet batch endpoint.");
}
const classService = fs.readFileSync(path.join(repoRoot, "src/server/services/classes.ts"), "utf8");
const batchHandlerIndex = classService.indexOf("export async function recordSkillResultsBatch(");
const batchHandler = batchHandlerIndex < 0 ? "" : classService.slice(batchHandlerIndex, batchHandlerIndex + 5500);
for (const required of [
  "assertApprovedEvaluator(ctx)",
  "results.length < 1 || results.length > 200",
  "new Set(resultKeys).size !== resultKeys.length",
  "item.attendance !== \"PRESENT\"",
  "prisma.$transaction(",
  "writeAudit(ctx, \"class.skill_result.batch_recorded\"",
]) {
  if (!batchHandler.includes(required)) failures.push(`Batch grading server safeguard missing: ${required}`);
}
let operationCount = 0;
for (const { method, path: expectedPath } of declaredOperations) {
  const backendPath = expectedPath.replace(/\{[^}]+\}/g, (part) => `:${part.slice(1, -1)}`);
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

const exceptions = contract["x-compatibility-exceptions"] ?? [];
for (const operation of mobileOperations) {
  const declared = declaredOperations.some((expected) =>
    expected.method === operation.method && compatiblePath(expected.path, operation.path),
  );
  const documented = exceptions.some((exception) =>
    exception.method === operation.method && compatiblePath(normalizeTemplate(exception.path.slice(1)), operation.path),
  );
  if (!declared && !documented) {
    failures.push(`Flutter client request is missing from the API contract: ${operation.method.toUpperCase()} /api/v1/${operation.path}`);
  }
}

if (failures.length) {
  console.error(`Mobile API contract v${contract.info.version} failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Mobile API contract v${contract.info.version} passed: ${operationCount} backend and Flutter operations verified.`);
  for (const exception of exceptions) {
    console.warn(`Known ${exception.status} compatibility exception: ${exception.method.toUpperCase()} ${exception.path} — ${exception.reason}`);
  }
}
