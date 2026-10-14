/** Colorado DFPC Firefighter I JPR class preset; NFPA 1010 (2024 ed.).
 * Index and initial/renewal designations transcribed from the supplied 07-01-2026 cover.
 * A class template is NOT a published step-by-step skill checklist or certification award.
 */
export const firefighterOneJprs = [
  {
    "code": "1A",
    "title": "Donning PPE",
    "standard": "6.1.2",
    "requirement": "Mandatory"
  },
  {
    "code": "1B",
    "title": "Ropes and Knots",
    "standard": "6.1.2; 6.3.20",
    "requirement": "Mandatory"
  },
  {
    "code": "1C",
    "title": "Hoisting Tools",
    "standard": "6.1.2; 6.3.20",
    "requirement": "Random"
  },
  {
    "code": "1D",
    "title": "Documentation, Standard, or Code",
    "standard": "6.1.2; 6.3.20",
    "requirement": "Random"
  },
  {
    "code": "1E",
    "title": "Field reduction and Doff PPE",
    "standard": "6.1.2",
    "requirement": "Random"
  },
  {
    "code": "2A",
    "title": "Initiate a Response",
    "standard": "6.2.1",
    "requirement": "Random"
  },
  {
    "code": "2B",
    "title": "Transmit and receive communication",
    "standard": "6.2.2",
    "requirement": "Random"
  },
  {
    "code": "2C",
    "title": "Mayday Operations",
    "standard": "6.2.3",
    "requirement": "Mandatory"
  },
  {
    "code": "3A",
    "title": "Don SCBA and Emergency Procedures",
    "standard": "6.3.1; 6.3.9",
    "requirement": "Mandatory"
  },
  {
    "code": "3B",
    "title": "Respond on Apparatus",
    "standard": "6.3.2",
    "requirement": "Random"
  },
  {
    "code": "3C",
    "title": "Scene Safety",
    "standard": "6.3.3",
    "requirement": "Random"
  },
  {
    "code": "3D",
    "title": "Forcible Entry",
    "standard": "6.3.4",
    "requirement": "Mandatory"
  },
  {
    "code": "3E",
    "title": "Exit Hazardous Environment",
    "standard": "6.3.5",
    "requirement": "Random"
  },
  {
    "code": "3F",
    "title": "Ground Ladders",
    "standard": "6.3.6",
    "requirement": "Mandatory"
  },
  {
    "code": "3G",
    "title": "Vehicle Fire",
    "standard": "6.3.7",
    "requirement": "Mandatory"
  },
  {
    "code": "3H",
    "title": "Class A Fire - Stacked or Piled",
    "standard": "6.3.8",
    "requirement": "Random"
  },
  {
    "code": "3I",
    "title": "Search and Rescue",
    "standard": "6.3.9",
    "requirement": "Mandatory"
  },
  {
    "code": "3J",
    "title": "Horizontal Ventilation",
    "standard": "6.3.11",
    "requirement": "Mandatory"
  },
  {
    "code": "3K",
    "title": "Vertical Ventilation",
    "standard": "6.3.12",
    "requirement": "Random"
  },
  {
    "code": "3L",
    "title": "Overhaul a Fire Scene",
    "standard": "6.3.13",
    "requirement": "Random"
  },
  {
    "code": "3M",
    "title": "Salvage",
    "standard": "6.3.14",
    "requirement": "Random"
  },
  {
    "code": "3N",
    "title": "Water Supply",
    "standard": "6.3.15",
    "requirement": "Mandatory"
  },
  {
    "code": "3O",
    "title": "Extinguishers",
    "standard": "6.3.16",
    "requirement": "Random"
  },
  {
    "code": "3P",
    "title": "Scene Lighting",
    "standard": "6.3.17",
    "requirement": "Random"
  },
  {
    "code": "3Q",
    "title": "Control Utilities",
    "standard": "6.3.18",
    "requirement": "Random"
  },
  {
    "code": "3R",
    "title": "Ground Fire",
    "standard": "6.3.19",
    "requirement": "Random"
  },
  {
    "code": "3S",
    "title": "Air Monitoring",
    "standard": "6.3.21",
    "requirement": "Random"
  },
  {
    "code": "5A",
    "title": "Clean and Check Equipment",
    "standard": "6.5.1",
    "requirement": "Random"
  },
  {
    "code": "5B",
    "title": "Clean and Inspect Hose",
    "standard": "6.5.2",
    "requirement": "Mandatory"
  },
  {
    "code": "Live Fire A",
    "title": "Ground-level Fire",
    "standard": "6.3.10",
    "requirement": "Live Fire option"
  },
  {
    "code": "Live Fire B",
    "title": "Above-level Fire",
    "standard": "6.3.10",
    "requirement": "Live Fire option"
  },
  {
    "code": "Live Fire C",
    "title": "Below-level Fire",
    "standard": "6.3.10",
    "requirement": "Live Fire option"
  }
] as const;

