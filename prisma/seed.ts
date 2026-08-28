import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { STARTER_TEMPLATES } from "../src/server/starters";
import { computeAssignmentProgress } from "../src/lib/progress";

const prisma = new PrismaClient();

const DAYS = 86_400_000;
const now = new Date();
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAYS);
const daysAgo = (n: number) => new Date(now.getTime() - n * DAYS);

type MemberSeed = {
  id: string;
  name: string;
  email: string;
  role: string;
  rank: string;
  station: string | null;
  shift: string | null;
  status?: string;
  phone?: string;
  position?: string;
};

const MEMBERS: MemberSeed[] = [
  { id: "usr_riley", name: "Riley Chen", email: "riley.chen@metrofire.gov", role: "TRAINING_OFFICER", rank: "Training Captain", station: "Station 1", shift: "A", position: "Training Division" },
  { id: "usr_hale", name: "Morgan Hale", email: "morgan.hale@metrofire.gov", role: "DEPARTMENT_ADMINISTRATOR", rank: "Battalion Chief", station: "Headquarters", shift: null, position: "Operations / Administration" },
  { id: "usr_lee", name: "Sam Lee", email: "sam.lee@metrofire.gov", role: "EVALUATOR", rank: "Lieutenant", station: "Station 1", shift: "A", position: "Engine 1 Officer" },
  { id: "usr_alex", name: "Alex Morgan", email: "alex.morgan@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 1", shift: "A" },
  { id: "usr_jordan", name: "Jordan Smith", email: "jordan.smith@metrofire.gov", role: "MEMBER", rank: "Firefighter/EMT", station: "Station 2", shift: "B" },
  { id: "usr_taylor", name: "Taylor Brooks", email: "taylor.brooks@metrofire.gov", role: "MEMBER", rank: "Engineer", station: "Station 1", shift: "A" },
  { id: "usr_chris", name: "Chris Davis", email: "chris.davis@metrofire.gov", role: "MEMBER", rank: "Paramedic", station: "Station 3", shift: "C" },
  { id: "usr_jamie", name: "Jamie Ortiz", email: "jamie.ortiz@metrofire.gov", role: "MEMBER", rank: "Recruit", station: "Station 1", shift: "A" },
  { id: "usr_casey", name: "Casey Nguyen", email: "casey.nguyen@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 2", shift: "B", status: "INACTIVE" },
  { id: "usr_ctaylor", name: "Chris Taylor", email: "chris.taylor@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 7", shift: "A" },
  { id: "usr_avery", name: "Avery Patel", email: "avery.patel@metrofire.gov", role: "MEMBER", rank: "Firefighter/EMT", station: "Station 3", shift: "C" },
  { id: "usr_drew", name: "Drew Ramirez", email: "drew.ramirez@metrofire.gov", role: "MEMBER", rank: "Engineer", station: "Station 2", shift: "B" },
  { id: "usr_quinn", name: "Quinn Harper", email: "quinn.harper@metrofire.gov", role: "MEMBER", rank: "Lieutenant", station: "Station 2", shift: "B" },
  { id: "usr_logan", name: "Logan Bennett", email: "logan.bennett@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 7", shift: "C" },
  { id: "usr_hayden", name: "Hayden Clark", email: "hayden.clark@metrofire.gov", role: "MEMBER", rank: "Firefighter/Paramedic", station: "Station 3", shift: "A" },
  { id: "usr_reese", name: "Reese Walker", email: "reese.walker@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 1", shift: "B" },
  { id: "usr_cameron", name: "Cameron Walsh", email: "cameron.walsh@metrofire.gov", role: "MEMBER", rank: "Engineer", station: "Station 7", shift: "A" },
  { id: "usr_skyler", name: "Skyler James", email: "skyler.james@metrofire.gov", role: "MEMBER", rank: "Firefighter/EMT", station: "Station 2", shift: "C" },
  { id: "usr_parker", name: "Parker Singh", email: "parker.singh@metrofire.gov", role: "MEMBER", rank: "Paramedic", station: "Station 1", shift: "B" },
  { id: "usr_bailey", name: "Bailey Thomas", email: "bailey.thomas@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 3", shift: "B" },
  { id: "usr_jesse", name: "Jesse McKenzie", email: "jesse.mckenzie@metrofire.gov", role: "MEMBER", rank: "Recruit", station: "Station 7", shift: "C" },
  { id: "usr_dana", name: "Dana Okonkwo", email: "dana.okonkwo@metrofire.gov", role: "EVALUATOR", rank: "Captain", station: "Station 3", shift: "C", position: "Truck 3 Officer" },
  { id: "usr_pat", name: "Pat Rivera", email: "pat.rivera@metrofire.gov", role: "MEMBER", rank: "Firefighter", station: "Station 2", shift: "A" },
  { id: "usr_sydney", name: "Sydney Walsh", email: "sydney.walsh@metrofire.gov", role: "MEMBER", rank: "Firefighter/EMT", station: "Station 7", shift: "B" },
];

