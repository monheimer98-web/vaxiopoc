// server/immunizationEngine.ts

/**
 * Impfplan-Engine für Reiseimpfungen nach STIKO.
 *
 * - Pure Backend-Logik (kein React)
 * - Nimmt den Fragebogen (QuestionnaireAnswers) entgegen
 * - Liest die STIKO-JSON (stiko_all_final.json)
 * - Gibt einen strukturierten Impfplan zurück
 */

// -------------------------------------------------------
// Typen – kompatibel zum Frontend-Fragebogen
// -------------------------------------------------------

export type TravelCondition = 1 | 2 | 3;
export type RuralExposure = "none" | "also_rural" | "mostly_rural" | null;
export type TravelOrganisation = "organized" | "individual" | "business" | null;

export type PregnancyStatus = "none" | "pregnant" | "lactating" | null;
export type VaccinationStatusState = "complete" | "incomplete" | "unknown";

export interface TravelAnswers {
  countries: string[];
  regionsDescription: string;
  startDate: string | null; // ISO-Datum
  endDate: string | null; // ISO-Datum
  travelCondition: TravelCondition | null;
  ruralExposure: RuralExposure;
  organisation: TravelOrganisation;
  activities: string[];
}

export interface HealthAnswers {
  age: number | null;
  feelsHealthy: boolean | null;
  hasAcuteFever: boolean | null;

  chronicDiseases: string[];
  chronicOtherText: string;

  immunosuppression: boolean | null;
  anticoagulation: boolean | null;
  medicationsText: string;
  knownImmunodeficiency: boolean | null;
  recentBloodProducts: boolean | null;

  hasAllergy: boolean | null;
  allergyText: string;
  hadSevereVaccineReaction: boolean | null;
  severeReactionText: string;

  pregnancyStatus: PregnancyStatus;
  pregnancyWeek: number | null;

  dengueLabConfirmed: boolean | null;
  previousTropicalInfectionsText: string;
}

export interface VaccinationStatus {
  status: VaccinationStatusState;
  lastDose: string | null; // ISO-Datum oder null
}

export interface VaccinationAnswers {
  [vaccineName: string]: VaccinationStatus;
}

export interface QuestionnaireAnswers {
  travel: TravelAnswers;
  health: HealthAnswers;
  vaccinations: VaccinationAnswers;
}

// STIKO-Risikotags 1–9 (wie im Bulletin)
export type RiskTag = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type RiskProfile = {
  [K in RiskTag]: boolean;
};

// -------------------------------------------------------
// STIKO-JSON-Typen
// -------------------------------------------------------

interface StikoRiskBasedRecommendation {
  vaccine: string;
  riskTags: RiskTag[];
}

interface StikoCountryConfig {
  countryName: string;

  /**
   * Neu: aus dem Python-Parser getrennt
   * - entryRequirementsAlways: Nachweispflicht generell
   * - entryRequirementsConditional: nur „bei Einreise aus ... / Transit über ...“
   *
   * Das alte Feld entryRequirements bleibt als Fallback enthalten.
   */
  entryRequirementsAlways?: string[];
  entryRequirementsConditional?: string[];
  entryRequirements?: string[];

  recommendedForAll: string[];
  recommendedIfRisk: StikoRiskBasedRecommendation[];

  // optional: von der JSON evtl. gesetztes Alias-Feld, aber von uns nicht genutzt
  aliasOf?: string;
}

interface StikoDatabase {
  [countryName: string]: StikoCountryConfig;
}

// -------------------------------------------------------
// JSON-Import – Pfad ggf. anpassen, falls Datei anders liegt
// -------------------------------------------------------

// Wichtig: In tsconfig.json muss "resolveJsonModule": true gesetzt sein.
import stikoRaw from "../src/data/stiko_all_final.json";

const stikoDb = stikoRaw as StikoDatabase;

// -------------------------------------------------------
// Risikoprofil – identisch zum Frontend, aber serverseitig
// -------------------------------------------------------

