#!/usr/bin/env python3
"""
Sync new publications into assets/publications.bib.

Source of truth for *discovery*: the ORCID public API (reliable, free, no
login/CAPTCHA — unlike scraping Google Scholar, which routinely blocks
requests from cloud/CI IP ranges). For each DOI ORCID lists that is not
already in publications.bib, richer metadata (authors, journal, volume,
pages, year) is pulled from the Crossref REST API, which is also free and
unauthenticated.

This script only ever *appends* new entries. It never rewrites or deletes
an existing entry, so manually curated fields (keywords, in-review /
in-preparation notes on manuscripts with no DOI yet) are always preserved.
"""
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ORCID_ID = "0000-0002-0095-6235"
BIB_PATH = Path(__file__).resolve().parent.parent / "assets" / "publications.bib"
UA = "Mozilla/5.0 (compatible; academic-site-sync/1.0; +https://mebrahtuweldeghebriel.org/)"


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def orcid_dois():
    url = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
    data = fetch_json(url, {"Accept": "application/json", "User-Agent": UA})
    dois = set()
    for group in data.get("group", []):
        for ext in group.get("external-ids", {}).get("external-id", []):
            if ext.get("external-id-type") == "doi":
                dois.add(ext["external-id-value"].strip().lower())
    return dois


def existing_dois(bib_text):
    return set(m.group(1).strip().lower() for m in re.finditer(r"doi\s*=\s*\{([^}]+)\}", bib_text))


SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
       "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
       "+": "⁺", "-": "⁻"}
SUB = {"0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
       "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
       "+": "₊", "-": "₋"}
SUP_CHARS = "".join(SUP.values())


def clean_abstract(raw):
    """Crossref abstracts come as JATS XML for publishers that supply them
    (mostly Nature/AAAS/Wiley; Elsevier journals typically supply none, so
    this returns '' for those and the field is simply omitted)."""
    if not raw:
        return ""
    s = re.sub(r"<jats:sup>(.*?)</jats:sup>",
                lambda m: "".join(SUP.get(c, c) for c in m.group(1)), raw, flags=re.S)
    s = re.sub(r"<jats:sub>(.*?)</jats:sub>",
                lambda m: "".join(SUB.get(c, c) for c in m.group(1)), s, flags=re.S)
    s = re.sub(r"</?jats:[a-z]+[^>]*>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s*([" + SUP_CHARS + r"]+)\s*", r"\1", s)
    s = re.sub(r"^(abstract)\s*", "", s, flags=re.I)
    s = html.unescape(s)
    return re.sub(r"\s+\)", ")", s).strip()


def crossref_entry(doi):
    url = f"https://api.crossref.org/works/{urllib.request.quote(doi)}"
    data = fetch_json(url, {"User-Agent": UA})
    msg = data["message"]
    title = (msg.get("title") or [""])[0]
    journal = (msg.get("container-title") or [""])[0]
    volume = msg.get("volume", "")
    pages = msg.get("page", "")
    abstract = clean_abstract(msg.get("abstract", ""))
    year = ""
    for key in ("published-print", "published-online", "published", "issued"):
        parts = msg.get(key, {}).get("date-parts")
        if parts and parts[0]:
            year = str(parts[0][0])
            break
    authors = []
    for a in msg.get("author", []) or []:
        given, family = a.get("given", ""), a.get("family", "")
        if family:
            authors.append(f"{family}, {given}".strip(", "))
    author_str = " and ".join(authors) if authors else "Weldeghebriel, M. F. and others"

    first_author_key = re.sub(r"[^A-Za-z]", "", authors[0].split(",")[0]) if authors else "Auto"
    citekey = f"{first_author_key}{year}Auto"

    lines = [f"@article{{{citekey},"]
    lines.append(f"  author = {{{author_str}}},")
    lines.append(f"  title = {{{title}}},")
    if journal:
        lines.append(f"  journal = {{{journal}}},")
    if volume:
        lines.append(f"  volume = {{{volume}}},")
    if pages:
        lines.append(f"  pages = {{{pages}}},")
    if year:
        lines.append(f"  year = {{{year}}},")
    lines.append(f"  doi = {{{doi}}},")
    if abstract:
        lines.append(f"  abstract = {{{abstract.replace('{', '(').replace('}', ')')}}},")
    lines.append("  keywords = {auto-synced}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main():
    bib_text = BIB_PATH.read_text(encoding="utf-8")
    have = existing_dois(bib_text)

    try:
        found = orcid_dois()
    except Exception as e:
        print(f"ORCID fetch failed: {e}", file=sys.stderr)
        return 0  # non-fatal: don't break the scheduled run

    new_dois = sorted(found - have)
    if not new_dois:
        print("No new publications found.")
        return 0

    additions = []
    for doi in new_dois:
        try:
            additions.append(crossref_entry(doi))
            print(f"Added: {doi}")
        except Exception as e:
            print(f"Skipping {doi}: {e}", file=sys.stderr)

    if additions:
        with BIB_PATH.open("a", encoding="utf-8") as f:
            f.write("\n" + "\n".join(additions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
