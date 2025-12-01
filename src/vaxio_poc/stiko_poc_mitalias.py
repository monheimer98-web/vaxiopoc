import re
import json
import unicodedata
import pdfplumber
from pathlib import Path

# ======================
# KONFIG
# ======================
PDF_PATH = r"C:/Users/monhe/OneDrive/Dokumente/EB-14-2025.pdf"

# ---- MANUELLE ALIASE für eure extra Regions-/Insel-Seiten
# Diese werden zusätzlich zu STIKO-"siehe"-Aliasen übernommen.
MANUAL_ALIASES = {
    # UAE Emirate -> VAE
    "Abu Dhabi": "Vereinigte Arabische Emirate",
    "Dubai": "Vereinigte Arabische Emirate",
    "Fujairah": "Vereinigte Arabische Emirate",
    "Ras al-Khaimah": "Vereinigte Arabische Emirate",
    "Sharjah": "Vereinigte Arabische Emirate",
    "Umm al Qawain": "Vereinigte Arabische Emirate",

    # Portugal-Inseln -> Portugal inkl. Azoren/Madeira
    "Madeira": "Portugal inkl. Azoren und Madeira",
    "Azoren": "Portugal inkl. Azoren und Madeira",

    # Indonesien-Regionen
    "Kalimantan": "Indonesien",

    # NL Karibik einzeln -> STIKO-Kombi-Key
    "Aruba": "Aruba, Bonaire (besondere Gemeinde der NLD), Curacao",
    "Bonaire": "Aruba, Bonaire (besondere Gemeinde der NLD), Curacao",
    "Curaçao": "Aruba, Bonaire (besondere Gemeinde der NLD), Curacao",

    # Sint Eustatius / Sint Maarten einzeln -> STIKO-Kombi-Key
    "Sint Eustatius": "Sint Eustatius (bes. Gemeinde der NLD), Sint Maarten (NLD)",
    "Sint Maarten": "Sint Eustatius (bes. Gemeinde der NLD), Sint Maarten (NLD)",

    # UK Crown Dependencies -> UK
    "Guernsey": "Großbritannien (GBR) und Nordirland",
    "Jersey": "Großbritannien (GBR) und Nordirland",
    "Isle of Man": "Großbritannien (GBR) und Nordirland",

    # China Sonderregionen
    "Hongkong": "China",
    "Macau": "China",
    "Tibet": "China",

    # USA Unterregionen
    "Hawaï": "Vereinigte Staaten von Amerika (USA)",
    "Wake Island": "Vereinigte Staaten von Amerika (USA)",

    # Australien Unterregionen
    "Tasmanië": "Australien",
    "Koraalzee-eilanden": "Australien",

    # optional/klein
    "Aland": "Finnland",
    "Faeröer": "Färöer-Inseln (Dänemark)",
}

