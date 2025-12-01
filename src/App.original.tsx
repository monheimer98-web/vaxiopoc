// src/App.tsx
import { useState, ChangeEvent, FormEvent } from "react";
import type { CSSProperties } from "react";

// --------------------------------------------------
// API-Basis-URL
// --------------------------------------------------
// Lokal: fällt zurück auf http://localhost:4000
// Live (z.B. Vercel): wir setzen später VITE_API_BASE_URL in den Env-Variablen.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// -----------------------------
// Typen
// -----------------------------

type TravelCondition = 1 | 2 | 3;
type RuralExposure = "none" | "also_rural" | "mostly_rural" | null;
type TravelOrganisation = "organized" | "individual" | "business" | null;

type PregnancyStatus = "none" | "pregnant" | "lactating" | null;
type VaccinationStatusState = "complete" | "incomplete" | "unknown";

interface TravelAnswers {
  countries: string[];
  regionsDescription: string;
  startDate: string | null;
  endDate: string | null;
  travelCondition: TravelCondition | null;
  ruralExposure: RuralExposure;
  organisation: TravelOrganisation;
  activities: string[];
}

interface HealthAnswers {
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

interface VaccinationStatus {
  status: VaccinationStatusState;
  lastDose: string | null;
}

interface VaccinationAnswers {
  [vaccineName: string]: VaccinationStatus;
}

interface QuestionnaireAnswers {
  travel: TravelAnswers;
  health: HealthAnswers;
  vaccinations: VaccinationAnswers;
}

// STIKO-Risikotags 1–9
export type RiskTag = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type RiskProfile = {
  [K in RiskTag]: boolean;
};

// Impfplan-Struktur vom Server (vereinfacht)
interface VaccinationPlanItem {
  vaccine: string;
  countries: string[];
  reasons: string[];
  riskTags: number[];
  status: VaccinationStatusState;
  lastDose: string | null;
  needsAction: boolean;
}

interface VaccinationPlanCore {
  createdAt: string;
  countriesMatched?: { requestedName: string; matchedKey: string | null }[];
  items: VaccinationPlanItem[];
  grouped?: {
    entryRequired?: VaccinationPlanItem[];
    coreMissingOrUnclear?: VaccinationPlanItem[];
    riskBasedMissingOrUnclear?: VaccinationPlanItem[];
  };
  riskProfile?: Record<string, boolean>;
}

interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

interface VaccinationPlanResponse {
  success?: boolean;
  data?: {
    plan?: VaccinationPlanCore;
  };
  plan?: VaccinationPlanCore; // falls du es direkt als "plan" zurückgibst
  error?: ApiError;
}

// -----------------------------
// Initialwerte
// -----------------------------

const allVaccines = [
  "MMR/MMR-V",
  "Poliomyelitis",
  "TDaP/Tdap",
  "Hepatitis A",
  "Hepatitis B",
  "Influenza",
  "COVID-19",
  "TBE (FSME-Impfung)",
  "Meningokokken-ACWY",
  "Gelbfieber",
  "Typhus",
  "Tollwut",
  "Japanische Enzephalitis",
  "Cholera",
  "Dengue"
];

const initialTravel: TravelAnswers = {
  countries: [],
  regionsDescription: "",
  startDate: null,
  endDate: null,
  travelCondition: null,
  ruralExposure: null,
  organisation: null,
  activities: []
};

const initialHealth: HealthAnswers = {
  age: null,
  feelsHealthy: null,
  hasAcuteFever: null,

  chronicDiseases: [],
  chronicOtherText: "",

  immunosuppression: null,
  anticoagulation: null,
  medicationsText: "",
  knownImmunodeficiency: null,
  recentBloodProducts: null,

  hasAllergy: null,
  allergyText: "",
  hadSevereVaccineReaction: null,
  severeReactionText: "",

  pregnancyStatus: "none",
  pregnancyWeek: null,

  dengueLabConfirmed: null,
  previousTropicalInfectionsText: ""
};

const initialVaccinations: VaccinationAnswers = allVaccines.reduce(
  (acc, v) => {
    acc[v] = { status: "unknown", lastDose: null };
    return acc;
  },
  {} as VaccinationAnswers
);

const initialAnswers: QuestionnaireAnswers = {
  travel: initialTravel,
  health: initialHealth,
  vaccinations: initialVaccinations
};

// -----------------------------
// Styling – High-End, klinisch, viel Luft
// -----------------------------

const appStyle: CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  padding: "40px 16px",
  background:
    "radial-gradient(circle at top, #e0f2fe 0, #f9fafb 45%, #ffffff 100%)",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: "#0f172a",
  display: "flex",
  justifyContent: "center",
  boxSizing: "border-box"
};

const headerBarStyle: CSSProperties = {
  maxWidth: "960px",
  width: "100%",
  margin: "0 auto 18px auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px"
};

const logoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px"
};

const logoCircleStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  background:
    "conic-gradient(from 160deg, #0ea5e9, #2563eb, #1d4ed8, #0ea5e9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#eff6ff",
  fontWeight: 700,
  fontSize: "14px",
  boxShadow: "0 10px 28px rgba(37,99,235,0.45)"
};

const logoTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px"
};

const logoTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#0f172a"
};

const logoSubtitleStyle: CSSProperties = {
  fontSize: "11px",
  color: "#64748b"
};

const headerRightStyle: CSSProperties = {
  fontSize: "11px",
  color: "#64748b",
  textAlign: "right",
  lineHeight: 1.3
};

const shellStyle: CSSProperties = {
  maxWidth: "780px",
  width: "100%",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 60px rgba(15,23,42,0.16)",
  padding: "26px 26px 22px",
  border: "1px solid rgba(148,163,184,0.24)",
  overflow: "hidden",
  boxSizing: "border-box"
};

const headlineStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  marginBottom: "6px",
  letterSpacing: "-0.03em",
  color: "#0f172a"
};

const sublineStyle: CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  marginBottom: "18px"
};

const stepperStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginBottom: "22px"
};

const stepRailStyle: CSSProperties = {
  flex: 1,
  height: "2px",
  background: "linear-gradient(to right, #dbeafe, #e5e7eb)",
  borderRadius: "999px",
  position: "relative"
};

const stepPillBase: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  padding: "4px 9px",
  borderRadius: "999px",
  border: "1px solid transparent",
  backgroundColor: "transparent",
  cursor: "pointer"
};

const stepCircleBase: CSSProperties = {
  width: "20px",
  height: "20px",
  borderRadius: "999px",
  border: "2px solid #bfdbfe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: 600,
  backgroundColor: "#eff6ff",
  color: "#1d4ed8"
};

const stepLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#6b7280"
};

const sectionCardStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(226,232,240,0.9)",
  padding: "16px 16px 14px",
  marginBottom: "16px",
  backgroundColor: "#ffffff"
};

const sectionTitleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "6px"
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#0f172a"
};

const sectionStepHint: CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af"
};

const sectionSubtitleStyle: CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  marginBottom: "10px"
};

const columnStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  marginBottom: "3px",
  display: "block",
  color: "#111827"
};

const helperTextStyle: CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  marginTop: "2px"
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  padding: "8px 11px",
  fontSize: "13px",
  outline: "none",
  backgroundColor: "#f9fafb",
  boxSizing: "border-box"
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "80px",
  resize: "vertical"
};

const selectStyle: CSSProperties = {
  ...inputStyle
};

const pillRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "4px"
};

const pillStyle: CSSProperties = {
  borderRadius: "999px",
  padding: "6px 11px",
  fontSize: "11px",
  border: "1px solid #d1d5db",
  cursor: "pointer",
  backgroundColor: "#f9fafb",
  color: "#374151",
  whiteSpace: "nowrap"
};

const pillStyleActive: CSSProperties = {
  ...pillStyle,
  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
  color: "#ffffff",
  borderColor: "transparent",
  boxShadow: "0 8px 18px rgba(37,99,235,0.4)"
};

const navRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "20px"
};

const navButtonsRight: CSSProperties = {
  display: "flex",
  gap: "8px"
};

const buttonSecondaryStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  padding: "7px 13px",
  fontSize: "12px",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  color: "#111827"
};

const buttonPrimaryStyle: CSSProperties = {
  borderRadius: "999px",
  border: "none",
  padding: "8px 17px",
  fontSize: "13px",
  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
  color: "#ffffff",
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(37,99,235,0.45)"
};

const yesNoRowStyle: CSSProperties = {
  display: "flex",
  gap: "6px",
  marginTop: "4px"
};

const yesNoButtonBase: CSSProperties = {
  flex: 1,
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "11px",
  border: "1px solid #d1d5db",
  backgroundColor: "#f9fafb",
  cursor: "pointer",
  textAlign: "center",
  color: "#111827"
};

const vaccineCardStyle: CSSProperties = {
  borderRadius: "14px",
  border: "1px solid rgba(226,232,240,0.9)",
  padding: "10px 12px",
  backgroundColor: "#f9fafb",
  display: "flex",
  flexDirection: "column",
  gap: "6px"
};

const vaccineTitleStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#111827"
};

const vaccineRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
};

const vaccineColStyle: CSSProperties = {
  flex: "1 1 180px",
  minWidth: 0
};

const badgeMutedStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid #e5e7eb",
  padding: "4px 8px",
  fontSize: "11px",
  color: "#6b7280",
  backgroundColor: "#f9fafb"
};

const debugCardStyle: CSSProperties = {
  marginTop: "12px",
  borderRadius: "12px",
  border: "1px dashed rgba(148,163,184,0.7)",
  padding: "10px 12px",
  backgroundColor: "#f9fafb"
};

const debugSummaryRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "8px"
};

const debugChipStyle: CSSProperties = {
  borderRadius: "999px",
  padding: "4px 8px",
  fontSize: "11px",
  backgroundColor: "#e5e7eb",
  color: "#374151"
};