export function deriveRiskProfileServer(
  answers: QuestionnaireAnswers
): RiskProfile {
  const { travel, health } = answers;
  const rural = travel.ruralExposure;
  const activities = travel.activities;
  const travelCond = travel.travelCondition;
  const organisation = travel.organisation;

  const hasLowHygiene =
    travelCond === 1 ||
    rural === "also_rural" ||
    rural === "mostly_rural" ||
    activities.includes("backpacking") ||
    activities.includes("camping") ||
    activities.includes("trekking") ||
    activities.includes("homestay") ||
    activities.includes("vfr");

  const closeContactPopulation =
    organisation === "individual" ||
    activities.includes("backpacking") ||
    activities.includes("vfr") ||
    activities.includes("homestay") ||
    activities.includes("volunteering") ||
    activities.includes("healthcare_work") ||
    activities.includes("medical_internship") ||
    activities.includes("disaster_relief");

  const healthCareContact =
    activities.includes("healthcare_work") ||
    activities.includes("medical_internship");

  const disasterDeployment = activities.includes("disaster_relief");

  const probableAnimalContact =
    activities.includes("animal_contact") ||
    activities.includes("animal_projects") ||
    activities.includes("camping") ||
    activities.includes("trekking");

  const possibleTickExposure =
    rural === "also_rural" ||
    rural === "mostly_rural" ||
    activities.includes("trekking") ||
    activities.includes("camping");

  const highRiskComorbidity =
    (health.age !== null && health.age >= 60) ||
    health.chronicDiseases.length > 0 ||
    health.immunosuppression === true ||
    health.knownImmunodeficiency === true ||
    health.pregnancyStatus === "pregnant";

  const priorDengue =
    health.dengueLabConfirmed === true &&
    health.age !== null &&
    health.age >= 4;

  const profile: RiskProfile = {
    1: hasLowHygiene,
    2: closeContactPopulation,
    3: healthCareContact,
    4: disasterDeployment,
    5: false, // Tag 5 = ärztliche Einzelfallentscheidung, nicht automatisiert
    6: probableAnimalContact,
    7: possibleTickExposure,
    8: highRiskComorbidity,
    9: priorDengue
  };

  return profile;
}

// -------------------------------------------------------
// Hilfstypen für den Impfplan
// -------------------------------------------------------

export type RecommendationReason =
  | "entryRequirement"
  | "entryRequirementConditional"
  | "coreForAllTravellers"
  | "riskBased";

export interface CountryMatch {
  // Name, den der Patient angegeben hat (z.B. "Indonesien")
  requestedName: string;
  // Exakter Key in der STIKO-DB, falls gefunden (z.B. "Indonesien")
  matchedKey: string | null;
}

export interface VaccinePlanItem {
  vaccine: string;
  countries: string[]; // Länder, für die diese Empfehlung gilt
  reasons: RecommendationReason[]; // z.B. ["entryRequirement","riskBased"]
  riskTags: RiskTag[]; // nur für riskBased relevant
  status: VaccinationStatusState; // Patient*in
  lastDose: string | null; // Patient*in
  needsAction: boolean; // true, wenn Status ≠ "complete"
}

export interface VaccinationPlan {
  createdAt: string; // ISO-Datum/Zeit
  countriesMatched: CountryMatch[];
  items: VaccinePlanItem[];
  grouped: {
    entryRequired: VaccinePlanItem[];
    coreMissingOrUnclear: VaccinePlanItem[];
    riskBasedMissingOrUnclear: VaccinePlanItem[];
  };
  riskProfile: RiskProfile;
}

// -------------------------------------------------------
// Hilfsfunktionen
// -------------------------------------------------------

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Versucht, einen vom Patienten eingegebenen Ländernamen
 * einem STIKO-Ländereintrag zuzuordnen.
 *
 * 1. exakter Match (case-insensitiv)
 * 2. enthält-Match (z.B. "galapagos" in "Ecuador – inkl. Galapagos")
 */
function matchCountryName(requested: string, db: StikoDatabase): string | null {
  if (!requested) return null;
  const wanted = normaliseName(requested);

  const keys = Object.keys(db);

  // exakter Match
  const exact = keys.find((k) => normaliseName(k) === wanted);
  if (exact) return exact;

  // enthält-Match
  const partial = keys.find((k) => normaliseName(k).includes(wanted));
  if (partial) return partial;

  return null;
}

// -------------------------------------------------------
// Kernlogik: Impfplan berechnen
// -------------------------------------------------------

export interface BuildPlanInput {
  questionnaire: QuestionnaireAnswers;
  // optional: wodurch der Client sein Risikoprofil mitschicken kann (nur zu Vergleichszwecken)
  riskProfileFromClient?: RiskProfile;
}