const EXTRA_FIRST = ["Morgan", "Kelly", "Shawn", "Robin", "Elliott", "Finley", "Rowan", "Sawyer"];
const EXTRA_LAST = ["Brooks", "Nguyen", "Cole", "Diaz", "Bennett", "Hughes", "Price", "Foster"];

async function reset() {
  await prisma.signOff.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.requirementCompletion.deleteMany();
  await prisma.taskBookAssignment.deleteMany();
  await prisma.taskBookRequirement.deleteMany();
  await prisma.taskBookSection.deleteMany();
  await prisma.taskBookVersion.deleteMany();
  await prisma.taskBookTemplate.deleteMany();
  await prisma.memberNote.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.credentialType.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.personalCredential.deleteMany();
  await prisma.personalCareerLog.deleteMany();
  await prisma.departmentMembership.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
}

async function createBook(departmentId: string, ownerId: string, starterId: string, status: "ACTIVE" | "DRAFT" | "ARCHIVED") {
  const starter = STARTER_TEMPLATES.find((item) => item.id === starterId);
  if (!starter) throw new Error(starterId);
  const template = await prisma.taskBookTemplate.create({
    data: {
      id: `tb_${starterId}`,
      departmentId,
      title: starter.title,
      description: starter.description,
      category: starter.category,
      status,
      ownerId,
      estimatedDurationDays: starter.estimatedDurationDays,
      versions: {
        create: {
          id: `ver_${starterId}_10`,
          version: "1.0",
          status: status === "DRAFT" ? "DRAFT" : "PUBLISHED",
          publishedAt: status === "DRAFT" ? null : daysAgo(40),
          publishedById: status === "DRAFT" ? null : ownerId,
        },
      },
    },
    include: { versions: true },
  });
  const versionId = template.versions[0].id;
  for (const section of starter.sections) {
    await prisma.taskBookSection.create({
      data: {
        versionId,
        title: section.title,
        description: section.description || "",
        sortOrder: section.sortOrder,
        requirements: {
          create: section.requirements.map((requirement) => ({
            title: requirement.title,
            description: requirement.description || "",
            instructions: requirement.instructions || "",
            sortOrder: requirement.sortOrder,
            isRequired: requirement.isRequired ?? true,
            evidenceType: requirement.evidenceType || "SKILL_EVALUATION",
            evaluatorSignOffRequired: requirement.evaluatorSignOffRequired ?? true,
            estimatedMinutes: requirement.estimatedMinutes ?? null,
            objectivesJson: JSON.stringify(requirement.objectives ?? []),
            tagsJson: JSON.stringify(requirement.tags ?? []),
          })),
        },
      },
    });
  }
  return prisma.taskBookVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { template: true, sections: { orderBy: { sortOrder: "asc" }, include: { requirements: { orderBy: { sortOrder: "asc" } } } } },
  });
}

