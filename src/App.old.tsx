// src/App.tsx
import { useState, ChangeEvent, FormEvent } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------
// TypeScript-Typen: Struktur des Antwort-JSON
// ---------------------------------------

type TravelCondition = 1 | 2 | 3;
type RuralExposure = "none" | "also_rural" | "mostly_rural" | null;
type TravelOrganisation = "organized" | "individual" | "business" | null;

type PregnancyStatus = "none" | "pregnant" | "lactating" | null;
type VaccinationStatusState = "complete" | "incomplete" | "unknown";

interface TravelAnswers {
  countries: string[];          // ["Indonesien", "Bali"]
  regionsDescription: string;   // Freitext zu Regionen/Inseln
  startDate: string | null;     // ISO-String "2025-07-10"
  endDate: string | null;
  travelCondition: TravelCondition | null;
  ruralExposure: RuralExposure;
  organisation: TravelOrganisation;
  activities: string[];         // ["trekking", "animal_contact", ...]
}

interface HealthAnswers {
  age: number | null;
  feelsHealthy: boolean | null;
  hasAcuteFever: boolean | null;

  chronicDiseases: string[];    // z.B. ["heart", "lung"]
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
  lastDose: string | null;      // ISO-Datum oder null
}

interface VaccinationAnswers {
  [vaccineName: string]: VaccinationStatus;
}

interface QuestionnaireAnswers {
  travel: TravelAnswers;
  health: HealthAnswers;
  vaccinations: VaccinationAnswers;
}

// ---------------------------------------
// Initialwerte
// ---------------------------------------

const initialTravel: TravelAnswers = {
  countries: [],
  regionsDescription: "",
  startDate: null,
  endDate: null,
  travelCondition: null,
  ruralExposure: null,
  organisation: null,
  activities: [],
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

  pregnancyStatus: null,
  pregnancyWeek: null,

  dengueLabConfirmed: null,
  previousTropicalInfectionsText: "",
};

// Impfstoffe, die wir strukturiert abfragen (Namen passen zu STIKO-JSON)
const initialVaccinations: VaccinationAnswers = {
  "MMR/MMR-V": { status: "unknown", lastDose: null },
  "Poliomyelitis": { status: "unknown", lastDose: null },
  "TDaP/Tdap": { status: "unknown", lastDose: null },
  "Hepatitis A": { status: "unknown", lastDose: null },
  "Hepatitis B": { status: "unknown", lastDose: null },
  "Influenza": { status: "unknown", lastDose: null },
  "COVID-19": { status: "unknown", lastDose: null },
  "TBE (FSME-Impfung)": { status: "unknown", lastDose: null },
  "Meningokokken-ACWY": { status: "unknown", lastDose: null },
  "Gelbfieber": { status: "unknown", lastDose: null },
  "Typhus": { status: "unknown", lastDose: null },
  "Tollwut": { status: "unknown", lastDose: null },
  "Japanische Enzephalitis": { status: "unknown", lastDose: null },
  "Cholera": { status: "unknown", lastDose: null },
  "Dengue": { status: "unknown", lastDose: null },
};

const initialAnswers: QuestionnaireAnswers = {
  travel: initialTravel,
  health: initialHealth,
  vaccinations: initialVaccinations,
};

// ---------------------------------------
// UI-Helfer
// ---------------------------------------

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

// ---------------------------------------
// Hauptkomponente
// ---------------------------------------

