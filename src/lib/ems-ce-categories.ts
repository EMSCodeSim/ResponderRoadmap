/** EMS continuing-education credit taxonomy. Category labels are kept verbatim for reporting. */
export const EMS_CE_CATEGORIES: Record<string, readonly string[]> = {
  "Airway": [
    "Airway Management",
    "Supraglottic Airways",
    "CPAP / Respiratory Support",
    "Airway Pharmacology",
    "Capnography"
  ],
  "Cardiology": [
    "Acute Coronary Syndrome",
    "Cardiac Arrest Management",
    "ECG Interpretation",
    "Cardiac Dysrhythmias",
    "Post-ROSC Care",
    "Cardiac Medications"
  ],
  "Trauma": [
    "Head / Brain Injury",
    "Chest Trauma",
    "Abdominal Trauma",
    "Spinal Injuries",
    "Hemorrhage Control",
    "Shock Management",
    "Musculoskeletal Trauma"
  ],
  "Medical": [
    "Respiratory Emergencies",
    "Diabetic Emergencies",
    "Neurologic Emergencies",
    "Sepsis",
    "Allergic Reactions / Anaphylaxis",
    "Toxicology / Overdose",
    "Environmental Emergencies",
    "Infectious Disease",
    "Behavioral Emergencies"
  ],
  "Operations": [
    "EMS Safety",
    "Ambulance Operations",
    "Crew Resource Management",
    "Mass Casualty Incidents",
    "Incident Command",
    "Documentation / Legal",
    "Communications"
  ],
  "Pediatric / Obstetrics": [
    "Normal Childbirth",
    "Obstetric Emergencies",
    "Neonatal Resuscitation",
    "Pregnancy Complications",
    "Pediatric Assessment",
    "Pediatric Respiratory Emergencies",
    "Pediatric Medical Emergencies",
    "Pediatric Trauma"
  ],
  "Local / State": [
    "Protocol Updates",
    "Equipment Training",
    "Medication Updates",
    "Regional EMS Updates",
    "Agency Policies",
    "Quality Improvement",
    "Scenario Training"
  ],
  "Individual": [
    "General EMS Continuing Education",
    "Specialty EMS Training",
    "Professional Development"
  ]
};

export function emsCreditSummary(credits: Record<string, number>): string {
  const entries = Object.entries(credits).filter(([, hours]) => Number.isFinite(hours) && hours > 0);
  return entries.length ? 'EMS CE CREDIT BREAKDOWN\\n' + entries.map(([topic, hours]) => `${topic}: ${hours.toFixed(2)} hours`).join('\\n') : '';
}