// DEBUG für dich gerade AN – später ggf. wieder auf false stellen
const SHOW_DEBUG_INTERNAL_CARD = true;

// -----------------------------
// Helper-Komponenten
// -----------------------------

interface YesNoFieldProps {
  label: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
}

function YesNoField({ label, value, onChange }: YesNoFieldProps) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={yesNoRowStyle}>
        <button
          type="button"
          style={{
            ...yesNoButtonBase,
            backgroundColor: value === true ? "#dcfce7" : "#f9fafb",
            borderColor: value === true ? "#22c55e" : "#d1d5db",
            fontWeight: value === true ? 600 : 400
          }}
          onClick={() => onChange(true)}
        >
          ja
        </button>
        <button
          type="button"
          style={{
            ...yesNoButtonBase,
            backgroundColor: value === false ? "#fee2e2" : "#f9fafb",
            borderColor: value === false ? "#ef4444" : "#d1d5db",
            fontWeight: value === false ? 600 : 400
          }}
          onClick={() => onChange(false)}
        >
          nein
        </button>
      </div>
    </div>
  );
}

function toggleFromList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// -----------------------------
// Risikoprofil-Berechnung (intern, für Engine)
// -----------------------------

function deriveRiskProfile(answers: QuestionnaireAnswers): RiskProfile {
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
    5: false, // reserviert
    6: probableAnimalContact,
    7: possibleTickExposure,
    8: highRiskComorbidity,
    9: priorDengue
  };

  return profile;
}

// -----------------------------
// Hauptkomponente
// -----------------------------

type Step = 1 | 2 | 3 | 4;
type SubmitStatus = "idle" | "submitting" | "success" | "error";

