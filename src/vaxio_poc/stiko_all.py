import re
import json
import unicodedata
import pdfplumber
from pathlib import Path

# ======================
# KONFIG
# ======================
PDF_PATH = r"C:/Users/monhe/OneDrive/Dokumente/EB-14-2025.pdf"

# ======================
# STIKO-Reiseimpf-Set + Varianten zum "Sauberziehen" der Bullet-Zeilen
# ======================
VACCINE_CANON = {
    "altersentsprechende grundimmunisierung gemäß aktueller stiko":
        "Altersentsprechende Grundimmunisierung gemäß aktueller STIKO",
    "mmr/mmr-v": "MMR/MMR-V",
    "mmr": "MMR/MMR-V",
    "poliomyelitis": "Poliomyelitis",
    "tdap": "TDaP/Tdap",
    "tdap/tdap": "TDaP/Tdap",
    "tdap/tdap (tdap)": "TDaP/Tdap",
    "tda p/tdap": "TDaP/Tdap",
    "tda p": "TDaP/Tdap",
    "t dap/tdap": "TDaP/Tdap",
    "tollwut": "Tollwut",
    "typhus": "Typhus",
    "hepatitis a": "Hepatitis A",
    "hepatitis b": "Hepatitis B",
    "gelbfieber": "Gelbfieber",
    "cholera": "Cholera",
    "influenza": "Influenza",
    "tbe (fsme-impfung)": "TBE (FSME-Impfung)",
    "fsme": "TBE (FSME-Impfung)",
    "tbe": "TBE (FSME-Impfung)",
    "meningokokken-acwy": "Meningokokken-ACWY",
    "meningokokken acwy": "Meningokokken-ACWY",
    "japanische enzephalitis": "Japanische Enzephalitis",
    "japan. enzephalitis": "Japanische Enzephalitis",
    "dengue": "Dengue",
    "covid-19": "COVID-19",
    "sars-cov-2": "COVID-19",
}

CANON_KEYS_SORTED = sorted(VACCINE_CANON.keys(), key=len, reverse=True)

# ======================
# MANUELLE ALIASE (aus NL-Webseitenliste / Kombi-Keys)
# ======================
# Format: "Alias-Seitentitel": "STIKO-Target-Key"
MANUAL_ALIAS_MAP = {
    # Kombi-Keys aus STIKO
    "Chile": "Chile – inkl. Osterinsel",
    "Osterinsel": "Chile – inkl. Osterinsel",
    "Paaseiland": "Chile – inkl. Osterinsel",

    "Ecuador": "Ecuador – inkl. Galapagos",
    "Galapagos": "Ecuador – inkl. Galapagos",
    "Galapagosinseln": "Ecuador – inkl. Galapagos",
    "Galapagoseilanden": "Ecuador – inkl. Galapagos",

    "Portugal": "Portugal inkl. Azoren und Madeira",

    # Kurznamen ohne Klammer-Qualifier
    "Tonga": "Tonga (Polynesien)",
    "Tokelau": "Tokelau (NZL)",
    "Ost-Timor": "Timor-Leste (Ost-Timor)",

    # USA-Shortcuts
    "USA": "Vereinigte Staaten von Amerika (USA)",
    "Vereinigte Staaten": "Vereinigte Staaten von Amerika (USA)",
    "United States": "Vereinigte Staaten von Amerika (USA)",

    # Optional – falls ihr diese Seitennamen verwendet
    "Tasmanien": "Australien",
    "Korallensee-Inseln": "Australien",
}

# ======================
# HELPERS
# ======================

