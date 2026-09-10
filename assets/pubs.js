/* Shared BibTeX loader + renderer used by publications.html and project-*.html pages. */

async function loadBib(path){
  const res = await fetch(path || 'assets/publications.bib');
  if(!res.ok) throw new Error('Could not load ' + (path || 'assets/publications.bib'));
  return parseBibTeX(await res.text());
}

function parseBibTeX(text){
  const entries=[]; let i=0,n=text.length;
  while(i<n){
    const at=text.indexOf('@',i); if(at===-1) break;
    let j=text.indexOf('{',at); if(j===-1) break;
    const type=text.slice(at+1,j).trim().toLowerCase();
    let k=text.indexOf(',',j+1); if(k===-1) break;
    const key=text.slice(j+1,k).trim();
    let brace=1,p=k+1,inQ=false;
    while(p<n && brace>0){
      const ch=text[p];
      if(ch==='\\'){ p+=2; continue; } // skip escaped char (e.g. \" \') without touching state
      if(ch==='"'){ inQ=!inQ; }
      else if(!inQ && ch==='{') brace++;
      else if(!inQ && ch==='}') brace--;
      p++;
    }
    const block=text.slice(k+1,p-1).trim();
    const raw=text.slice(at,p);
    const fields=parseFields(block);
    entries.push({type,key,fields,raw});
    i=p;
  }
  return entries;
}

function parseFields(block){
  const fields={}; let cur='',depth=0,inQ=false;
  const push=s=>{
    const idx=s.indexOf('=');
    if(idx>-1){
      const name=s.slice(0,idx).trim().toLowerCase();
      let val=s.slice(idx+1).trim();
      if(val.startsWith('{') && val.endsWith('}')) val=val.slice(1,-1);
      if(val.startsWith('"') && val.endsWith('"')) val=val.slice(1,-1);
      fields[name]=val.trim();
    }
  };
  for(let i=0;i<block.length;i++){
    const ch=block[i];
    if(ch==='\\'){ cur+=ch; if(i+1<block.length){ cur+=block[i+1]; i++; } continue; }
    if(ch==='"') inQ=!inQ;
    if(!inQ && ch==='{') depth++;
    if(!inQ && ch==='}') depth=Math.max(0,depth-1);
    if(!inQ && depth===0 && ch===','){ push(cur); cur=''; continue; }
    cur+=ch;
  }
  if(cur.trim()) push(cur);
  return fields;
}

function fmtAuthors(a){
  if(!a) return '';
  return a.split(/\band\b/i).map(s=>s.trim()).map(n=>{
    const p=n.split(',');
    return (p.length===2 ? (p[1].trim()+' '+p[0].trim()) : n).trim();
  }).join('; ');
}

function statusPill(f){
  const note=(f.note||'').toLowerCase();
  if(note.includes('review')) return `<span class="pill status-review">in review</span>`;
  if(note.includes('preparation') || note.includes('in prep')) return `<span class="pill status-prep">in preparation</span>`;
  return `<span class="pill">${f.__type||''}</span>`;
}

function entryHTML(e){
  const f=e.fields;
  const title=f.title||e.key;
  const auth=fmtAuthors(f.author||'');
  const year=f.year||'';
  const where=f.journal||f.booktitle||f.note||'';
  const extra=[f.volume,f.number,f.pages].filter(Boolean).join(', ');
  const link=f.doi?('https://doi.org/'+f.doi):(f.url||'');
  f.__type=e.type;
  const pill=statusPill(f);
  const line2=[auth,where,extra].filter(Boolean).join(' • ');
  const linkBtn=link?`<a class="pill" href="${link}" target="_blank" rel="noopener">Link</a>`:'';
  const bibBtn=`<button class="pill" type="button" data-raw="${encodeURIComponent(e.raw)}" onclick="copyBibtex(this)">BibTeX</button>`;
  return `<article class="pub card"><div class="title">${title}</div><div class="meta">${line2}${line2?' • ':''}${year} ${pill}</div><div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap">${linkBtn} ${bibBtn}</div></article>`;
}

function copyBibtex(btn){
  const raw=decodeURIComponent(btn.getAttribute('data-raw'));
  navigator.clipboard.writeText(raw).then(()=>{
    const old=btn.textContent;
    btn.textContent='Copied';
    setTimeout(()=>{ btn.textContent=old; },1200);
  });
}

async function renderRelated(targetId, tags, maxItems, bibPath){
  maxItems = maxItems || 5;
  const host=document.getElementById(targetId);
  if(!host) return;
  let entries;
  try{ entries = await loadBib(bibPath); } catch(err){ host.innerHTML='<p class="muted">Could not load publications.</p>'; return; }
  const tset=new Set(tags.map(s=>s.toLowerCase()));
  function score(e){
    const f=e.fields;
    const kws=(f.keywords||'').toLowerCase().split(/[,;]\s*/).filter(Boolean);
    let s=0;
    kws.forEach(k=>{ if(tset.has(k)) s+=2; });
    const hay=((f.title||'')+' '+(f.journal||f.booktitle||'')+' '+(f.author||'')+' '+(f.abstract||'')).toLowerCase();
    tset.forEach(t=>{ if(t && hay.includes(t)) s+=1; });
    return s;
  }
  const scored = entries.map(e=>({e, s:score(e)})).filter(x=>x.s>0);
  scored.sort((a,b)=> (parseInt(b.e.fields.year||0,10)||0) - (parseInt(a.e.fields.year||0,10)||0) || (b.s - a.s));
  const out = scored.slice(0,maxItems).map(x=>entryHTML(x.e)).join('')
    || '<p class="muted">No related publications found — add keywords to your .bib.</p>';
  host.innerHTML = out;
}