function App() {
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(initialAnswers);
  const [countriesInput, setCountriesInput] = useState("");
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [submittedJson, setSubmittedJson] = useState<QuestionnaireAnswers | null>(
    null
  );
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [vaccinationPlan, setVaccinationPlan] = useState<VaccinationPlanCore | null>(
    null
  );

  const handleTravelChange = <K extends keyof TravelAnswers>(
    key: K,
    value: TravelAnswers[K]
  ) => {
    setAnswers((prev) => ({
      ...prev,
      travel: { ...prev.travel, [key]: value }
    }));
  };

  const handleHealthChange = <K extends keyof HealthAnswers>(
    key: K,
    value: HealthAnswers[K]
  ) => {
    setAnswers((prev) => ({
      ...prev,
      health: { ...prev.health, [key]: value }
    }));
  };

  const handleVaccinationChange = (
    vaccine: string,
    patch: Partial<VaccinationStatus>
  ) => {
    setAnswers((prev) => ({
      ...prev,
      vaccinations: {
        ...prev.vaccinations,
        [vaccine]: { ...prev.vaccinations[vaccine], ...patch }
      }
    }));
  };

  const normalizedAnswers = (): QuestionnaireAnswers => {
    const countries = countriesInput
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    return {
      ...answers,
      travel: {
        ...answers.travel,
        countries
      }
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const questionnaire = normalizedAnswers();
    const rp = deriveRiskProfile(questionnaire);

    setRiskProfile(rp);
    setSubmittedJson(questionnaire);
    setSubmitStatus("submitting");
    setServerError(null);
    setVaccinationPlan(null);
    setStep(4); // direkt zur Bestätigungsseite springen

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/vaccination-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            questionnaire,
            riskProfile: rp
          })
        }
      );

      if (!response.ok) {
        console.error("Server hat mit Fehler geantwortet:", response.status);
        setSubmitStatus("error");
        setServerError(
          `Der Impfplan-Server hat mit Status ${response.status} geantwortet.`
        );
        return;
      }

      const json: VaccinationPlanResponse = await response.json();

      if (json.success === false) {
        setSubmitStatus("error");
        setServerError(
          json.error?.message || "Der Impfplan-Server hat einen Fehler gemeldet."
        );
        return;
      }

      const plan: VaccinationPlanCore | null =
        json.data?.plan ?? json.plan ?? null;

      setVaccinationPlan(plan);
      setSubmitStatus("success");
    } catch (error) {
      console.error("Netzwerk- oder Serverfehler:", error);
      setSubmitStatus("error");
      setServerError(
        "Es ist ein Netzwerkfehler aufgetreten. Bitte versuchen Sie es später erneut."
      );
    }
  };

  const resetForm = () => {
    setAnswers(initialAnswers);
    setCountriesInput("");
    setSubmittedJson(null);
    setVaccinationPlan(null);
    setServerError(null);
    setSubmitStatus("idle");
    setRiskProfile(null);
    setStep(1);
  };

  // interne Arzt-Zusammenfassung
  const renderInternalPlanSummary = () => {
    if (!vaccinationPlan) return null;

    const grouped = vaccinationPlan.grouped || {};
    const entryRequired = grouped.entryRequired || [];
    const coreMissing = grouped.coreMissingOrUnclear || [];
    const riskMissing = grouped.riskBasedMissingOrUnclear || [];

    return (
      <div style={debugCardStyle}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#4b5563",
            marginBottom: "4px"
          }}
        >
          Interne Ansicht (nur für ärztliches Fachpersonal)
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#6b7280",
            marginBottom: "8px"
          }}
        >
          Technische Impfplan-Struktur aus der Engine. Diese Ansicht ist nicht für
          Patientinnen und Patienten bestimmt.
        </div>

        <div style={debugSummaryRowStyle}>
          <span style={debugChipStyle}>
            Einreisebestimmungen: {entryRequired.length}
          </span>
          <span style={debugChipStyle}>
            Basisimpfungen unklar/offen: {coreMissing.length}
          </span>
          <span style={debugChipStyle}>
            Risikoimpfungen unklar/offen: {riskMissing.length}
          </span>
          {vaccinationPlan.riskProfile && (
            <span style={debugChipStyle}>
              aktive Risikofaktoren:{" "}
              {Object.values(vaccinationPlan.riskProfile).filter(Boolean).length}
            </span>
          )}
        </div>

        {entryRequired.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{ fontSize: "11px", fontWeight: 600, color: "#111827" }}
            >
              Einreisebestimmungen (Impfungen mit potenzieller Nachweispflicht)
            </div>
            <ul style={{ margin: "4px 0 0 14px", padding: 0, fontSize: "11px" }}>
              {entryRequired.map((it, idx) => (
                <li key={idx}>
                  {it.vaccine} ({it.countries.join(", ")})
                </li>
              ))}
            </ul>
          </div>
        )}

        {coreMissing.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{ fontSize: "11px", fontWeight: 600, color: "#111827" }}
            >
              Basisimpfungen – unklar oder Auffrischung notwendig
            </div>
            <ul style={{ margin: "4px 0 0 14px", padding: 0, fontSize: "11px" }}>
              {coreMissing.map((it, idx) => (
                <li key={idx}>{it.vaccine}</li>
              ))}
            </ul>
          </div>
        )}

        {riskMissing.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div
              style={{ fontSize: "11px", fontWeight: 600, color: "#111827" }}
            >
              Risikoabhängige Impfungen – unklar oder empfohlen
            </div>
            <ul style={{ margin: "4px 0 0 14px", padding: 0, fontSize: "11px" }}>
              {riskMissing.map((it, idx) => (
                <li key={idx}>
                  {it.vaccine}{" "}
                  {it.riskTags && it.riskTags.length > 0
                    ? `(Risikotags: ${it.riskTags.join(", ")})`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <pre
          style={{
            backgroundColor: "#020617",
            color: "#e5e7eb",
            borderRadius: "8px",
            padding: "8px",
            fontSize: "11px",
            maxHeight: "260px",
            overflow: "auto",
            marginTop: "8px"
          }}
        >
          {JSON.stringify(vaccinationPlan, null, 2)}
        </pre>

        {submittedJson && riskProfile && (
          <details style={{ marginTop: "8px" }}>
            <summary style={{ fontSize: "11px", cursor: "pointer" }}>
              Fragebogen & Risikoprofil (intern)
            </summary>
            <pre
              style={{
                backgroundColor: "#020617",
                color: "#e5e7eb",
                borderRadius: "8px",
                padding: "8px",
                fontSize: "11px",
                maxHeight: "200px",
                overflow: "auto",
                marginTop: "6px"
              }}
            >
              {JSON.stringify(
                { questionnaire: submittedJson, riskProfile },
                null,
                2
              )}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div style={appStyle}>
      <div style={{ width: "100%", maxWidth: 960 }}>
        {/* Brand-Zeile oben */}
        <div style={headerBarStyle}>
          <div style={logoStyle}>
            <div style={logoCircleStyle}>V</div>
            <div style={logoTextStyle}>
              <span style={logoTitleStyle}>VAXIO</span>
              <span style={logoSubtitleStyle}>
                Privatärztliche Beratung & Prävention
              </span>
            </div>
          </div>
          <div style={headerRightStyle}>
            <div>Reisemedizinische Sprechstunde</div>
            <div>Ärztlich geprüfte Impfempfehlungen</div>
          </div>
        </div>

        <div style={shellStyle}>
          <header style={{ marginBottom: "12px" }}>
            <h1 style={headlineStyle}>Digitale Reise-Impfberatung</h1>
            <p style={sublineStyle}>
              In wenigen Schritten zu einem ärztlich geprüften Impfplan für Ihre
              Reise – basierend auf STIKO-Empfehlungen und Ihren individuellen
              Risikofaktoren.
            </p>
          </header>

          {/* Stepper */}
          <div style={stepperStyle}>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { id: 1, label: "Reise" },
                { id: 2, label: "Gesundheit" },
                { id: 3, label: "Impfstatus" }
              ].map((s) => {
                const isActive = s.id === step;
                const isCompleted = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (s.id < 4 && submitStatus !== "submitting") {
                        setStep(s.id as Step);
                      }
                    }}
                    style={{
                      ...stepPillBase,
                      borderColor: isActive
                        ? "#93c5fd"
                        : isCompleted
                        ? "#86efac"
                        : "transparent",
                      backgroundColor: isActive ? "#eff6ff" : "transparent"
                    }}
                  >
                    <span
                      style={{
                        ...stepCircleBase,
                        borderColor: isCompleted
                          ? "#22c55e"
                          : isActive
                          ? "#2563eb"
                          : "#bfdbfe",
                        backgroundColor: isCompleted ? "#22c55e" : "#eff6ff",
                        color: isCompleted ? "#f9fafb" : "#1d4ed8"
                      }}
                    >
                      {isCompleted ? "✓" : s.id}
                    </span>
                    <span
                      style={{
                        ...stepLabelStyle,
                        color: isActive ? "#1f2937" : "#6b7280",
                        fontWeight: isActive ? 600 : 500
                      }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={stepRailStyle} />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Schritt 1: Reise */}
            {step === 1 && (
              <>
                <section style={sectionCardStyle}>
                  <div style={sectionTitleRow}>
                    <div style={sectionTitleStyle}>Reiseziel und Zeitraum</div>
                    <div style={sectionStepHint}>Schritt 1 von 3</div>
                  </div>
                  <p style={sectionSubtitleStyle}>
                    Bitte geben Sie die Eckdaten Ihrer Reise an. Diese Informationen
                    sind die Grundlage für alle weiteren Empfehlungen.
                  </p>
                  <div style={columnStack}>
                    <div>
                      <label style={labelStyle}>
                        Zielländer (Komma-getrennt)*
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="z.B. Indonesien, Thailand, Vietnam"
                          value={countriesInput}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setCountriesInput(e.target.value)
                          }
                        />
                      </label>
                      <div style={helperTextStyle}>
                        Bitte geben Sie alle Länder an, die Sie voraussichtlich
                        bereisen werden.
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>
                        Regionen / Inseln (optional)
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="z.B. Java (Jakarta, Yogyakarta), Bali Süd, Lombok Nord"
                          value={answers.travel.regionsDescription}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleTravelChange("regionsDescription", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div>
                      <label style={labelStyle}>
                        Reisebeginn
                        <input
                          type="date"
                          style={inputStyle}
                          value={answers.travel.startDate ?? ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleTravelChange(
                              "startDate",
                              e.target.value ? e.target.value : null
                            )
                          }
                        />
                      </label>
                    </div>
                    <div>
                      <label style={labelStyle}>
                        Reiseende
                        <input
                          type="date"
                          style={inputStyle}
                          value={answers.travel.endDate ?? ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleTravelChange(
                              "endDate",
                              e.target.value ? e.target.value : null
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section style={sectionCardStyle}>
                  <div style={sectionTitleRow}>
                    <div style={sectionTitleStyle}>Reiseart und Bedingungen</div>
                    <div style={sectionStepHint}>Risikokonstellationen</div>
                  </div>
                  <p style={sectionSubtitleStyle}>
                    Anhand der Reisebedingungen und geplanten Aktivitäten erkennen wir
                    wichtige Risikofaktoren (Hygiene, Tierkontakte, enge Kontakte zur
                    Bevölkerung usw.).
                  </p>

                  <div style={columnStack}>
                    <div>
                      <span style={labelStyle}>Reisestandard</span>
                      <div style={pillRowStyle}>
                        <button
                          type="button"
                          style={
                            answers.travel.travelCondition === 1
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() => handleTravelChange("travelCondition", 1)}
                        >
                          Rucksackreise / einfache Unterkünfte
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.travelCondition === 2
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() => handleTravelChange("travelCondition", 2)}
                        >
                          gemischter Standard
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.travelCondition === 3
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() => handleTravelChange("travelCondition", 3)}
                        >
                          vorwiegend gute Hotels
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={labelStyle}>Aufenthalt in ländlichen Regionen</span>
                      <div style={pillRowStyle}>
                        <button
                          type="button"
                          style={
                            answers.travel.ruralExposure === "none"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() => handleTravelChange("ruralExposure", "none")}
                        >
                          überwiegend Städte
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.ruralExposure === "also_rural"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() =>
                            handleTravelChange("ruralExposure", "also_rural")
                          }
                        >
                          auch ländliche Regionen
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.ruralExposure === "mostly_rural"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() =>
                            handleTravelChange("ruralExposure", "mostly_rural")
                          }
                        >
                          vorwiegend ländliche / abgelegene Regionen
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={labelStyle}>Reiseorganisation</span>
                      <div style={pillRowStyle}>
                        <button
                          type="button"
                          style={
                            answers.travel.organisation === "organized"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() =>
                            handleTravelChange("organisation", "organized")
                          }
                        >
                          Pauschal- / Gruppenreise
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.organisation === "individual"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() =>
                            handleTravelChange("organisation", "individual")
                          }
                        >
                          individuelle Reise
                        </button>
                        <button
                          type="button"
                          style={
                            answers.travel.organisation === "business"
                              ? pillStyleActive
                              : pillStyle
                          }
                          onClick={() =>
                            handleTravelChange("organisation", "business")
                          }
                        >
                          Geschäftsreise
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={labelStyle}>Geplante Aktivitäten</span>
                      <div style={pillRowStyle}>
                        {[
                          { id: "backpacking", label: "Backpacking" },
                          { id: "trekking", label: "Trekking / Wandern" },
                          { id: "camping", label: "Camping" },
                          {
                            id: "animal_contact",
                            label: "wahrscheinliche Tierkontakte"
                          },
                          { id: "animal_projects", label: "Arbeit mit Tieren" },
                          {
                            id: "healthcare_work",
                            label: "Tätigkeit im Gesundheitswesen"
                          },
                          {
                            id: "medical_internship",
                            label: "medizinisches Praktikum"
                          },
                          {
                            id: "disaster_relief",
                            label: "Katastrophen-/Hilfseinsatz"
                          },
                          { id: "vfr", label: "Besuch bei Familie/Freunden" },
                          {
                            id: "homestay",
                            label: "Homestay / längerer Aufenthalt"
                          }
                        ].map((act) => {
                          const active = answers.travel.activities.includes(act.id);
                          return (
                            <button
                              key={act.id}
                              type="button"
                              style={active ? pillStyleActive : pillStyle}
                              onClick={() =>
                                handleTravelChange(
                                  "activities",
                                  toggleFromList(answers.travel.activities, act.id)
                                )
                              }
                            >
                              {act.label}
                            </button>
                          );
                        })}
                      </div>
                      <div style={helperTextStyle}>
                        Mehrfachauswahl möglich – wählen Sie alles aus, was für Ihre
                        Reise realistisch ist.
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Schritt 2: Gesundheit */}
            {step === 2 && (
              <>
                <section style={sectionCardStyle}>
                  <div style={sectionTitleRow}>
                    <div style={sectionTitleStyle}>Allgemeine Gesundheit</div>
                    <div style={sectionStepHint}>Schritt 2 von 3</div>
                  </div>
                  <p style={sectionSubtitleStyle}>
                    Diese Angaben helfen uns, Ihr Risiko für schwere
                    Krankheitsverläufe zu bewerten und Impfempfehlungen daran
                    anzupassen.
                  </p>

                  <div style={columnStack}>
                    <div>
                      <label style={labelStyle}>
                        Alter (in Jahren)
                        <input
                          type="number"
                          min={0}
                          max={120}
                          style={inputStyle}
                          value={answers.health.age ?? ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleHealthChange(
                              "age",
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                        />
                      </label>
                    </div>
                    <YesNoField
                      label="Fühlen Sie sich aktuell allgemein gesund?"
                      value={answers.health.feelsHealthy}
                      onChange={(val) => handleHealthChange("feelsHealthy", val)}
                    />
                    <YesNoField
                      label="Besteht aktuell Fieber oder ein akuter Infekt?"
                      value={answers.health.hasAcuteFever}
                      onChange={(val) => handleHealthChange("hasAcuteFever", val)}
                    />
                  </div>
                </section>

                <section style={sectionCardStyle}>
                  <div style={sectionTitleRow}>
                    <div style={sectionTitleStyle}>
                      Chronische Erkrankungen & Medikamente
                    </div>
                    <div style={sectionStepHint}>Risikofaktoren</div>
                  </div>

                  <div style={columnStack}>
                    <div>
                      <span style={labelStyle}>Chronische Erkrankungen</span>
                      <div style={pillRowStyle}>
                        {[
                          { id: "heart", label: "Herz-/Gefäßerkrankungen" },
                          { id: "lung", label: "Chronische Lungenerkrankungen" },
                          { id: "kidney", label: "Chronische Nierenerkrankung" },
                          { id: "liver", label: "Lebererkrankung" },
                          { id: "diabetes", label: "Diabetes mellitus" },
                          { id: "neuro", label: "Neurologische Erkrankung" },
                          { id: "other", label: "sonstige relevante Erkrankung" }
                        ].map((cd) => {
                          const active = answers.health.chronicDiseases.includes(cd.id);
                          return (
                            <button
                              key={cd.id}
                              type="button"
                              style={active ? pillStyleActive : pillStyle}
                              onClick={() =>
                                handleHealthChange(
                                  "chronicDiseases",
                                  toggleFromList(answers.health.chronicDiseases, cd.id)
                                )
                              }
                            >
                              {cd.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Andere chronische Erkrankungen (optional)
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="z.B. Autoimmunerkrankungen, Krebserkrankungen …"
                          value={answers.health.chronicOtherText}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleHealthChange("chronicOtherText", e.target.value)
                          }
                        />
                      </label>
                    </div>

                    <YesNoField
                      label="Besteht eine Immunsuppression (z.B. durch Medikamente, Chemotherapie)?"
                      value={answers.health.immunosuppression}
                      onChange={(val) =>
                        handleHealthChange("immunosuppression", val)
                      }
                    />

                    <YesNoField
                      label="Nehmen Sie eine dauerhafte Gerinnungshemmung (z.B. Marcumar, DOAK)?"
                      value={answers.health.anticoagulation}
                      onChange={(val) =>
                        handleHealthChange("anticoagulation", val)
                      }
                    />

                    <div>
                      <label style={labelStyle}>
                        Regelmäßig eingenommene Medikamente (optional)
                        <textarea
                          style={textareaStyle}
                          placeholder="z.B. Blutdruckmedikamente, Cortison, Biologika …"
                          value={answers.health.medicationsText}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            handleHealthChange("medicationsText", e.target.value)
                          }
                        />
                      </label>
                    </div>

                    <YesNoField
                      label="Ist eine bekannte Immundefizienz (z.B. angeboren, HIV) bekannt?"
                      value={answers.health.knownImmunodeficiency}
                      onChange={(val) =>
                        handleHealthChange("knownImmunodeficiency", val)
                      }
                    />

                    <YesNoField
                      label="Wurden in den letzten 6 Monaten Blutprodukte oder Immunglobuline verabreicht?"
                      value={answers.health.recentBloodProducts}
                      onChange={(val) =>
                        handleHealthChange("recentBloodProducts", val)
                      }
                    />
                  </div>
                </section>

                <section style={sectionCardStyle}>
                  <div style={sectionTitleRow}>
                    <div style={sectionTitleStyle}>
                      Allergien, Impfreaktionen & Schwangerschaft
                    </div>
                    <div style={sectionStepHint}>Impfverträglichkeit</div>
                  </div>

                  <div style={columnStack}>
                    <div>
                      <YesNoField
                        label="Bestehen relevante Allergien?"
                        value={answers.health.hasAllergy}
                        onChange={(val) => handleHealthChange("hasAllergy", val)}
                      />
                      <label style={{ ...labelStyle, marginTop: "6px" }}>
                        Wenn ja, welche? (optional)
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="z.B. Penicillin, Hühnereiweiß …"
                          value={answers.health.allergyText}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleHealthChange("allergyText", e.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <YesNoField
                        label="Gab es in der Vergangenheit eine schwere Impfreaktion?"
                        value={answers.health.hadSevereVaccineReaction}
                        onChange={(val) =>
                          handleHealthChange("hadSevereVaccineReaction", val)
                        }
                      />
                      <label style={{ ...labelStyle, marginTop: "6px" }}>
                        Falls ja, welche Reaktion? (optional)
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="z.B. anaphylaktische Reaktion, stationäre Behandlung …"
                          value={answers.health.severeReactionText}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleHealthChange("severeReactionText", e.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Schwangerschaft / Stillzeit
                        <select
                          style={selectStyle}
                          value={answers.health.pregnancyStatus ?? "none"}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            handleHealthChange(
                              "pregnancyStatus",
                              e.target.value as PregnancyStatus
                            )
                          }
                        >
                          <option value="none">
                            nicht schwanger / keine Stillzeit
                          </option>
                          <option value="pregnant">schwanger</option>
                          <option value="lactating">stillend</option>
                        </select>
                      </label>
                    </div>

                    {answers.health.pregnancyStatus === "pregnant" && (
                      <div>
                        <label style={labelStyle}>
                          Schwangerschaftswoche (optional)
                          <input
                            type="number"
                            min={1}
                            max={42}
                            style={inputStyle}
                            value={answers.health.pregnancyWeek ?? ""}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleHealthChange(
                                "pregnancyWeek",
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                              )
                            }
                          />
                        </label>
                      </div>
                    )}

                    <YesNoField
                      label="Wurde bereits eine Dengue-Infektion labordiagnostisch gesichert?"
                      value={answers.health.dengueLabConfirmed}
                      onChange={(val) =>
                        handleHealthChange("dengueLabConfirmed", val)
                      }
                    />

                    <div>
                      <label style={labelStyle}>
                        Bisherige Tropen-/Reiseinfektionen (optional)
                        <textarea
                          style={textareaStyle}
                          placeholder="z.B. Malaria, Typhus, Dengue, andere Tropeninfektionen …"
                          value={answers.health.previousTropicalInfectionsText}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            handleHealthChange(
                              "previousTropicalInfectionsText",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Schritt 3: Impfstatus */}
            {step === 3 && (
              <section style={sectionCardStyle}>
                <div style={sectionTitleRow}>
                  <div style={sectionTitleStyle}>Impfstatus (Selbsteinschätzung)</div>
                  <div style={sectionStepHint}>Schritt 3 von 3</div>
                </div>
                <p style={sectionSubtitleStyle}>
                  Wenn Ihr Impfpass vorliegt, können diese Angaben später vom Arzt
                  überprüft und ggf. angepasst werden. Für die erste Empfehlung genügt
                  Ihre Selbsteinschätzung.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "8px"
                  }}
                >
                  {allVaccines.map((vaccine) => {
                    const v = answers.vaccinations[vaccine];
                    return (
                      <div key={vaccine} style={vaccineCardStyle}>
                        <div style={vaccineTitleStyle}>{vaccine}</div>
                        <div style={vaccineRowStyle}>
                          <div style={vaccineColStyle}>
                            <label style={labelStyle}>
                              Impfstatus
                              <select
                                style={selectStyle}
                                value={v.status}
                                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                  handleVaccinationChange(vaccine, {
                                    status: e.target.value as VaccinationStatusState
                                  })
                                }
                              >
                                <option value="unknown">
                                  Impfstatus unklar / kein Impfpass dabei
                                </option>
                                <option value="complete">
                                  Grundimmunisierung vollständig
                                </option>
                                <option value="incomplete">
                                  unvollständig / Auffrischung nötig
                                </option>
                              </select>
                            </label>
                          </div>
                          <div style={vaccineColStyle}>
                            <label style={labelStyle}>
                              letzte Impfung (falls bekannt)
                              <input
                                type="date"
                                style={inputStyle}
                                value={v.lastDose ?? ""}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  handleVaccinationChange(vaccine, {
                                    lastDose: e.target.value || null
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: "10px" }}>
                  <span style={badgeMutedStyle}>
                    Hinweis: Unklare Angaben sind erlaubt – Sie erhalten trotzdem eine
                    fundierte Empfehlung.
                  </span>
                </div>
              </section>
            )}

            {/* Schritt 4: Bestätigung */}
            {step === 4 && (
              <section style={sectionCardStyle}>
                <div style={sectionTitleRow}>
                  <div style={sectionTitleStyle}>
                    Vielen Dank – Ihre Angaben wurden übermittelt
                  </div>
                </div>

                {submitStatus === "submitting" && (
                  <p style={sectionSubtitleStyle}>
                    Ihre Angaben werden aktuell verschlüsselt an unseren
                    Impfplan-Server übertragen und ausgewertet …
                  </p>
                )}

                {submitStatus === "success" && (
                  <>
                    <p style={sectionSubtitleStyle}>
                      Wir haben Ihren Fragebogen sicher erhalten. Ihr individueller
                      Impfplan wurde anhand Ihrer Angaben und der aktuellen
                      STIKO-Empfehlungen berechnet und wird nun von einem ärztlichen
                      Team geprüft.
                    </p>
                    <p style={sectionSubtitleStyle}>
                      Im nächsten Schritt erhalten Sie von uns eine Rückmeldung mit
                      konkreten Impfempfehlungen, Hinweisen zu Auffrischimpfungen und –
                      falls sinnvoll – Vorschlägen zur Malariaprophylaxe.
                    </p>

                    {vaccinationPlan &&
                      SHOW_DEBUG_INTERNAL_CARD &&
                      renderInternalPlanSummary()}
                  </>
                )}

                {submitStatus === "error" && (
                  <>
                    <p style={sectionSubtitleStyle}>
                      Leider ist bei der Übermittlung ein technisches Problem
                      aufgetreten.
                    </p>
                    <p style={{ ...sectionSubtitleStyle, color: "#b91c1c" }}>
                      {serverError ??
                        "Unbekannter Fehler bei der Kommunikation mit dem Impfplan-Server."}
                    </p>
                  </>
                )}

                {submitStatus === "idle" && (
                  <p style={sectionSubtitleStyle}>
                    Bitte füllen Sie zunächst den Fragebogen aus und senden Sie ihn
                    ab.
                  </p>
                )}
              </section>
            )}

            {/* Navigation */}
            {step < 4 && (
              <div style={navRowStyle}>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Schritt {step} von 3
                </div>
                <div style={navButtonsRight}>
                  {step > 1 && (
                    <button
                      type="button"
                      style={buttonSecondaryStyle}
                      onClick={() =>
                        setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
                      }
                      disabled={submitStatus === "submitting"}
                    >
                      Zurück
                    </button>
                  )}
                  {step < 3 && (
                    <button
                      type="button"
                      style={buttonPrimaryStyle}
                      onClick={() =>
                        setStep((s) => (s < 3 ? ((s + 1) as Step) : s))
                      }
                      disabled={submitStatus === "submitting"}
                    >
                      Weiter
                    </button>
                  )}
                  {step === 3 && (
                    <button
                      type="submit"
                      style={buttonPrimaryStyle}
                      disabled={submitStatus === "submitting"}
                    >
                      {submitStatus === "submitting"
                        ? "Übermittle Fragebogen …"
                        : "Fragebogen absenden"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div style={navRowStyle}>
                <div />
                <button
                  type="button"
                  style={buttonSecondaryStyle}
                  onClick={resetForm}
                  disabled={submitStatus === "submitting"}
                >
                  Neue Reise erfassen
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