def norm(s: str) -> str:
    """ASCII-normalisiert, lowercased – gut für Vergleiche."""
    return (
        unicodedata.normalize("NFKD", s)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


def looks_like_alpha_separator(line: str) -> bool:
    """Filtert PDF-Layout-Alpha-Trenner wie 'B · C'."""
    letters_only = re.sub(r"[^A-Za-zÄÖÜäöüß]", "", line)
    if 1 <= len(letters_only) <= 3 and letters_only.upper() == letters_only:
        return True
    return False


def is_heading_candidate(line: str) -> bool:
    """Heuristik: ist diese Zeile wahrscheinlich ein Ländername?"""
    bad_markers = [
        "Nachweispflicht",
        "Impfungen bei",
        "Impfungen für alle",
        "Reisenden",
        "Risiken",
        "Tabelle",
        "Aufbau",
        "Disclaimer",
        "Name des Landes",
    ]
    if any(k in line for k in bad_markers):
        return False
    if looks_like_alpha_separator(line):
        return False
    if line.isupper() and len(line) > 10:
        return False
    if re.search(r"\d", line):
        return False
    if len(line) > 60:
        return False
    if len(line) <= 2:
        return False
    if not re.match(r"^[A-ZÄÖÜ]", line):
        return False
    return True


def extract_alias(line: str):
    """
    Erfasst Zeilen wie:
      'Bali  s. Indonesien'
      'Kanarische Inseln (Spanien) s. Spanien'
    Gibt (alias, target) oder None zurück.
    """
    cleaned = (
        line.replace("→", " ")
        .replace("", " ")
        .replace("⇨", " ")
        .replace("►", " ")
    )
    m = re.search(
        r"^(.*?)\s+(?:s\.|siehe)\s+(.*)$", cleaned, flags=re.IGNORECASE
    )
    if not m:
        return None
    alias = m.group(1).strip()
    target = m.group(2).strip()
    if alias and target:
        return alias, target
    return None


def canonical_vaccine_from_line(line: str):
    n = norm(line)
    for key in CANON_KEYS_SORTED:
        if key in n:
            return VACCINE_CANON[key]
    return None


def cleanup_vaccine(raw: str) -> str:
    """Rohtext → kanonisierter Impfstoffname."""
    raw = raw.strip().replace("*", "")
    canon = canonical_vaccine_from_line(raw)
    if canon:
        return canon

    # Inhalte nach typischen Trennern kappen
    cut_markers = [" Nicht ", " nur ", " außer ", "inkl.", " inkl.", " > ", " – "]
    for cm in cut_markers:
        idx = raw.find(cm)
        if idx > 0:
            raw = raw[:idx].strip()

    # Auch hinter Punkt/Strichpunkt nur den ersten Teil
    raw = re.split(r"[.;]", raw)[0].strip()
    return raw


def dedup_keep_order(items):
    seen = set()
    out = []
    for it in items:
        k = norm(it)
        if k not in seen:
            seen.add(k)
            out.append(it)
    return out


def extract_bullets(section_text: str):
    """
    Holt alle ▶-Bullets und extrahiert:
      - Impfstoffname
      - Risk-Tags (Liste von ints)
    """
    items = []
    parts = section_text.split("▶")[1:]  # vor dem ersten ▶ steht Überschrift etc.

    for part in parts:
        first_line = part.strip().splitlines()[0].strip().replace("*", "")

        if not re.search(r"\d", first_line):
            # Kein Risikotag in der Zeile
            vaccine_raw = first_line.split("  ")[0].split(":")[0].strip()
            vaccine = cleanup_vaccine(vaccine_raw)
            risk_tags = []
        else:
            first_digit_idx = re.search(r"\d", first_line).start()
            vaccine_raw = first_line[:first_digit_idx].strip()
            vaccine = cleanup_vaccine(vaccine_raw)

            rest = first_line[first_digit_idx:]
            m = re.match(r"^(\d[\d,\s]*)", rest)
            risk_cluster = m.group(1) if m else ""
            risk_cluster = re.sub(r"\s+", "", risk_cluster)
            risk_tags = sorted(set(int(x) for x in re.findall(r"\d", risk_cluster)))

        items.append({"vaccine": vaccine, "riskTags": risk_tags})
    return items


def extract_entry_requirements(section_text: str):
    """
    Unterscheidet:
      - always: Nachweispflicht generell
      - conditional: Nachweispflicht nur 'bei Einreise aus ...' / Transit etc.
    """
    always = []
    conditional = []

    for line in section_text.splitlines():
        if "Nachweispflicht" not in line:
            continue

        # Impfstoff vor dem ':' vor 'Nachweispflicht' herausziehen
        for m in re.finditer(
            r"([A-Za-zÄÖÜäöüß\-\.\s()/]+?):\s*Nachweispflicht", line
        ):
            raw = m.group(1).strip()
            canon = cleanup_vaccine(raw)
            if not canon:
                continue

            ln_norm = norm(line)

            # Typische Phrasen für bedingte Nachweispflicht
            conditional_markers = [
                "bei einreise aus",
                "bei einreisen aus",
                "bei einreise aus einem",
                "bei einreise aus bestimmten",
                "bei einreise aus landern",
                "bei einreise aus einem land",
                "bei transit uber",
                "bei transit über",
            ]

            is_conditional = any(mark in ln_norm for mark in conditional_markers)

            if is_conditional:
                conditional.append(canon)
            else:
                always.append(canon)

    return {
        "always": dedup_keep_order(always),
        "conditional": dedup_keep_order(conditional),
    }


def split_into_sections(block_text: str):
    """
    Teilt einen Länder-Block in:
      - entryRequirements
      - ifRisk
      - forAll
    anhand der Marker 'Nachweispflicht', 'Impfungen bei', 'Impfungen für alle'.
    """
    markers = [
        ("entryRequirements", "Nachweispflicht"),
        ("ifRisk", "Impfungen bei"),
        ("forAll", "Impfungen für alle"),
    ]

    spans = []
    for key, mark in markers:
        m = re.search(mark, block_text)
        if m:
            spans.append((m.start(), key))

    spans.sort()
    sections = {}
    for i, (start, key) in enumerate(spans):
        end = spans[i + 1][0] if i + 1 < len(spans) else len(block_text)
        sections[key] = block_text[start:end]
    return sections


# ======================
# 1) PDF LADEN
# ======================
pdf_path = Path(PDF_PATH)
if not pdf_path.exists():
    raise FileNotFoundError(f"PDF nicht gefunden: {pdf_path}")

with pdfplumber.open(str(pdf_path)) as pdf:
    pages = pdf.pages

    # ======================
    # 2) LÄNDERTABELLE-SEITEN FINDEN (robust)
    # ======================
    markers = ["Nachweispflicht", "Impfungen bei", "Impfungen für alle"]
    land_pages = []
    for i, p in enumerate(pages):
        t = p.extract_text() or ""
        score = sum(m in t for m in markers)
        if score >= 2:
            land_pages.append(i)

    if not land_pages:
        print("[WARN] Marker-Seiten nicht gefunden – nutze alle Seiten als Fallback.")
        land_pages = list(range(len(pages)))

    # ======================
    # 3) TEXT EXTRAHIEREN & CLEANEN
    # ======================
    land_text = "\n".join((pages[i].extract_text() or "") for i in land_pages)

lines = [ln.strip() for ln in land_text.splitlines() if ln.strip()]

clean_lines = []
for ln in lines:
    if ln.startswith("Epidemiologisches Bulletin"):
        continue
    clean_lines.append(ln)

# ======================
# 4) HEADINGS + PDF-ALIASE
# ======================
headings = []
alias_map = {}  # aus PDF "s. Land"

for i, ln in enumerate(clean_lines[:-2]):
    if not is_heading_candidate(ln):
        continue

    alias = extract_alias(ln)
    if alias:
        alias_name, target = alias
        alias_map[alias_name] = target
        continue

    nxt1 = clean_lines[i + 1]
    nxt2 = clean_lines[i + 2]
    if ("Nachweispflicht" in nxt1) or ("Nachweispflicht" in nxt2):
        headings.append((i, ln))

heading_positions = sorted([pos for pos, _ in headings])

blocks = {}
for pos, name in headings:
    next_pos = None
    for hp in heading_positions:
        if hp > pos:
            next_pos = hp
            break

    block_lines = clean_lines[pos : next_pos if next_pos else len(clean_lines)]
    blocks[name] = "\n".join(block_lines)

# ======================
# 5) PARSEN ECHTER LÄNDER
# ======================
output = {}

for country, block_text in blocks.items():
    sections = split_into_sections(block_text)

    entry_req_info = extract_entry_requirements(
        sections.get("entryRequirements", "")
    )
    entry_req_always = entry_req_info["always"]
    entry_req_conditional = entry_req_info["conditional"]

    if_risk_items = extract_bullets(sections.get("ifRisk", ""))
    for_all_items = extract_bullets(sections.get("forAll", ""))

    rec_for_all = dedup_keep_order([x["vaccine"] for x in for_all_items])

    # IfRisk-Items ohne riskTags rauswerfen (da sonst spätere Logik schwer)
    cleaned_if_risk = []
    for item in if_risk_items:
        if not item["riskTags"]:
            print(
                f"[WARN] Entferne IfRisk ohne riskTags: {country} -> {item['vaccine']}"
            )
            continue
        cleaned_if_risk.append(item)

    # Für Rückwärtskompatibilität: altes Feld 'entryRequirements' = beides zusammen
    legacy_entry_req = dedup_keep_order(
        entry_req_always + entry_req_conditional
    )

    output[country] = {
        "countryName": country,
        # neu und sauber getrennt:
        "entryRequirementsAlways": entry_req_always,
        "entryRequirementsConditional": entry_req_conditional,
        # legacy-Feld (falls du es schon anderswo nutzt)
        "entryRequirements": legacy_entry_req,
        "recommendedForAll": rec_for_all,
        "recommendedIfRisk": cleaned_if_risk,
    }

# ======================
# 6) ALIASE MERGEN (PDF + MANUAL)
# ======================
# Manual ergänzt alias_map, überschreibt nicht
for a, t in MANUAL_ALIAS_MAP.items():
    if a not in alias_map:
        alias_map[a] = t

# ======================
# 7) ALIASE AUFLÖSEN (kopieren)
# ======================
for alias_name, target_name in alias_map.items():
    target_key = None
    for k in output.keys():
        if norm(k) == norm(target_name):
            target_key = k
            break

    if not target_key:
        print(f"[WARN] Alias-Target nicht gefunden: {alias_name} -> {target_name}")
        continue

    # Falls der Alias schon einen eigenen Eintrag mit Empfehlungen hat, nicht überschreiben
    if alias_name in output and output[alias_name].get("recommendedForAll"):
        continue

    copied = json.loads(json.dumps(output[target_key], ensure_ascii=False))
    copied["countryName"] = alias_name
    copied["aliasOf"] = target_key
    output[alias_name] = copied

# ======================
# 8) FINAL CLEANUP
# ======================
bad_keys = []
for k in output.keys():
    nk = norm(k)
    if nk in {"name des landes", "b c", "b·c", "b  c"}:
        bad_keys.append(k)

for bk in bad_keys:
    output.pop(bk, None)

# ======================
# 9) JSON SPEICHERN
# ======================
out_json = json.dumps(output, ensure_ascii=False, indent=2)
print(out_json)

out_path = pdf_path.with_name("stiko_all_final.json")
out_path.write_text(out_json, encoding="utf-8")
print(f"\n✅ Gesamt-JSON gespeichert unter: {out_path}")
