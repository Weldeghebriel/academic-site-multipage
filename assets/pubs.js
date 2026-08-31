/* Reads assets/publications.bib and renders it as a plain reference list.
   The .bib is kept up to date automatically by .github/workflows/sync-publications.yml. */

const ME = /weldeghebriel/i;

async function loadBib(path) {
  const res = await fetch(path || 'assets/publications.bib');
  if (!res.ok) throw new Error('Could not load publications.bib');
  return parseBibTeX(await res.text());
}

function parseBibTeX(text) {
  const entries = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const at = text.indexOf('@', i);
    if (at === -1) break;
    const j = text.indexOf('{', at);
    if (j === -1) break;
    const type = text.slice(at + 1, j).trim().toLowerCase();
    const k = text.indexOf(',', j + 1);
    if (k === -1) break;
    let brace = 1, p = k + 1;
    while (p < n && brace > 0) {
      const ch = text[p];
      if (ch === '\\') { p += 2; continue; }
      if (ch === '{') brace++;
      else if (ch === '}') brace--;
      p++;
    }
    entries.push({ type, fields: parseFields(text.slice(k + 1, p - 1).trim()) });
    i = p;
  }
  return entries;
}

function parseFields(block) {
  const fields = {};
  let cur = '', depth = 0;
  const push = s => {
    const idx = s.indexOf('=');
    if (idx === -1) return;
    const name = s.slice(0, idx).trim().toLowerCase();
    let val = s.slice(idx + 1).trim();
    if (val.startsWith('{') && val.endsWith('}')) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    fields[name] = val.trim();
  };
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === '\\') { cur += ch + (block[i + 1] || ''); i++; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (depth === 0 && ch === ',') { push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) push(cur);
  return fields;
}

/* BibTeX source conventions -> readable text: en/em dashes, brace groups
   used only to protect capitalisation, and escaped ampersands. */
function deTeX(s) {
  return (s || '')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\&/g, '&')
    .replace(/[{}]/g, '')
    .trim();
}

function esc(s) {
  return deTeX(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* "Weldeghebriel, M. F. and Lowenstein, T. K." -> "M. F. Weldeghebriel, T. K. Lowenstein",
   with the site owner's own name bolded. */
function fmtAuthors(a) {
  if (!a) return '';
  return (a.split(/\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => {
      const parts = name.split(',');
      const display = parts.length === 2
        ? `${parts[1].trim()} ${parts[0].trim()}`
        : name;
      return ME.test(name) ? `<strong>${esc(display)}</strong>` : esc(display);
    })
    .join(', '));
}

function entryHTML(e) {
  const f = e.fields;
  const authors = fmtAuthors(f.author);
  const year = f.year ? ` (${esc(f.year)})` : '';
  const title = esc(f.title);
  const venue = esc(f.journal || f.booktitle || '');
  const detail = [f.volume, f.pages].filter(Boolean).map(esc).join(', ');
  const note = f.note ? `<span class="pub-note">${esc(f.note)}</span>` : '';
  const doi = f.doi
    ? ` <a class="pub-doi" href="https://doi.org/${encodeURI(f.doi)}" target="_blank" rel="noopener">doi</a>`
    : '';

  const venueLine = [venue ? `<em>${venue}</em>` : '', detail].filter(Boolean).join(' ');

  return `<li class="pub">
    <span class="pub-authors">${authors}</span>${year}.
    <span class="pub-title">${title}.</span>
    ${venueLine}${venueLine ? '.' : ''} ${note}${doi}
  </li>`;
}

function byYearDesc(a, b) {
  return (parseInt(b.fields.year, 10) || 0) - (parseInt(a.fields.year, 10) || 0);
}

async function renderPublications(publishedId, pipelineId) {
  const pub = document.getElementById(publishedId);
  const pipe = document.getElementById(pipelineId);
  let entries;
  try {
    entries = await loadBib();
  } catch (err) {
    if (pub) pub.innerHTML = '<li class="muted">Publication list could not be loaded.</li>';
    console.error(err);
    return;
  }

  const published = entries.filter(e => e.type !== 'unpublished').sort(byYearDesc);
  const pipeline = entries.filter(e => e.type === 'unpublished').sort(byYearDesc);

  if (pub) pub.innerHTML = published.map(entryHTML).join('');
  if (pipe) pipe.innerHTML = pipeline.map(entryHTML).join('');

  const count = document.getElementById('pubCount');
  if (count) {
    const nRev = pipeline.filter(e => /review/i.test(e.fields.note || '')).length;
    const nPrep = pipeline.length - nRev;
    count.textContent =
      `${published.length} peer-reviewed publications · ${nRev} in review · ${nPrep} in preparation`;
  }
}
