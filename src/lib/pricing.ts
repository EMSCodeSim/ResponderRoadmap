export const ACTIVE_MEMBER_WINDOW_DAYS = 90;

export const PLAN_IDS = ["FREE", "STATION", "FOUNDING", "DEPARTMENT"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PublicPlan = {
  id: PlanId;
  name: string;
  price: string;
  term?: string;
  description: string;
  bullets: string[];
  href: string;
  cta: string;
  featured?: boolean;
  /** Null means no public cap (custom / contact). */
  activeMemberCap: number | null;
};

/** Public plans, in display order. Same product — only the active-member cap changes. */
export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "FREE",
    name: "Free / Crew",
    price: "$0",
    description: "Up to 5 active members",
    bullets: ["Training readiness workflow", "Task Books and Assignments", "No card required"],
    href: "/register",
    cta: "Start Free",
    activeMemberCap: 5,
  },
  {
    id: "STATION",
    name: "Station",
    price: "$299",
    term: "/ year",
    description: "Up to 25 active members",
    bullets: ["Task Books and Assignments", "Digital training sheets + QR attendance", "Training hours, certifications, and gaps", "No setup fee"],
    href: "/department-interest?plan=station",
    cta: "Start Station",
    featured: true,
    activeMemberCap: 25,
  },
  {
    id: "FOUNDING",
    name: "Founding Department",
    price: "$500",
    term: "/ year",
    description: "Up to 75 active members",
    bullets: ["Full training readiness workflow", "Role expectations + training gaps", "Digital training sheets + RMS export", "Price locked while subscribed"],
    href: "/department-interest?plan=founding",
    cta: "Ask about founding access",
    activeMemberCap: 75,
  },
  {
    id: "DEPARTMENT",
    name: "Department / Agency",
    price: "76+",
    description: "Active members · Contact for pricing",
    bullets: ["Full training readiness workflow", "Department-scale onboarding", "Quotes, invoices, W-9s, and POs"],
    href: "/department-interest?plan=department",
    cta: "Contact for pricing",
    activeMemberCap: null,
  },
];

export const PRICING_HEADLINE = "Fire & EMS training readiness without enterprise software pricing.";
export const PRICING_FOOTNOTE =
  "Every plan is built around the same focused training-readiness workflow. Plans differ primarily by active-member capacity. An active member is someone assigned a Task Book or who signed in during the last 90 days — not the whole roster.";
export const PRICING_SUMMARY = "Free for 5 active members, Station $299/year for 25, Founding Department $500/year for 75, and custom pricing above that.";

export type InterestCopy = {
  kicker: string;
  title: string;
  intro: string;
  priceLabel: string;
  price: string;
  priceDetail: string;
  bullets: string[];
  lockNote?: string;
  formKicker: string;
  formTitle: string;
  formIntro: string;
  intentQuestion: string;
  consent: string;
  submit: string;
  completeTitle: string;
  completeBody: string;
};

export function interestCopy(plan: PlanId): InterestCopy {
  if (plan === "STATION") {
    return {
      kicker: "Station plan",
      title: "Start Station for your crew.",
      intro: "Station is $299/year for up to 25 active members. Same focused training-readiness workflow as Free. No setup fee. We’ll follow up with checkout — the price is $299 either way.",
      priceLabel: "Station pricing",
      price: "$299/year",
      priceDetail: "Up to 25 active members. Task Books, Assignments, training records, readiness tracking, and reporting.",
      bullets: ["Task Books and Assignments", "Digital training sheets + QR attendance", "Training hours, certifications, and gaps", "No setup fee"],
      formKicker: "Start Station",
      formTitle: "Station interest",
      formIntro: "Tell us who to contact. Station is $299/year for a 6–25 person crew.",
      intentQuestion: "Would you start Station at $299/year for up to 25 active members?",
      consent: "Yes, contact me about Station access and checkout.",
      submit: "Start Station",
      completeTitle: "Station request received.",
      completeBody: "We’ll follow up with Station checkout at $299/year. No payment is required today.",
    };
  }
  if (plan === "DEPARTMENT") {
    return {
      kicker: "Department / Agency",
      title: "76 or more active members.",
      intro: "Department-scale onboarding for larger agencies. Ask for a quote, invoice, W-9, or purchase order.",
      priceLabel: "Department pricing",
      price: "Contact for pricing",
      priceDetail: "76+ active members. Full training-readiness workflow with custom onboarding.",
      bullets: ["Full training-readiness workflow", "Department-scale onboarding", "Quotes, invoices, W-9s, and POs", "Unlimited Task Books"],
      formKicker: "Department contact",
      formTitle: "Request department pricing",
      formIntro: "Tell us about the agency. We’ll send a quote or the purchasing paperwork you need.",
      intentQuestion: "Should we contact you with department pricing and purchasing options?",
      consent: "Yes, contact me about department pricing, quotes, or invoices.",
      submit: "Contact for pricing",
      completeTitle: "We’ll be in touch.",
      completeBody: "We’ll follow up with department pricing and the purchasing paperwork you asked for.",
    };
  }
  return {
    kicker: "Founding Department List",
    title: "Interested in using this at your department?",
    intro: "Founding stays $500/year for current and early department buyers — up to 75 active members. Price locked while you stay subscribed.",
    priceLabel: "Founding Department pricing",
    price: "$500/year",
    priceDetail: "Up to 75 active members. No setup fee. Price locked while subscribed.",
    bullets: [
      "Unlimited Task Books",
      "Unlimited evaluators and admins",
      "No setup fee",
      "Price locked while subscribed",
    ],
    lockNote: "Founding Department pricing stays locked at $500/year while the subscription remains active.",
    formKicker: "20-second signup",
    formTitle: "Founding Department Interest",
    formIntro: "Tell us enough to know whether the Founding Department plan fits your agency.",
    intentQuestion: "Would you consider the $500/year Founding Department plan for up to 75 active members?",
    consent: "Yes, contact me about Founding Department access and ResponderRoadmap launch.",
    submit: "Ask about founding access",
    completeTitle: "You’re on the list.",
    completeBody: "We will contact you about Founding Department access. There is no commitment and no payment required today.",
  };
}

export function planFromQuery(value: string | null | undefined): PlanId {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "station") return "STATION";
  if (normalized === "founding") return "FOUNDING";
  if (normalized === "department" || normalized === "agency") return "DEPARTMENT";
  if (normalized === "free" || normalized === "crew") return "FREE";
  return "FOUNDING";
}

export function publicPlan(id: PlanId) {
  return PUBLIC_PLANS.find((plan) => plan.id === id) ?? PUBLIC_PLANS[2];
}

/** Cap used for activation. Legacy and unknown paid plans stay uncapped. */
export function activeMemberCapForPlan(plan: string | null | undefined): number | null {
  const id = String(plan || "").trim().toUpperCase();
  if (id === "FREE") return 5;
  if (id === "STATION") return 25;
  if (id === "FOUNDING") return 75;
  return null;
}

export function planCapacityMessage(plan: string | null | undefined) {
  const cap = activeMemberCapForPlan(plan);
  if (cap === 5) return "The free plan includes five active members. Station is $299/year for up to 25.";
  if (cap === 25) return "The Station plan includes 25 active members. Founding is $500/year for up to 75.";
  if (cap === 75) return "The Founding plan includes 75 active members. Contact us for 76 or more.";
  return "This department does not have an active-member cap.";
}