export function buildVaccinationPlan(input: BuildPlanInput): VaccinationPlan {
  const { questionnaire } = input;

  // 1) Risikoprofil serverseitig berechnen
  const riskProfile = deriveRiskProfileServer(questionnaire);
  const activeRiskTags = (Object.keys(riskProfile) as unknown as RiskTag[]).filter(
    (tag) => riskProfile[tag]
  );

  // 2) Länderzuordnung
  const countryMatches: CountryMatch[] = questionnaire.travel.countries.map(
    (c) => ({
      requestedName: c,
      matchedKey: matchCountryName(c, stikoDb)
    })
  );

  const matchedCountries = countryMatches
    .map((cm) => cm.matchedKey)
    .filter((c): c is string => c !== null);

  // Kein Land gefunden → leerer Plan
  if (matchedCountries.length === 0) {
    return {
      createdAt: new Date().toISOString(),
      countriesMatched: countryMatches,
      items: [],
      grouped: {
        entryRequired: [],
        coreMissingOrUnclear: [],
        riskBasedMissingOrUnclear: []
      },
      riskProfile
    };
  }

  // 3) Aggregation der Impfempfehlungen über alle Länder

  // Map für leicht unterschiedliche Schreibweisen der Impfstoffe
  const VACCINE_CANONICAL_MAP: Record<string, string> = {
    "Meningokokken- ACWY": "Meningokokken-ACWY"
  };

  function canonicalizeVaccineName(name: string): string {
    const trimmed = name.trim();
    return VACCINE_CANONICAL_MAP[trimmed] ?? trimmed;
  }

  type VaccineAccumulator = {
    vaccine: string;
    countries: Set<string>;
    reasons: Set<RecommendationReason>;
    riskTags: Set<RiskTag>;
  };

  const acc: Record<string, VaccineAccumulator> = {};

  function ensureAcc(rawVaccineName: string): VaccineAccumulator {
    const vaccine = canonicalizeVaccineName(rawVaccineName);
    if (!acc[vaccine]) {
      acc[vaccine] = {
        vaccine,
        countries: new Set<string>(),
        reasons: new Set<RecommendationReason>(),
        riskTags: new Set<RiskTag>()
      };
    }
    return acc[vaccine];
  }

  for (const countryKey of matchedCountries) {
    const cfg = stikoDb[countryKey];
    if (!cfg) continue;

    // 3a) Einreise-Bestimmungen
    // „Immer“ gültig – z.B. echte Gelbfieber-Nachweispflicht bei direkter Einreise
    const alwaysReq = cfg.entryRequirementsAlways ?? cfg.entryRequirements ?? [];
    for (const v of alwaysReq) {
      const item = ensureAcc(v);
      item.countries.add(countryKey);
      item.reasons.add("entryRequirement");
    }

    // Bedingte Nachweispflichten („bei Einreise aus ...“ / Transit)
    // → wir markieren sie separat, aber behandeln sie NICHT als generelle Entry Requirement
    const conditionalReq = cfg.entryRequirementsConditional ?? [];
    for (const v of conditionalReq) {
      const item = ensureAcc(v);
      item.countries.add(countryKey);
      item.reasons.add("entryRequirementConditional");
    }

    // 3b) Für alle Reisenden empfohlen
    for (const v of cfg.recommendedForAll || []) {
      // Altersentsprechende Standardimpfungen aktuell nicht als einzelne Vakzine geführt
      if (v.toLowerCase().startsWith("altersentsprech")) continue;

      const item = ensureAcc(v);
      item.countries.add(countryKey);
      item.reasons.add("coreForAllTravellers");
    }

    // 3c) Nur bei bestimmten Risikokonstellationen
    for (const rec of cfg.recommendedIfRisk || []) {
      const matchedTags = rec.riskTags.filter((t) => activeRiskTags.includes(t));
      if (matchedTags.length === 0) continue; // bei diesem Patienten keine Indikation

      const item = ensureAcc(rec.vaccine);
      item.countries.add(countryKey);
      item.reasons.add("riskBased");
      matchedTags.forEach((t) => item.riskTags.add(t));
    }
  }

  // 4) Patienten-Impfstatus berücksichtigen und strukturierte Planitems bauen

  const items: VaccinePlanItem[] = Object.values(acc).map((accItem) => {
    const vName = accItem.vaccine;
    const patientStatus = questionnaire.vaccinations[vName];

    const status: VaccinationStatusState = patientStatus
      ? patientStatus.status
      : "unknown";

    const lastDose = patientStatus ? patientStatus.lastDose : null;
    const needsAction = status !== "complete";

    return {
      vaccine: vName,
      countries: Array.from(accItem.countries),
      reasons: Array.from(accItem.reasons),
      riskTags: Array.from(accItem.riskTags),
      status,
      lastDose,
      needsAction
    };
  });

  // 5) nach Kategorien gruppieren – primär für UI / Arztübersicht
  // Bedingte Einreisebestimmungen werden bewusst NICHT in entryRequired aufgenommen,
  // können aber über items[].reasons.includes("entryRequirementConditional")
  // später separat dargestellt werden.

  const entryRequired = items.filter((i) =>
    i.reasons.includes("entryRequirement")
  );

  const coreMissingOrUnclear = items.filter(
    (i) => i.reasons.includes("coreForAllTravellers") && i.needsAction
  );

  const riskBasedMissingOrUnclear = items.filter(
    (i) => i.reasons.includes("riskBased") && i.needsAction
  );

  return {
    createdAt: new Date().toISOString(),
    countriesMatched: countryMatches,
    items,
    grouped: {
      entryRequired,
      coreMissingOrUnclear,
      riskBasedMissingOrUnclear
    },
    riskProfile
  };
}