function App() {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(initialAnswers);

  const updateTravel = (patch: Partial<TravelAnswers>) => {
    setAnswers((prev) => ({ ...prev, travel: { ...prev.travel, ...patch } }));
  };

  const updateHealth = (patch: Partial<HealthAnswers>) => {
    setAnswers((prev) => ({ ...prev, health: { ...prev.health, ...patch } }));
  };

  const updateVaccination = (
    vaccine: string,
    patch: Partial<VaccinationStatus>
  ) => {
    setAnswers((prev) => ({
      ...prev,
      vaccinations: {
        ...prev.vaccinations,
        [vaccine]: { ...prev.vaccinations[vaccine], ...patch },
      },
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("Questionnaire JSON payload:", answers);
    alert("Fragebogen ausgefüllt – JSON siehe Konsole (F12) und unten im Debug-Bereich.");
  };

  return (
    <div style={appRootStyle}>
      <div style={appShellStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div>
            <div style={logoRowStyle}>
              <div style={logoCircleStyle}>V</div>
              <span style={logoTextStyle}>Vaxio</span>
            </div>
            <h1 style={titleStyle}>Reiseimpfungs-Fragebogen</h1>
            <p style={subtitleStyle}>
              Beantworten Sie einige Fragen zu Ihrer Reise, Ihrer Gesundheit und Ihrem Impfstatus.
              Aus den Antworten kann ein individueller Impfplan auf Basis der STIKO-Empfehlungen erstellt werden.
            </p>
          </div>
          <div style={badgeStyle}>
            <span style={badgePillStyle}>Proof of Concept</span>
            <span style={badgeTextStyle}>Interne Testversion – nicht für Patienten sichtbar</span>
          </div>
        </header>

        {/* Stepper (nur visuell, kein Wizard) */}
        <div style={stepperStyle}>
          {[
            { id: "0", label: "Basisdaten" },
            { id: "A", label: "Reise" },
            { id: "B", label: "Gesundheit" },
            { id: "C", label: "Impfstatus" },
          ].map((step) => (
            <div key={step.id} style={stepPillStyle}>
              <span style={stepIdStyle}>{step.id}</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* BLOCK 0 – Basisdaten */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Block 0 – Basisdaten</h2>
            <p style={sectionHintStyle}>
              Das Alter ist wichtig für bestimmte STIKO-Empfehlungen und Kontraindikationen.
            </p>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                Alter
                <input
                  type="number"
                  min={0}
                  max={120}
                  style={inputStyle}
                  placeholder="z.B. 32"
                  value={answers.health.age ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateHealth({
                      age: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
            </div>
          </section>

          {/* BLOCK A – Reise */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Block A – Ihre Reise</h2>
            <p style={sectionHintStyle}>
              Reiseziel, Dauer und Reiseart bestimmen, welche Impfungen und Risiken relevant sind.
            </p>

            {/* A1 – Reiseziel(e) */}
            <h3 style={subTitleStyle}>A1 – Reiseziel(e)</h3>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                In welche Länder reisen Sie? (kommagetrennt)
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="z.B. Indonesien, Thailand, Ägypten"
                  value={answers.travel.countries.join(", ")}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateTravel({
                      countries: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <small style={helpTextStyle}>
                Tipp: Wenn Sie mehrere Länder besuchen, geben Sie alle an (z.B. „Indonesien, Bali, Thailand“).
              </small>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                Bestimmte Regionen / Inseln / Städte (optional)
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="z.B. Bali, Lombok, Sumatra, Java"
                  value={answers.travel.regionsDescription}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateTravel({ regionsDescription: e.target.value })
                  }
                />
              </label>
            </div>

            <div style={inlineRowStyle}>
              <label style={labelStyle}>
                Abreisedatum
                <input
                  type="date"
                  style={inputStyle}
                  value={answers.travel.startDate ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateTravel({ startDate: e.target.value || null })
                  }
                />
              </label>
              <label style={labelStyle}>
                Rückreisedatum
                <input
                  type="date"
                  style={inputStyle}
                  value={answers.travel.endDate ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateTravel({ endDate: e.target.value || null })
                  }
                />
              </label>
            </div>

            {/* A2 – Reiseart */}
            <h3 style={subTitleStyle}>A2 – Reiseart / Reisebedingungen</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Wie würden Sie Ihre Reise insgesamt am besten beschreiben?
              </p>
              <div style={optionGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="travelCondition"
                    value="1"
                    checked={answers.travel.travelCondition === 1}
                    onChange={() => updateTravel({ travelCondition: 1 })}
                  />
                  <span>Rucksackreise / einfache Unterkünfte (Backpacking, Hostels, Camping)</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="travelCondition"
                    value="2"
                    checked={answers.travel.travelCondition === 2}
                    onChange={() => updateTravel({ travelCondition: 2 })}
                  />
                  <span>Gemischte Reise (Städte & touristische Zentren mit Ausflügen ins Landesinnere)</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="travelCondition"
                    value="3"
                    checked={answers.travel.travelCondition === 3}
                    onChange={() => updateTravel({ travelCondition: 3 })}
                  />
                  <span>Komfortreise (vorwiegend Großstädte / Touristenzentren, Hotels gehobener Standards)</span>
                </label>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Werden Sie auch in ländlichen Gebieten/Dörfern unterwegs sein?
              </p>
              <div style={optionGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="ruralExposure"
                    value="none"
                    checked={answers.travel.ruralExposure === "none"}
                    onChange={() => updateTravel({ ruralExposure: "none" })}
                  />
                  <span>nur Städte / Touristenzentren</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="ruralExposure"
                    value="also_rural"
                    checked={answers.travel.ruralExposure === "also_rural"}
                    onChange={() => updateTravel({ ruralExposure: "also_rural" })}
                  />
                  <span>auch ländliche Gebiete</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="ruralExposure"
                    value="mostly_rural"
                    checked={answers.travel.ruralExposure === "mostly_rural"}
                    onChange={() => updateTravel({ ruralExposure: "mostly_rural" })}
                  />
                  <span>überwiegend ländliche Gebiete</span>
                </label>
              </div>
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>Wie reisen Sie hauptsächlich?</p>
              <div style={optionGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="organisation"
                    value="organized"
                    checked={answers.travel.organisation === "organized"}
                    onChange={() => updateTravel({ organisation: "organized" })}
                  />
                  <span>organisierte Reise (Pauschalreise, Rundreise)</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="organisation"
                    value="individual"
                    checked={answers.travel.organisation === "individual"}
                    onChange={() => updateTravel({ organisation: "individual" })}
                  />
                  <span>individuell (selbst gebucht, Backpacking)</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="organisation"
                    value="business"
                    checked={answers.travel.organisation === "business"}
                    onChange={() => updateTravel({ organisation: "business" })}
                  />
                  <span>beruflich / Einsatzreise</span>
                </label>
              </div>
            </div>

            {/* A3 – Aktivitäten */}
            <h3 style={subTitleStyle}>A3 – Geplante Aktivitäten</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Welche Aktivitäten sind geplant? (Mehrfachauswahl möglich)
              </p>

              <div style={activitiesGridStyle}>
                {renderActivityCheckbox(
                  "trekking",
                  "längere Wanderungen / Trekking in Wald, Wiesen oder Bergen",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "camping",
                  "Campen / Zelten",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "animal_contact",
                  "Aufenthalt in Gebieten mit vielen Straßenhunden/-katzen oder Affen",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "animal_projects",
                  "Besuch von Tierprojekten / Tierheimen / Farmen / Fledermaushöhlen",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "healthcare_work",
                  "Arbeit im Gesundheitswesen (Krankenhaus, Praxis, Pflege, Labor)",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "disaster_relief",
                  "humanitäre Einsätze / Katastrophenhilfe / Einsatz in Krisengebiet",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "long_tropical_stay",
                  "längerer Aufenthalt (> 4 Wochen) in warm-feuchtem Klima mit viel Aufenthalt im Freien",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "tattoos_piercing",
                  "geplanter Besuch von Tätowierstudios / Piercings / medizinischen Eingriffen vor Ort",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}

                {renderActivityCheckbox(
                  "high_altitude",
                  "Bergtouren über 2500 m",
                  answers.travel.activities,
                  (value) =>
                    updateTravel({
                      activities: toggleInList(answers.travel.activities, value),
                    })
                )}
              </div>
            </div>
          </section>

          {/* BLOCK B – Gesundheit */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Block B – Ihre Gesundheit</h2>
            <p style={sectionHintStyle}>
              Diese Angaben helfen, Kontraindikationen und besondere Risiken zu erkennen
              (z.B. Immunschwäche, Allergien, Schwangerschaft).
            </p>

            {/* B1 – Allgemeinzustand */}
            <h3 style={subTitleStyle}>B1 – Allgemeiner Gesundheitszustand</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>Fühlen Sie sich aktuell gesund?</p>
              {renderYesNoGroup(
                "feelsHealthy",
                answers.health.feelsHealthy,
                (value) => updateHealth({ feelsHealthy: value })
              )}
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Haben Sie derzeit eine akute Erkrankung mit Fieber?
              </p>
              {renderYesNoGroup(
                "hasAcuteFever",
                answers.health.hasAcuteFever,
                (value) => updateHealth({ hasAcuteFever: value })
              )}
            </div>

            {/* B2 – Chronische Erkrankungen */}
            <h3 style={subTitleStyle}>B2 – Chronische Erkrankungen</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Haben Sie eine oder mehrere der folgenden chronischen Erkrankungen?
              </p>

              <div style={twoColumnGridStyle}>
                {renderChronicCheckbox(
                  "heart",
                  "Herz-Kreislauf-Erkrankung",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "lung",
                  "Lungenerkrankung (z.B. Asthma, COPD)",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "diabetes",
                  "Diabetes mellitus",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "liver",
                  "chronische Lebererkrankung",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "kidney",
                  "chronische Nierenerkrankung",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "neuro",
                  "neurologische Erkrankung (z.B. Epilepsie, Parkinson)",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
                {renderChronicCheckbox(
                  "psych",
                  "psychische Erkrankung (z.B. Depression, Angststörung)",
                  answers.health.chronicDiseases,
                  (value) =>
                    updateHealth({
                      chronicDiseases: toggleInList(
                        answers.health.chronicDiseases,
                        value
                      ),
                    })
                )}
              </div>

              <label style={labelStyle}>
                Andere chronische Erkrankungen (optional)
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="z.B. Autoimmunerkrankungen, Krebserkrankungen …"
                  value={answers.health.chronicOtherText}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateHealth({ chronicOtherText: e.target.value })
                  }
                />
              </label>
            </div>

            {/* B3 – Medikamente & Immunsystem */}
            <h3 style={subTitleStyle}>B3 – Medikamente & Immunsystem</h3>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                Nehmen Sie regelmäßig Medikamente ein? (Namen, falls bekannt)
                <textarea
                  style={textareaStyle}
                  placeholder="z.B. Blutdruckmedikamente, Schilddrüsenmedikamente, Antidepressiva …"
                  value={answers.health.medicationsText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateHealth({ medicationsText: e.target.value })
                  }
                />
              </label>
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Gehören Ihre Medikamente zu einer der folgenden Gruppen?
              </p>

              {renderYesNoGroup(
                "anticoagulation",
                answers.health.anticoagulation,
                (value) => updateHealth({ anticoagulation: value }),
                "Blutverdünner (z.B. Marcumar, DOAKs, ASS > 100 mg)"
              )}

              {renderYesNoGroup(
                "immunosuppression",
                answers.health.immunosuppression,
                (value) => updateHealth({ immunosuppression: value }),
                "Medikamente, die Ihr Immunsystem deutlich schwächen (z.B. Cortison in hoher Dosis, Biologika, Chemotherapie, Bestrahlung in den letzten 12 Monaten)"
              )}
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Liegt bei Ihnen eine bekannte Schwäche des Immunsystems vor
                (z.B. HIV, angeborene Immundefekte)?
              </p>
              {renderYesNoGroup(
                "knownImmunodeficiency",
                answers.health.knownImmunodeficiency,
                (value) => updateHealth({ knownImmunodeficiency: value })
              )}
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Haben Sie in den letzten 3 Monaten Blut, Blutprodukte oder Immunglobuline erhalten?
              </p>
              {renderYesNoGroup(
                "recentBloodProducts",
                answers.health.recentBloodProducts,
                (value) => updateHealth({ recentBloodProducts: value })
              )}
            </div>

            {/* B4 – Allergien */}
            <h3 style={subTitleStyle}>B4 – Allergien & Impfreaktionen</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Haben Sie Allergien gegen Medikamente oder Impfstoffe?
              </p>
              {renderYesNoGroup(
                "hasAllergy",
                answers.health.hasAllergy,
                (value) => updateHealth({ hasAllergy: value })
              )}

              <label style={labelStyle}>
                Falls ja, welche?
                <textarea
                  style={textareaStyle}
                  placeholder="z.B. Penicillin, bestimmte Impfstoffe, andere Medikamente …"
                  value={answers.health.allergyText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateHealth({ allergyText: e.target.value })
                  }
                />
              </label>
            </div>

            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Hatten Sie schon einmal eine schwere Reaktion nach einer Impfung
                (z.B. Atemnot, Kreislaufkollaps, Krampfanfälle)?
              </p>
              {renderYesNoGroup(
                "hadSevereVaccineReaction",
                answers.health.hadSevereVaccineReaction,
                (value) => updateHealth({ hadSevereVaccineReaction: value })
              )}

              <label style={labelStyle}>
                Falls ja, bei welcher Impfung und wann?
                <textarea
                  style={textareaStyle}
                  placeholder="z.B. starke Reaktion nach Tetanus-Impfung 2015"
                  value={answers.health.severeReactionText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateHealth({ severeReactionText: e.target.value })
                  }
                />
              </label>
            </div>

            {/* B5 – Schwangerschaft / Stillzeit */}
            <h3 style={subTitleStyle}>B5 – Schwangerschaft / Stillzeit</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Sind Sie schwanger oder stillen Sie aktuell?
              </p>
              <div style={optionGroupStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="pregnancyStatus"
                    value="none"
                    checked={answers.health.pregnancyStatus === "none"}
                    onChange={() => updateHealth({ pregnancyStatus: "none" })}
                  />
                  <span>nicht schwanger und stille nicht</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="pregnancyStatus"
                    value="pregnant"
                    checked={answers.health.pregnancyStatus === "pregnant"}
                    onChange={() => updateHealth({ pregnancyStatus: "pregnant" })}
                  />
                  <span>schwanger</span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="pregnancyStatus"
                    value="lactating"
                    checked={answers.health.pregnancyStatus === "lactating"}
                    onChange={() => updateHealth({ pregnancyStatus: "lactating" })}
                  />
                  <span>ich stille</span>
                </label>
              </div>

              {answers.health.pregnancyStatus === "pregnant" && (
                <label style={labelStyle}>
                  Schwangerschaftswoche (SSW)
                  <input
                    type="number"
                    min={1}
                    max={42}
                    style={inputStyle}
                    placeholder="z.B. 18"
                    value={answers.health.pregnancyWeek ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateHealth({
                        pregnancyWeek: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </label>
              )}
            </div>

            {/* B6 – Bisherige Infektionen */}
            <h3 style={subTitleStyle}>B6 – Bisherige Infektionen</h3>
            <div style={fieldGroupStyle}>
              <p style={fieldLabelTextStyle}>
                Wurde bei Ihnen schon einmal eine Dengue-Infektion
                durch eine Blutuntersuchung oder einen Labortest bestätigt?
              </p>
              {renderYesNoGroup(
                "dengueLabConfirmed",
                answers.health.dengueLabConfirmed,
                (value) => updateHealth({ dengueLabConfirmed: value })
              )}
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                Gab es früher andere Tropeninfektionen
                (z.B. Malaria, Gelbfieber, Typhus)?
                <textarea
                  style={textareaStyle}
                  placeholder="z.B. Malaria 2018 in Tansania"
                  value={answers.health.previousTropicalInfectionsText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateHealth({ previousTropicalInfectionsText: e.target.value })
                  }
                />
              </label>
            </div>
          </section>

          {/* BLOCK C – Impfstatus */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Block C – Ihr Impfstatus</h2>
            <p style={sectionHintStyle}>
              Für jede Impfung können Sie angeben, ob die Grundimmunisierung abgeschlossen ist
              und wann die letzte Impfung erfolgte (falls bekannt).
            </p>

            {Object.entries(answers.vaccinations).map(([vaccine, data]) => (
              <div key={vaccine} style={vaccineCardStyle}>
                <div style={vaccineHeaderStyle}>
                  <span style={vaccineNameStyle}>{vaccine}</span>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>
                    Status
                    <select
                      style={selectStyle}
                      value={data.status}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                        updateVaccination(vaccine, {
                          status: e.target.value as VaccinationStatusState,
                        })
                      }
                    >
                      <option value="complete">
                        Grundimmunisierung abgeschlossen
                      </option>
                      <option value="incomplete">nicht abgeschlossen</option>
                      <option value="unknown">weiß ich nicht</option>
                    </select>
                  </label>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>
                    Letzte Impfung (falls bekannt)
                    <input
                      type="date"
                      style={inputStyle}
                      value={data.lastDose ?? ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateVaccination(vaccine, {
                          lastDose: e.target.value || null,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </section>

          <div style={{ textAlign: "right", marginTop: "0.75rem" }}>
            <button type="submit" style={submitButtonStyle}>
              Fragebogen auswerten
            </button>
          </div>
        </form>

        <div style={debugCardStyle}>
          <h2 style={sectionTitleStyle}>Debug: aktueller JSON-Output</h2>
          <p style={sectionHintStyle}>
            Dies ist genau die Struktur, die später mit der STIKO-JSON kombiniert
            werden kann, um automatisch Impfempfehlungen und Impfpläne zu berechnen.
          </p>
          <pre style={debugPreStyle}>
            {JSON.stringify(answers, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------
// Styles – hell, medizinisch, Vaxio-Look
// ---------------------------------------

const appRootStyle: CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  padding: "2.5rem 1.25rem",
  background:
    "radial-gradient(circle at top, #e0f2fe 0, #e5f0ff 40%, #f3f4f6 100%)",
  color: "#0f172a",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const appShellStyle: CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1.5rem",
  alignItems: "flex-start",
  marginBottom: "1.75rem",
};

const logoRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginBottom: "0.5rem",
};

const logoCircleStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  background:
    "conic-gradient(from 140deg, #0ea5e9, #38bdf8, #22c55e, #3b82f6, #0ea5e9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "1.1rem",
  color: "#0f172a",
};

const logoTextStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "1.25rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#0f172a",
};

const titleStyle: CSSProperties = {
  fontSize: "1.9rem",
  fontWeight: 700,
  margin: "0 0 0.25rem 0",
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: "520px",
  fontSize: "0.95rem",
  lineHeight: 1.5,
  color: "#4b5563",
};

const badgeStyle: CSSProperties = {
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const badgePillStyle: CSSProperties = {
  borderRadius: "999px",
  padding: "0.35rem 0.9rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  background: "rgba(37,99,235,0.06)",
  color: "#1d4ed8",
  border: "1px solid rgba(37,99,235,0.4)",
};

const badgeTextStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: "#6b7280",
};

const stepperStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginBottom: "1.75rem",
};

const stepPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.25rem 0.75rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.6)",
  background: "rgba(255,255,255,0.8)",
  fontSize: "0.8rem",
  color: "#1f2933",
};

const stepIdStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "rgba(59,130,246,0.12)",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const sectionStyle: CSSProperties = {
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 14px 40px rgba(148,163,184,0.25)",
  padding: "1.75rem",
  marginBottom: "1.8rem",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 0.35rem 0",
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "#111827",
};

const sectionHintStyle: CSSProperties = {
  margin: "0 0 1.25rem 0",
  fontSize: "0.9rem",
  color: "#6b7280",
};

const subTitleStyle: CSSProperties = {
  margin: "1.1rem 0 0.35rem 0",
  fontSize: "1rem",
  fontWeight: 600,
  color: "#1f2937",
};

const fieldLabelTextStyle: CSSProperties = {
  margin: "0 0 0.45rem 0",
  fontSize: "0.9rem",
  color: "#111827",
};

const fieldGroupStyle: CSSProperties = {
  marginBottom: "1rem",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "0.65rem",
  fontSize: "0.9rem",
  color: "#111827",
};

const helpTextStyle: CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#6b7280",
  marginTop: "-0.4rem",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "0.25rem",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  padding: "0.45rem 0.65rem",
  background: "#f9fafb",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "80px",
  resize: "vertical",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const radioLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  marginBottom: "0.25rem",
  fontSize: "0.9rem",
  color: "#111827",
};

const inlineRowStyle: CSSProperties = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap",
};

const optionGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const activitiesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "0.35rem 1rem",
};

const twoColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "0.35rem 1rem",
};

const submitButtonStyle: CSSProperties = {
  padding: "0.8rem 1.6rem",
  fontSize: "0.95rem",
  borderRadius: "999px",
  border: "none",
  background:
    "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 40%, #2563eb 100%)",
  color: "#f9fafb",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(37,99,235,0.3)",
};

const vaccineCardStyle: CSSProperties = {
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  padding: "1rem 1.1rem",
  marginBottom: "0.9rem",
};

const vaccineHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.3rem",
};

const vaccineNameStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "0.95rem",
  color: "#111827",
};

const debugCardStyle: CSSProperties = {
  marginTop: "2rem",
  marginBottom: "1rem",
  borderRadius: "18px",
  background: "#ffffff",
  border: "1px dashed #cbd5f5",
  padding: "1.5rem",
};

const debugPreStyle: CSSProperties = {
  background: "#0b1120",
  padding: "0.75rem 0.9rem",
  borderRadius: "10px",
  maxHeight: "360px",
  overflow: "auto",
  fontSize: "0.8rem",
  lineHeight: 1.4,
  color: "#e5e7eb",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

// ---------------------------------------
// Kleine UI-Helfer-Komponenten
// ---------------------------------------

// Checkbox für Aktivitäten
function renderActivityCheckbox(
  value: string,
  label: string,
  current: string[],
  onChange: (value: string) => void
) {
  const checked = current.includes(value);
  return (
    <label key={value} style={radioLabelStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  );
}

// Checkbox für chronische Erkrankungen
function renderChronicCheckbox(
  value: string,
  label: string,
  current: string[],
  onChange: (value: string) => void
) {
  const checked = current.includes(value);
  return (
    <label key={value} style={radioLabelStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  );
}

// Ja/Nein-Radio-Group
function renderYesNoGroup(
  name: string,
  current: boolean | null,
  onChange: (value: boolean) => void,
  labelOverride?: string
) {
  return (
    <div>
      {labelOverride && (
        <p style={{ ...fieldLabelTextStyle, marginBottom: "0.3rem" }}>
          {labelOverride}
        </p>
      )}
      <div style={optionGroupStyle}>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name={name}
            checked={current === true}
            onChange={() => onChange(true)}
          />
          <span>ja</span>
        </label>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name={name}
            checked={current === false}
            onChange={() => onChange(false)}
          />
          <span>nein</span>
        </label>
      </div>
    </div>
  );
}

export default App;