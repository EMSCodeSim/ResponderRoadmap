import { describe, expect, it } from "vitest";
import {
  AI_TASKBOOK_PROMPT,
  answerDemoQuestion,
  DEMO_AI_TASKBOOK,
  DEMO_ASSIGNMENT,
  DEMO_DEPARTMENT_NAME,
  DEMO_EVALUATION,
  DEMO_MEMBERS,
  DEMO_SUMMARY,
  DEMO_TRAINING_OFFICER,
} from "@/lib/demo-story";

describe("Pine Ridge department demo story", () => {
  it("uses a fictional department and Training Officer, not customer data", () => {
    expect(DEMO_DEPARTMENT_NAME).toBe("Pine Ridge Fire Rescue");
    expect(DEMO_TRAINING_OFFICER).toContain("Dana Hale");
    const blob = JSON.stringify({ DEMO_MEMBERS, DEMO_ASSIGNMENT, DEMO_EVALUATION });
    expect(blob).not.toMatch(/metrofire\.gov|dept_metro|riley\.chen|alex\.morgan/i);
  });

  it("covers the operational states the homepage and demo sell", () => {
    const statuses = new Set(DEMO_MEMBERS.map((member) => member.status));
    expect(DEMO_MEMBERS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_MEMBERS.length).toBeLessThanOrEqual(10);
    expect(statuses.has("On Track")).toBe(true);
    expect(statuses.has("Awaiting Evaluation")).toBe(true);
    expect(statuses.has("Needs Attention")).toBe(true);
    expect(statuses.has("Completed")).toBe(true);
    expect(DEMO_MEMBERS.some((member) => member.returned > 0)).toBe(true);
    expect(DEMO_SUMMARY.awaitingEvaluation).toBeGreaterThan(0);
    expect(DEMO_SUMMARY.needsAttention).toBeGreaterThan(0);
  });

  it("generates a reviewable Task Book draft from the preloaded prompt", () => {
    expect(AI_TASKBOOK_PROMPT.toLowerCase()).toContain("probationary");
    expect(DEMO_AI_TASKBOOK.sections.map((section) => section.title)).toEqual([
      "Apparatus orientation",
      "SCBA",
      "Hose deployment",
      "Ladders",
      "Forcible entry",
      "Radio operations",
    ]);
    const requirementCount = DEMO_AI_TASKBOOK.sections.reduce((sum, section) => sum + section.requirements.length, 0);
    expect(requirementCount).toBeGreaterThanOrEqual(8);
    expect(DEMO_AI_TASKBOOK.sections.every((section) => section.requirements.every((item) => item.evaluation.length > 12))).toBe(true);
  });

  it("answers department and product questions without mutating records", () => {
    expect(answerDemoQuestion("Who needs my attention?").kind).toBe("department");
    expect(answerDemoQuestion("Why is Smith only at 80%?").answer).toContain("16 are approved");
    expect(answerDemoQuestion("How do I create an Assignment?").kind).toBe("product");
    expect(answerDemoQuestion("What evaluations are waiting for me?").answer).toContain("Jordan Smith");
  });
});