export const firefighterOneClassPreset = {
  name: "Firefighter I — Colorado DFPC (NFPA 1010:2024)",
  defaultTitle: "Firefighter I — Skills Training & Evaluation",
  classType: "FIRE_ACADEMY",
  trainingCategory: "COMPANY",
  creditHours: 0,
  checklistVersionId: "",
  location: "",
  notes: "SOURCE: Colorado DFPC Firefighter I JPR skill sheets, NFPA 1010 (2024 edition), cover dated 07-01-2026.\nINITIAL CERTIFICATION: 12 mandatory JPRs + 4 randomly selected JPRs. One of Live Fire A/B/C is randomly selected.\nRENEWAL: Complete the performance outcome on all skill sheets, including subsections.\nSafety violation is grounds for automatic failure; all proctors present review the violation.\nUse the source skill sheet for every individual task step; mark pass/fail and collect evaluator signature and date. Do not award certification based on attendance alone.\nMandatory: 1A, 1B, 2C, 3A, 3D, 3F, 3G, 3I, 3J, 3N, 5B; plus one Live Fire variant.\nJPR INDEX:\n1A Donning PPE (6.1.2) [Mandatory]\n1B Ropes and Knots (6.1.2; 6.3.20) [Mandatory]\n1C Hoisting Tools (6.1.2; 6.3.20) [Random]\n1D Documentation, Standard, or Code (6.1.2; 6.3.20) [Random]\n1E Field reduction and Doff PPE (6.1.2) [Random]\n2A Initiate a Response (6.2.1) [Random]\n2B Transmit and receive communication (6.2.2) [Random]\n2C Mayday Operations (6.2.3) [Mandatory]\n3A Don SCBA and Emergency Procedures (6.3.1; 6.3.9) [Mandatory]\n3B Respond on Apparatus (6.3.2) [Random]\n3C Scene Safety (6.3.3) [Random]\n3D Forcible Entry (6.3.4) [Mandatory]\n3E Exit Hazardous Environment (6.3.5) [Random]\n3F Ground Ladders (6.3.6) [Mandatory]\n3G Vehicle Fire (6.3.7) [Mandatory]\n3H Class A Fire - Stacked or Piled (6.3.8) [Random]\n3I Search and Rescue (6.3.9) [Mandatory]\n3J Horizontal Ventilation (6.3.11) [Mandatory]\n3K Vertical Ventilation (6.3.12) [Random]\n3L Overhaul a Fire Scene (6.3.13) [Random]\n3M Salvage (6.3.14) [Random]\n3N Water Supply (6.3.15) [Mandatory]\n3O Extinguishers (6.3.16) [Random]\n3P Scene Lighting (6.3.17) [Random]\n3Q Control Utilities (6.3.18) [Random]\n3R Ground Fire (6.3.19) [Random]\n3S Air Monitoring (6.3.21) [Random]\n5A Clean and Check Equipment (6.5.1) [Random]\n5B Clean and Inspect Hose (6.5.2) [Mandatory]\nLive Fire A Ground-level Fire (6.3.10) [Live Fire option]\nLive Fire B Above-level Fire (6.3.10) [Live Fire option]\nLive Fire C Below-level Fire (6.3.10) [Live Fire option]\nInstructor: record selected random JPRs, live-fire variant, student remediation/retest, and all evaluator signatures.",
  selfRegistration: true,
  proctorUserIds: [] as string[],
  customFields: [],
};