async function assignBook(opts: {
  versionId: string;
  membershipId: string;
  assignedById: string;
  departmentId: string;
  evaluatorId?: string;
  supervisorId?: string;
  assignedDate: Date;
  dueDate?: Date | null;
  approveTitles?: string[];
  submitTitles?: Array<{ title: string; notes: string; evidence: string; type: string }>;
  overdueTitles?: string[];
}) {
  const assignment = await prisma.taskBookAssignment.create({
    data: {
      departmentId: opts.departmentId,
      versionId: opts.versionId,
      membershipId: opts.membershipId,
      assignedById: opts.assignedById,
      assignedDate: opts.assignedDate,
      dueDate: opts.dueDate ?? null,
      evaluatorId: opts.evaluatorId ?? null,
      supervisorId: opts.supervisorId ?? null,
      status: "NOT_STARTED",
    },
  });
  const version = await prisma.taskBookVersion.findUniqueOrThrow({
    where: { id: opts.versionId },
    include: { sections: { include: { requirements: true } } },
  });
  const byTitle = new Map(version.sections.flatMap((section) => section.requirements.map((req) => [req.title, req])));

  for (const title of opts.approveTitles ?? []) {
    const requirement = byTitle.get(title);
    if (!requirement) continue;
    const completion = await prisma.requirementCompletion.create({
      data: {
        assignmentId: assignment.id,
        requirementId: requirement.id,
        membershipId: opts.membershipId,
        status: "APPROVED",
        memberNotes: "Completed during company drill.",
        submittedAt: daysAgo(12),
        completedAt: daysAgo(10),
      },
    });
    await prisma.signOff.create({
      data: {
        completionId: completion.id,
        evaluatorId: opts.evaluatorId || opts.assignedById,
        result: "APPROVED",
        notes: "Meets department standard.",
        signedAt: daysAgo(10),
      },
    });
  }

  for (const item of opts.submitTitles ?? []) {
    const requirement = byTitle.get(item.title);
    if (!requirement) continue;
    const completion = await prisma.requirementCompletion.create({
      data: {
        assignmentId: assignment.id,
        requirementId: requirement.id,
        membershipId: opts.membershipId,
        status: "SUBMITTED",
        memberNotes: item.notes,
        submittedAt: daysAgo(1),
      },
    });
    await prisma.evidence.create({
      data: {
        completionId: completion.id,
        type: item.type,
        description: item.evidence,
        uploadedAt: daysAgo(1),
      },
    });
  }

  const completions = await prisma.requirementCompletion.findMany({ where: { assignmentId: assignment.id } });
  const progress = computeAssignmentProgress({
    requirements: version.sections.flatMap((section) => section.requirements),
    completions,
    assignedDate: opts.assignedDate,
    dueDate: opts.dueDate ?? null,
  });
  await prisma.taskBookAssignment.update({ where: { id: assignment.id }, data: { status: progress.status } });
  return assignment;
}

async function addCredential(opts: {
  membershipId: string;
  departmentId: string;
  typeId?: string;
  name: string;
  issuer: string;
  number?: string;
  issueDaysAgo: number;
  expiresInDays?: number | null;
  verification?: string;
  notes?: string;
}) {
  return prisma.credential.create({
    data: {
      membershipId: opts.membershipId,
      departmentId: opts.departmentId,
      credentialTypeId: opts.typeId ?? null,
      credentialName: opts.name,
      issuer: opts.issuer,
      credentialNumber: opts.number ?? null,
      issueDate: daysAgo(opts.issueDaysAgo),
      expirationDate: opts.expiresInDays == null ? null : daysFromNow(opts.expiresInDays),
      verificationStatus: opts.verification ?? "VERIFIED",
      notes: opts.notes ?? "",
    },
  });
}

