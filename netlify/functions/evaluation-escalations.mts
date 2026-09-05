import { runEvaluationEscalations } from "../../src/server/services/inbox";

export default async () => {
  const result = await runEvaluationEscalations();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "@hourly",
};
