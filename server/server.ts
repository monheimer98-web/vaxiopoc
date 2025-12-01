// server/server.ts

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";

import {
  buildVaccinationPlan,
  type QuestionnaireAnswers,
  type RiskProfile,
  type VaccinationPlan
} from "./immunizationEngine";

// -------------------------------------
// Basis-Setup
// -------------------------------------

const app = express();

// JSON-Body parsen (bis 1 MB reicht hier dicke)
app.use(express.json({ limit: "1mb" }));

// CORS – erlaubt Anfragen vom Frontend (localhost:3000, 5173 etc.)
// Für Produktion später an eure Domain anpassen.
app.use(
  cors({
    origin: true, // spiegelt Origin zurück (für lokale Entwicklung praktisch)
    credentials: false
  })
);

// HTTP-Logging
app.use(morgan("dev"));

// Kleine Hilfs-Typen für Requests/Responses
interface VaccinationPlanRequestBody {
  questionnaire: QuestionnaireAnswers;
  /**
   * Neuer „offizieller“ Name – wenn das Frontend explizit so schickt.
   * Wird nur zu Debug-/Vergleichszwecken genutzt, nicht als Quelle der Wahrheit.
   */
  riskProfileFromClient?: RiskProfile;
  /**
   * Alte / bequemere Schreibweise, wie du sie aktuell im Frontend verwendest:
   *   body: { questionnaire, riskProfile: rp }
   * Wir akzeptieren beides und mappen intern auf riskProfileFromClient.
   */
  riskProfile?: RiskProfile;
  meta?: {
    source?: string;
    clientVersion?: string;
  };
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

// -------------------------------------
// Healthcheck-Endpunkte (Monitoring / Debug)
// -------------------------------------

app.get(
  "/health",
  (req: Request, res: Response<ApiSuccessResponse<{ status: string }>>) => {
    res.json({
      success: true,
      data: {
        status: "ok"
      }
    });
  }
);

app.get(
  "/health/version",
  (
    req: Request,
    res: Response<ApiSuccessResponse<{ status: string; time: string }>>
  ) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        time: new Date().toISOString()
      }
    });
  }
);

// -------------------------------------
// Zentrale Helper: Safe-Parsing mit Fehlermeldungen
// -------------------------------------

function isQuestionnaireAnswers(obj: any): obj is QuestionnaireAnswers {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.travel || !obj.health || !obj.vaccinations) return false;
  // Grobe Strukturprüfung – Detailvalidierung ist ärztliche Aufgabe
  return true;
}

function badRequest(
  res: Response<ApiErrorResponse>,
  message: string,
  details?: unknown
) {
  return res.status(400).json({
    success: false,
    error: {
      message,
      code: "BAD_REQUEST",
      details
    }
  });
}

// -------------------------------------
// Kern-Endpoint: Impfplan berechnen
// -------------------------------------

app.post(
  "/api/v1/vaccination-plan",
  async (
    req: Request<
      unknown,
      ApiSuccessResponse<{ plan: VaccinationPlan }> | ApiErrorResponse,
      VaccinationPlanRequestBody
    >,
    res: Response<ApiSuccessResponse<{ plan: VaccinationPlan }> | ApiErrorResponse>,
    _next: NextFunction
  ) => {
    try {
      const body = req.body;

      if (!body || typeof body !== "object") {
        return badRequest(res, "Request-Body fehlt oder ist ungültig.");
      }

      const {
        questionnaire,
        riskProfileFromClient,
        riskProfile // „alte“ Schreibweise aus dem Frontend
      } = body;

      if (!isQuestionnaireAnswers(questionnaire)) {
        return badRequest(
          res,
          "Fragebogenstruktur ungültig oder unvollständig.",
          {
            gotKeys: questionnaire ? Object.keys(questionnaire) : null
          }
        );
      }

      // Wir akzeptieren beide Feldnamen, nutzen es aber nur optional zu Debug-Zwecken
      const clientRiskProfile: RiskProfile | undefined =
        riskProfileFromClient ?? riskProfile;

      // Debug-Log (kannst du später auch reduzieren)
      console.log("📥 Neue Impfplan-Anfrage:");
      console.log(
        JSON.stringify(
          {
            countries: questionnaire.travel?.countries,
            age: questionnaire.health?.age,
            activities: questionnaire.travel?.activities,
            clientRiskProfile
          },
          null,
          2
        )
      );

      // Impfplan berechnen (Risikoprofil wird serverseitig nochmal abgeleitet)
      const plan = buildVaccinationPlan({
        questionnaire,
        riskProfileFromClient: clientRiskProfile
      });

      const responseBody: ApiSuccessResponse<{ plan: VaccinationPlan }> = {
        success: true,
        data: { plan }
      };

      return res.status(200).json(responseBody);
    } catch (err: any) {
      console.error("❌ Fehler bei /api/v1/vaccination-plan:", err);

      const message =
        typeof err?.message === "string"
          ? err.message
          : "Interner Fehler bei der Impfplan-Berechnung.";

      return res.status(500).json({
        success: false,
        error: {
          message,
          code: "INTERNAL_ERROR"
        }
      });
    }
  }
);

// -------------------------------------
// Fallback für nicht gefundene Routen
// -------------------------------------

app.use((req: Request, res: Response<ApiErrorResponse>) => {
  return res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} wurde nicht gefunden.`,
      code: "NOT_FOUND"
    }
  });
});

// -------------------------------------
// Server starten
// -------------------------------------

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`🚀 Impfplan-Server läuft auf http://localhost:${PORT}`);
  console.log(`   POST  /api/v1/vaccination-plan`);
});

