export type StarterRequirement = {
  title: string;
  description?: string;
  instructions?: string;
  sortOrder: number;
  isRequired?: boolean;
  evidenceType?: string;
  evaluatorSignOffRequired?: boolean;
  estimatedMinutes?: number;
  objectives?: string[];
  tags?: string[];
  evaluationSteps?: Array<{ id: string; text: string }>;
  criticalFailures?: Array<{ id: string; text: string }>;
  repetitionsRequired?: number;
};

export type StarterSection = {
  title: string;
  description?: string;
  sortOrder: number;
  requirements: StarterRequirement[];
};

export type StarterTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedDurationDays: number;
  sections: StarterSection[];
};

function req(
  title: string,
  opts: Partial<StarterRequirement> & { objectives?: string[] } = {},
  sortOrder = 0,
): StarterRequirement {
  return {
    title,
    sortOrder,
    isRequired: true,
    evidenceType: opts.evidenceType ?? "SKILL_EVALUATION",
    evaluatorSignOffRequired: true,
    ...opts,
  };
}

function section(title: string, description: string, requirements: Array<Omit<StarterRequirement, "sortOrder">>, sortOrder: number): StarterSection {
  return {
    title,
    description,
    sortOrder,
    requirements: requirements.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "probationary-firefighter",
    title: "Probationary Firefighter",
    description:
      "Department probationary task book covering orientation, PPE/SCBA, engine company skills, ladders, hose, EMS, and final evaluation.",
    category: "Probationary",
    estimatedDurationDays: 365,
    sections: [
      section("Department Orientation", "Policies, station life, and how Metro Fire operates.", [
        req("Complete department orientation class", {
          description: "Attend the new-hire orientation and review the employee handbook.",
          evidenceType: "TRAINING_ATTENDANCE",
          estimatedMinutes: 240,
          objectives: ["Attend orientation", "Review handbook", "Identify chain of command"],
        }),
        req("Review SOGs and chain of command", {
          description: "Demonstrate working knowledge of standing operating guidelines.",
          evidenceType: "WRITTEN_NOTE",
          estimatedMinutes: 90,
          objectives: ["Locate SOGs", "Describe incident command expectations", "Identify company officer role"],
        }),
        req("Station familiarization walkthrough", {
          evidenceType: "SUPERVISOR_OBSERVATION",
          estimatedMinutes: 60,
          objectives: ["Identify apparatus bays", "Locate PPE rack", "Locate medical cache and hydrant map"],
        }),
        req("Complete HR / benefits briefing", {
          evidenceType: "WRITTEN_NOTE",
          isRequired: false,
          estimatedMinutes: 45,
        }),
      ], 0),
      section("PPE / SCBA", "Personal protective equipment and breathing apparatus competency.", [
        req("Don full structural PPE in under 60 seconds", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 20,
          objectives: ["Don boots and pants", "Don coat and hood", "Don SCBA and facepiece", "Complete in under 60 seconds"],
        }),
        req("Perform SCBA daily check", {
          evidenceType: "SUPERVISOR_OBSERVATION",
          estimatedMinutes: 15,
          objectives: ["Check cylinder pressure", "Complete function test", "Log result"],
        }),
        req("Emergency procedures: skip breathing and Mayday", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 30,
          objectives: ["Demonstrate skip breathing", "Transmit a Mayday", "Activate PASS"],
        }),
        req("Demonstrate facepiece seal and fit awareness", {
          evidenceType: "SUPERVISOR_OBSERVATION",
          estimatedMinutes: 15,
        }),
      ], 1),
      section("Engine Operations", "Core engine company fireground skills.", [
        req("Deploy 1¾-inch attack line", {
          description: "Select, deploy, and advance a charged 1¾-inch attack line.",
          instructions: "Work with a company officer. Call out kinks and maintain a usable working length.",
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 25,
          objectives: ["Select appropriate line", "Deploy line correctly", "Advance charged line", "Demonstrate nozzle control"],
          tags: ["engine", "hose"],
          evaluationSteps: [
            { id: "s1", text: "Select the correct hose line" },
            { id: "s2", text: "Remove hose correctly" },
            { id: "s3", text: "Advance the line safely" },
            { id: "s4", text: "Bleed the nozzle" },
            { id: "s5", text: "Verify stream pattern" },
            { id: "s6", text: "Maintain nozzle control" },
            { id: "s7", text: "Communicate with the crew" },
          ],
          criticalFailures: [
            { id: "c1", text: "Fails to use required PPE" },
            { id: "c2", text: "Creates an unsafe hose operation" },
          ],
        }),
        req("Identify pump panel discharges and intakes", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 20,
          objectives: ["Identify tank-to-pump", "Identify discharges", "Identify intake and relief"],
        }),
        req("Advance charged line to fire floor", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 25,
        }),
        req("Demonstrate nozzle control and stream selection", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 20,
          objectives: ["Straight stream", "Narrow fog", "Shut down without losing control"],
        }),
        req("Hydrant connection and supply line", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 20,
        }),
      ], 2),
      section("Ground Ladders", "Carry, throw, raise, and work from ground ladders.", [
        req("Shoulder carry 24-foot extension ladder", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 15 }),
        req("Throw and raise 24-foot ladder to second story", {
          evidenceType: "SKILL_EVALUATION",
          estimatedMinutes: 20,
          objectives: ["Spot ladder", "Raise to building", "Adjust for climbing angle"],
        }),
        req("Tie off and heel ladder", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 15 }),
        req("Climb and work from ladder with tool", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
      ], 3),
      section("Hose Operations", "Loads, supply, and problem-solving on the line.", [
        req("Load attack line (minute-man / flat load)", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 25 }),
        req("Reload 5-inch supply", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
        req("Extend a line with a gated wye", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
        req("Replace a burst section", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
      ], 4),
      section("EMS Operations", "Basic medical response expectations for probationary firefighters.", [
        req("Complete medical assessment on a patient", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
        req("Assist with stretcher operations", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 15 }),
        req("Review narcotic and ALS assist expectations", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 30 }),
        req("Document a training patient care report", { evidenceType: "FILE", estimatedMinutes: 25 }),
      ], 5),
      section("Driver Familiarization", "Know the assigned engine before driving qualification.", [
        req("Walkaround inspection of assigned engine", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 20 }),
        req("Identify compartment tool locations", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
        req("Spot apparatus at a hydrant", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 15 }),
        req("Review backing policy and spotter use", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 15 }),
      ], 6),
      section("Final Evaluation", "Shift and training staff recommendation to complete probationary status.", [
        req("Probationary skills verification", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 90 }),
        req("Shift officer recommendation", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 20 }),
        req("Training officer final review", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 30 }),
      ], 7),
    ],
  },
  {
    id: "driver-operator-pumper",
    title: "Driver / Operator – Pumper",
    description: "Pump operations, apparatus inspection, driving, and water supply qualification.",
    category: "Driver / Operator",
    estimatedDurationDays: 180,
    sections: [
      section("Apparatus Inspection", "Daily and weekly apparatus checks.", [
        req("Complete morning apparatus check", { evidenceType: "FILE", estimatedMinutes: 30 }),
        req("Identify and operate all pump panel controls", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30 }),
        req("Document a deficiency and out-of-service process", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 20 }),
      ], 0),
      section("Driving", "Safe operation of the pumper.", [
        req("Complete department driving course", { evidenceType: "TRAINING_ATTENDANCE", estimatedMinutes: 180 }),
        req("Demonstrate spotter-guided backing", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
        req("Position engine for hydrant and fire attack", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 25 }),
      ], 1),
      section("Pump Operations", "Produce and maintain fire streams.", [
        req("Establish water from tank and draft", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30, objectives: ["Prime from tank", "Transition to hydrant", "Maintain residual"] }),
        req("Calculate and pump a 1¾-inch attack line", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 25 }),
        req("Supply a master stream", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 25 }),
        req("Relay pumping with a second engine", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30 }),
      ], 2),
      section("Final Qualification", "Officer recommendation for driver authorization.", [
        req("Pump operator skills verification", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 60 }),
        req("Company officer recommendation", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 15 }),
      ], 3),
    ],
  },
  {
    id: "fire-officer-i",
    title: "Fire Officer I",
    description: "Company officer development covering leadership, incident command, and training delivery.",
    category: "Officer Development",
    estimatedDurationDays: 180,
    sections: [
      section("Leadership", "Day-to-day company officer responsibilities.", [
        req("Conduct a shift briefing", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 20 }),
        req("Complete a personnel counseling scenario", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 45 }),
        req("Review station project and budget request", { evidenceType: "FILE", estimatedMinutes: 40 }),
      ], 0),
      section("Incident Command", "Initial command and company-level tactics.", [
        req("Assume command on a simulated dwelling fire", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30 }),
        req("Complete a size-up and IAP", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 25 }),
        req("Direct a two-company drill", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 60 }),
      ], 1),
      section("Training & Evaluation", "Teach and document company training.", [
        req("Deliver a 30-minute company drill", { evidenceType: "TRAINING_ATTENDANCE", estimatedMinutes: 45 }),
        req("Evaluate a probationary skill", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
      ], 2),
    ],
  },
  {
    id: "new-paramedic-orientation",
    title: "New Paramedic Orientation",
    description: "Department EMS orientation for newly hired or newly licensed paramedics.",
    category: "EMS",
    estimatedDurationDays: 90,
    sections: [
      section("EMS Systems", "How Metro Fire delivers ALS.", [
        req("Review EMS protocols and controlled substance policy", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 60 }),
        req("Complete narcotic count with a preceptor", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 20 }),
        req("Map hospitals and specialty centers", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 30 }),
      ], 0),
      section("Clinical Skills", "High-risk ALS skills under observation.", [
        req("Airway management evaluation", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30 }),
        req("Cardiac arrest management evaluation", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 30 }),
        req("12-lead acquisition and transmission", { evidenceType: "SKILL_EVALUATION", estimatedMinutes: 20 }),
      ], 1),
      section("Release to Practice", "Medical director / EMS officer sign-off.", [
        req("Preceptor recommendation", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 20 }),
        req("EMS officer final review", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 30 }),
      ], 2),
    ],
  },
  {
    id: "department-orientation",
    title: "Department Orientation",
    description: "Short onboarding task book for laterals and administrative hires.",
    category: "Department Orientation",
    estimatedDurationDays: 30,
    sections: [
      section("Welcome", "First-week department orientation.", [
        req("Complete facility tour", { evidenceType: "SUPERVISOR_OBSERVATION", estimatedMinutes: 45 }),
        req("Issue PPE and account access", { evidenceType: "WRITTEN_NOTE", estimatedMinutes: 30 }),
        req("Review harassment and workplace policy", { evidenceType: "TRAINING_ATTENDANCE", estimatedMinutes: 60 }),
      ], 0),
    ],
  },
];