# STIKO-Reiseimpf-Set + Varianten zum "Sauberziehen" der Bullet-Zeilen
# (keine Logik-Abhängigkeit, nur Cleanup / Robustheit)
VACCINE_CANON = {
    "altersentsprechende grundimmunisierung gemäß aktueller stiko":
        "Altersentsprechende Grundimmunisierung gemäß aktueller STIKO",
    "mmr/mmr-v": "MMR/MMR-V",
    "mmr": "MMR/MMR-V",
    "poliomyelitis": "Poliomyelitis",
    "tdap": "Tdap",
    "tdap/tdap": "Tdap",
    "tdap/tdap (tdap)": "Tdap",
    "tdap/tdap (tdap/t).": "Tdap",
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
# HELPERS
# ======================
def norm(s: str) -> str:
    """ASCII-normalisiert, lowercased – gut für Vergleiche."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

def looks_like_alpha_separator(line: str) -> bool:
    """Filtert PDF-Layout-Alpha-Trenner wie 'B · C'."""
    letters_only = re.sub(r"[^A-Za-zÄÖÜäöüß]", "", line)
    if 1 <= len(letters_only) <= 3 and letters_only.upper() == letters_only:
        return True
    return False

def is_heading_candidate(line: str) -> bool:
    """Heuristik: ist diese Zeile wahrscheinlich ein Ländername?"""
    bad_markers = [
        "Nachweispflicht", "Impfungen bei", "Impfungen für alle",
        "Reisenden", "Risiken", "Tabelle", "Aufbau", "Disclaimer",
        "Name des Landes"
    ]
    if any(k in line for k in bad_markers):
        return False
    if looks_like_alpha_separator(line):
        return False
    if line.isupper() and len(line) > 10:  # z.B. ELLEBATREDNÄL
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
    cleaned = line.replace("→", " ").replace("", " ").replace("⇨", " ")
    m = re.search(r"^(.*?)\s+(?:s\.|siehe)\s+(.*)$", cleaned, flags=re.IGNORECASE)
    if not m:
        return None
    alias = m.group(1).strip()
    target = m.group(2).strip()
    if alias and target:
        return alias, target
    return None

def canonical_vaccine_from_line(line: str):
    """Sucht bekannten Impfstoffnamen und gibt kanonischen Namen zurück."""
    n = norm(line)
    for key in CANON_KEYS_SORTED:
        if key in n:
            return VACCINE_CANON[key]
    return None

def cleanup_vaccine(raw: str) -> str:
    """Entfernt White-Field-Text hinter Impfstoffnamen."""
    raw = raw.strip().replace("*", "")
    canon = canonical_vaccine_from_line(raw)
    if canon:
        return canon

    cut_markers = [" Nicht ", " nur ", " außer ", "inkl.", " inkl.", " > ", " – "]
    for cm in cut_markers:
        idx = raw.find(cm)
        if idx > 0:
            raw = raw[:idx].strip()

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
    """Extrahiert Bullet-Items (▶) und Risiko-Tags."""
    items = []
    parts = section_text.split("▶")[1:]

    for part in parts:
        first_line = part.strip().splitlines()[0].strip().replace("*", "")

        if not re.search(r"\d", first_line):
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
    """Extrahiert Nachweispflicht-Impfungen."""
    entries = []
    for line in section_text.splitlines():
        if "Nachweispflicht" in line:
            for m in re.finditer(
                r"([A-Za-zÄÖÜäöüß\-\.\s()/]+?):\s*Nachweispflicht",
                line
            ):
                raw = m.group(1).strip()
                canon = cleanup_vaccine(raw)
                if canon:
                    entries.append(canon)

    return dedup_keep_order(entries)

def split_into_sections(block_text: str):
    """Schneidet Landblock in die 3 STIKO-Bereiche."""
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
        end = spans[i+1][0] if i+1 < len(spans) else len(block_text)
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
    # 2) LÄNDERTABELLE-SEITEN FINDEN (robuster)
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
# 4) HEADINGS (LÄNDER) ERKENNEN + ALIASE SAMMELN
# ======================
headings = []
alias_map = {}  # STIKO-Aliase aus dem PDF

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

# >>> HIER: manuelle Aliase zusätzlich einpflegen
alias_map.update(MANUAL_ALIASES)

heading_positions = sorted([pos for pos, _ in headings])

blocks = {}
for pos, name in headings:
    next_pos = None
    for hp in heading_positions:
        if hp > pos:
            next_pos = hp
            break

    block_lines = clean_lines[pos: next_pos if next_pos else len(clean_lines)]
    blocks[name] = "\n".join(block_lines)

# ======================
# 5) PARSEN ALLER ECHTEN LÄNDER
# ======================
output = {}

for country, block_text in blocks.items():
    sections = split_into_sections(block_text)

    entry_req = extract_entry_requirements(sections.get("entryRequirements", ""))
    if_risk_items = extract_bullets(sections.get("ifRisk", ""))
    for_all_items = extract_bullets(sections.get("forAll", ""))

    rec_for_all = dedup_keep_order([x["vaccine"] for x in for_all_items])

    output[country] = {
        "countryName": country,
        "entryRequirements": entry_req,
        "recommendedForAll": rec_for_all,
        "recommendedIfRisk": if_risk_items
    }

# ======================
# 6) ALIASE AUFLÖSEN (generisch)
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

    if alias_name in output and output[alias_name].get("recommendedForAll"):
        continue

    copied = json.loads(json.dumps(output[target_key]))  # deep copy
    copied["countryName"] = alias_name
    copied["aliasOf"] = target_key
    output[alias_name] = copied

# ======================
# 7) FINAL CLEANUP: falsche Keys raus
# ======================
bad_keys = []
for k in output.keys():
    nk = norm(k)
    if nk in {"name des landes", "b c", "b·c", "b  c"}:
        bad_keys.append(k)

for bk in bad_keys:
    output.pop(bk, None)

# ======================
# 8) JSON SPEICHERN + AUSGABE
# ======================
print(json.dumps(output, ensure_ascii=False, indent=2))

out_path = pdf_path.with_name("stiko_all_countries_plusalias.json")
out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n✅ Gesamt-JSON gespeichert unter: {out_path}")