async function main() {
  await reset();
  const passwordHash = await bcrypt.hash("demo", 10);

  const extras: MemberSeed[] = [];
  for (let i = 0; i < 16; i++) {
    extras.push({
      id: `usr_extra_${i}`,
      name: `${EXTRA_FIRST[i % EXTRA_FIRST.length]} ${EXTRA_LAST[i % EXTRA_LAST.length]} ${i + 1}`,
      email: `member${i + 1}@metrofire.gov`,
      role: "MEMBER",
      rank: i % 5 === 0 ? "Engineer" : "Firefighter",
      station: `Station ${[1, 2, 3, 7][i % 4]}`,
      shift: ["A", "B", "C"][i % 3],
    });
  }

  const allMembers = [...MEMBERS, ...extras];
  for (const member of allMembers) {
    await prisma.user.create({
      data: {
        id: member.id,
        name: member.name,
        email: member.email,
        passwordHash,
        phone: member.phone ?? "555-0100",
      },
    });
  }

  const department = await prisma.department.create({
    data: {
      id: "dept_metro",
      name: "Metro Fire & Rescue",
      publicId: "MFR-001",
      joinCode: "NFR-4821",
      address: "1400 Commerce Street",
      city: "Metro City",
      state: "TX",
      zip: "75001",
      timezone: "America/Chicago",
      contactName: "Riley Chen",
      contactEmail: "training@metrofire.gov",
      contactPhone: "555-0141",
      createdById: "usr_hale",
    },
  });

  const membershipIds = new Map<string, string>();
  for (const member of allMembers) {
    const membership = await prisma.departmentMembership.create({
      data: {
        id: `mem_${member.id.replace("usr_", "")}`,
        departmentId: department.id,
        userId: member.id,
        role: member.role,
        status: member.status ?? "ACTIVE",
        rank: member.rank,
        position: member.position ?? null,
        station: member.station,
        shift: member.shift,
        joinedAt: daysAgo(200),
      },
    });
    membershipIds.set(member.id, membership.id);
  }

  const standard = [
    "EMT", "AEMT", "Paramedic", "CPR", "ACLS", "PALS", "Firefighter I", "Firefighter II",
    "HazMat Awareness", "HazMat Operations", "Driver / Operator – Pumper", "Fire Officer I",
    "Fire Officer II", "Fire Instructor I",
  ];
  const custom = [
    "Department Driver Authorization", "Engine Operator", "Wildland Red Card",
    "Annual Fit Test", "SCBA Qualification", "Annual EMS Competency",
  ];
  const typeIds = new Map<string, string>();
  for (const name of standard) {
    const type = await prisma.credentialType.create({
      data: { departmentId: department.id, name, issuerDefault: name.includes("CPR") || name.includes("ACLS") || name.includes("PALS") ? "American Heart Association" : "State Fire / EMS Office" },
    });
    typeIds.set(name, type.id);
  }
  for (const name of custom) {
    const type = await prisma.credentialType.create({
      data: { departmentId: department.id, name, isCustom: true, issuerDefault: "Metro Fire & Rescue" },
    });
    typeIds.set(name, type.id);
  }

  const probation = await createBook(department.id, "usr_riley", "probationary-firefighter", "ACTIVE");
  const driver = await createBook(department.id, "usr_riley", "driver-operator-pumper", "ACTIVE");
  const officer = await createBook(department.id, "usr_riley", "fire-officer-i", "ACTIVE");
  const medic = await createBook(department.id, "usr_riley", "new-paramedic-orientation", "ACTIVE");
  await createBook(department.id, "usr_riley", "department-orientation", "DRAFT");

  const probationTitles = probation.sections.flatMap((section) => section.requirements.map((req) => req.title));
  const alexApprove = probationTitles.filter(
    (title) =>
      ![
        "Deploy 1¾-inch attack line",
        "Advance charged line to fire floor",
        "Probationary skills verification",
        "Shift officer recommendation",
        "Training officer final review",
        "Complete HR / benefits briefing",
      ].includes(title),
  );

  await assignBook({
    versionId: probation.id,
    membershipId: membershipIds.get("usr_alex")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(120),
    dueDate: daysFromNow(40),
    approveTitles: alexApprove,
    submitTitles: [
      {
        title: "Deploy 1¾-inch attack line",
        notes: "Completed on the drill ground with Engine 1. Had one kink at the front bumper on the first pull, corrected and re-advanced.",
        evidence: "Photo of charged 1¾-inch line deployed to the training tower stairwell, Engine 1.",
        type: "PHOTO",
      },
      {
        title: "Advance charged line to fire floor",
        notes: "Advanced to the second floor of the tower. Nozzle control was solid; needs one more repetition on long stretches.",
        evidence: "Skill evaluation sheet initialed by Lt. Lee after the Thursday tower drill.",
        type: "SKILL_EVALUATION",
      },
    ],
  });

  await assignBook({
    versionId: driver.id,
    membershipId: membershipIds.get("usr_alex")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(5),
    dueDate: daysFromNow(175),
  });

  const jordanProbation = probationTitles;
  await assignBook({
    versionId: probation.id,
    membershipId: membershipIds.get("usr_jordan")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(280),
    dueDate: daysAgo(20),
    approveTitles: jordanProbation,
  });

  const driverTitles = driver.sections.flatMap((section) => section.requirements.map((req) => req.title));
  await assignBook({
    versionId: driver.id,
    membershipId: membershipIds.get("usr_jordan")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(70),
    dueDate: daysFromNow(110),
    approveTitles: driverTitles.slice(0, 5),
    submitTitles: [
      {
        title: driverTitles[5],
        notes: "Pumped a 1¾-inch line from hydrant supply during Saturday drill. Residual held at 20 psi.",
        evidence: "Pump chart photo and hydrant residual reading.",
        type: "PHOTO",
      },
    ],
  });

  await assignBook({
    versionId: driver.id,
    membershipId: membershipIds.get("usr_taylor")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(40),
    dueDate: daysFromNow(80),
    approveTitles: driverTitles.slice(0, 8),
  });

  const officerTitles = officer.sections.flatMap((section) => section.requirements.map((req) => req.title));
  await assignBook({
    versionId: officer.id,
    membershipId: membershipIds.get("usr_lee")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_hale",
    assignedDate: daysAgo(15),
    dueDate: daysFromNow(160),
  });
  await assignBook({
    versionId: officer.id,
    membershipId: membershipIds.get("usr_quinn")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    assignedDate: daysAgo(50),
    dueDate: daysFromNow(90),
    approveTitles: officerTitles.slice(0, 3),
  });

  const medicTitles = medic.sections.flatMap((section) => section.requirements.map((req) => req.title));
  await assignBook({
    versionId: medic.id,
    membershipId: membershipIds.get("usr_chris")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_dana",
    assignedDate: daysAgo(25),
    dueDate: daysFromNow(65),
    approveTitles: medicTitles.slice(0, 4),
  });

  await assignBook({
    versionId: probation.id,
    membershipId: membershipIds.get("usr_jamie")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(80),
    dueDate: daysAgo(10),
    approveTitles: probationTitles.slice(0, 6),
  });

  await assignBook({
    versionId: probation.id,
    membershipId: membershipIds.get("usr_ctaylor")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(3),
    dueDate: daysFromNow(360),
    approveTitles: probationTitles.slice(0, 2),
  });

  await assignBook({
    versionId: probation.id,
    membershipId: membershipIds.get("usr_jesse")!,
    assignedById: "usr_riley",
    departmentId: department.id,
    evaluatorId: "usr_lee",
    assignedDate: daysAgo(45),
    dueDate: daysAgo(5),
    approveTitles: probationTitles.slice(0, 8),
  });

  const mem = (userId: string) => membershipIds.get(userId)!;
  await addCredential({ membershipId: mem("usr_alex"), departmentId: department.id, typeId: typeIds.get("EMT"), name: "EMT", issuer: "Texas DSHS", number: "EMT-44821", issueDaysAgo: 400, expiresInDays: 330 });
  await addCredential({ membershipId: mem("usr_alex"), departmentId: department.id, typeId: typeIds.get("CPR"), name: "CPR", issuer: "American Heart Association", number: "CPR-19-8821", issueDaysAgo: 317, expiresInDays: 48 });
  await addCredential({ membershipId: mem("usr_alex"), departmentId: department.id, typeId: typeIds.get("HazMat Operations"), name: "HazMat Operations", issuer: "TCFP", issueDaysAgo: 500, expiresInDays: 400 });
  await addCredential({ membershipId: mem("usr_alex"), departmentId: department.id, typeId: typeIds.get("Firefighter I"), name: "Firefighter I", issuer: "TCFP", issueDaysAgo: 200, expiresInDays: 900 });

  await addCredential({ membershipId: mem("usr_jordan"), departmentId: department.id, typeId: typeIds.get("EMT"), name: "EMT", issuer: "Texas DSHS", number: "EMT-33109", issueDaysAgo: 669, expiresInDays: 61 });
  await addCredential({ membershipId: mem("usr_jordan"), departmentId: department.id, typeId: typeIds.get("CPR"), name: "CPR", issuer: "American Heart Association", issueDaysAgo: 100, expiresInDays: 265 });
  await addCredential({ membershipId: mem("usr_jordan"), departmentId: department.id, typeId: typeIds.get("Firefighter II"), name: "Firefighter II", issuer: "TCFP", issueDaysAgo: 800, expiresInDays: 200 });

  await addCredential({ membershipId: mem("usr_taylor"), departmentId: department.id, typeId: typeIds.get("EMT"), name: "EMT", issuer: "Texas DSHS", issueDaysAgo: 200, expiresInDays: 500 });
  await addCredential({ membershipId: mem("usr_taylor"), departmentId: department.id, typeId: typeIds.get("Driver / Operator – Pumper"), name: "Driver / Operator – Pumper", issuer: "TCFP", issueDaysAgo: 600, expiresInDays: 140 });
  await addCredential({ membershipId: mem("usr_taylor"), departmentId: department.id, typeId: typeIds.get("Department Driver Authorization"), name: "Department Driver Authorization", issuer: "Metro Fire & Rescue", issueDaysAgo: 200, expiresInDays: 20 });

  await addCredential({ membershipId: mem("usr_chris"), departmentId: department.id, typeId: typeIds.get("Paramedic"), name: "Paramedic", issuer: "Texas DSHS", number: "P-88210", issueDaysAgo: 300, expiresInDays: 420 });
  await addCredential({ membershipId: mem("usr_chris"), departmentId: department.id, typeId: typeIds.get("ACLS"), name: "ACLS", issuer: "American Heart Association", issueDaysAgo: 200, expiresInDays: 120 });
  await addCredential({ membershipId: mem("usr_chris"), departmentId: department.id, typeId: typeIds.get("PALS"), name: "PALS", issuer: "American Heart Association", issueDaysAgo: 400, expiresInDays: -12 });
  await addCredential({ membershipId: mem("usr_chris"), departmentId: department.id, typeId: typeIds.get("CPR"), name: "CPR", issuer: "American Heart Association", issueDaysAgo: 80, expiresInDays: 285 });

  await addCredential({ membershipId: mem("usr_lee"), departmentId: department.id, typeId: typeIds.get("Fire Officer I"), name: "Fire Officer I", issuer: "TCFP", issueDaysAgo: 900, expiresInDays: 200 });
  await addCredential({ membershipId: mem("usr_lee"), departmentId: department.id, typeId: typeIds.get("Firefighter II"), name: "Firefighter II", issuer: "TCFP", issueDaysAgo: 2000, expiresInDays: null, verification: "MISSING_INFO", notes: "Certificate on file; expiration not recorded." });

  await addCredential({ membershipId: mem("usr_jamie"), departmentId: department.id, typeId: typeIds.get("CPR"), name: "CPR", issuer: "American Heart Association", issueDaysAgo: 20, expiresInDays: 345 });
  await addCredential({ membershipId: mem("usr_hayden"), departmentId: department.id, typeId: typeIds.get("Paramedic"), name: "Paramedic", issuer: "Texas DSHS", issueDaysAgo: 100, expiresInDays: 18 });
  await addCredential({ membershipId: mem("usr_parker"), departmentId: department.id, typeId: typeIds.get("ACLS"), name: "ACLS", issuer: "American Heart Association", issueDaysAgo: 700, expiresInDays: 6 });

  for (const userId of allMembers.filter((m) => m.role === "MEMBER" && !["usr_casey"].includes(m.id)).map((m) => m.id)) {
    if (["usr_alex", "usr_jordan", "usr_taylor", "usr_chris", "usr_jamie", "usr_hayden", "usr_parker", "usr_lee"].includes(userId)) continue;
    await addCredential({
      membershipId: mem(userId),
      departmentId: department.id,
      typeId: typeIds.get("CPR"),
      name: "CPR",
      issuer: "American Heart Association",
      issueDaysAgo: 100 + (userId.length % 40),
      expiresInDays: 80 + (userId.charCodeAt(4) % 200),
    });
    await addCredential({
      membershipId: mem(userId),
      departmentId: department.id,
      typeId: typeIds.get("EMT"),
      name: "EMT",
      issuer: "Texas DSHS",
      issueDaysAgo: 300,
      expiresInDays: 200 + (userId.charCodeAt(5) % 300),
    });
  }

  await prisma.personalCredential.create({
    data: {
      userId: "usr_alex",
      name: "Wildland Firefighter Type 2 (personal)",
      issuer: "Prior department — Redwood FD",
      issueDate: daysAgo(900),
      expirationDate: daysFromNow(200),
      notes: "Personal Career Road record. Not visible to Metro Fire administrators.",
    },
  });
  await prisma.personalCareerLog.create({
    data: {
      userId: "usr_alex",
      title: "Completed FFI at Redwood Fire Academy",
      detail: "Personal history from a previous agency.",
      occurredAt: daysAgo(1400),
    },
  });

  await prisma.memberNote.create({
    data: {
      membershipId: mem("usr_alex"),
      departmentId: department.id,
      authorId: "usr_lee",
      body: "Strong on engine work. Schedule a second tower evolution for long-line stretches before final probationary skills.",
      createdAt: daysAgo(4),
    },
  });

  await prisma.invitation.create({
    data: {
      departmentId: department.id,
      email: "new.recruit@metrofire.gov",
      token: "demo-invite-token",
      role: "MEMBER",
      rank: "Recruit",
      station: "Station 1",
      shift: "A",
      invitedById: "usr_riley",
      status: "PENDING",
      expiresAt: daysFromNow(10),
    },
  });

  const activities: Array<{ userId: string; type: string; daysAgo: number; metadata: Record<string, unknown> }> = [
    { userId: "usr_alex", type: "REQUIREMENT_COMPLETED", daysAgo: 2, metadata: { memberName: "Alex Morgan", requirement: "Firefighter II objective", actorName: "Alex Morgan" } },
    { userId: "usr_jordan", type: "CREDENTIAL_UPLOADED", daysAgo: 3, metadata: { memberName: "Jordan Smith", credential: "EMT renewal", actorName: "Jordan Smith" } },
    { userId: "usr_lee", type: "REQUIREMENT_SIGNED", daysAgo: 4, metadata: { actorName: "Lt. Sam Lee", memberName: "Alex Morgan", requirement: "Engine Operations requirement", taskBook: "Probationary Firefighter" } },
    { userId: "usr_ctaylor", type: "TASKBOOK_ASSIGNED", daysAgo: 3, metadata: { memberName: "Chris Taylor", title: "Probationary Firefighter", actorName: "Capt. Riley Chen" } },
    { userId: "usr_chris", type: "REQUIREMENT_COMPLETED", daysAgo: 6, metadata: { memberName: "Chris Davis", requirement: "Airway management evaluation" } },
    { userId: "usr_riley", type: "TASKBOOK_PUBLISHED", daysAgo: 40, metadata: { actorName: "Capt. Riley Chen", title: "Probationary Firefighter", version: "1.0" } },
  ];
  for (const event of activities) {
    await prisma.activityEvent.create({
      data: {
        departmentId: department.id,
        userId: event.userId,
        type: event.type,
        timestamp: daysAgo(event.daysAgo),
        metadataJson: JSON.stringify(event.metadata),
      },
    });
  }

  console.log("Seeded Metro Fire & Rescue");
  console.log("Training Officer login: riley.chen@metrofire.gov / demo");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
