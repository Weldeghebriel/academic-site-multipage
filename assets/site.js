/* Mobile nav toggle + active-link highlighting, shared across all pages. */

/* Renders the first `maxItems` entries from news.html's timeline into a
   teaser element elsewhere (e.g. the homepage), so News stays in one place. */
function firstSentence(text){
  const trimmed = text.trim();
  const limit = 190;
  const idx = trimmed.indexOf('. ');
  if(idx > -1 && idx < limit) return trimmed.slice(0, idx + 1);
  if(trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : limit).trim() + '…';
}
async function renderNewsTeaser(targetId, maxItems){
  maxItems = maxItems || 3;
  const host = document.getElementById(targetId);
  if(!host) return;
  try{
    const res = await fetch('news.html');
    if(!res.ok) throw new Error('Could not load news.html');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const items = [...doc.querySelectorAll('.timeline .tl-item')].slice(0, maxItems);
    host.innerHTML = items.map(item=>{
      const when = item.querySelector('.when').textContent;
      const title = item.querySelector('h3').textContent;
      const p = item.querySelector('p');
      const text = p ? firstSentence(p.textContent) : '';
      return `<div><span class="pill">${when}</span> <strong>${title}</strong>${text ? ': ' + text : ''}</div>`;
    }).join('') || '<p class="muted">No news yet.</p>';
  }catch(err){
    host.innerHTML = '<p class="muted">Could not load news.</p>';
    console.error(err);
  }
}

(function(){
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      toggle.setAttribute('aria-expanded', String(!open));
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        nav.setAttribute('data-open','false');
        toggle.setAttribute('aria-expanded','false');
      });
    });
  }
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(function(a){
    var href = a.getAttribute('href');
    if(href === here || (here === '' && href === 'index.html')){
      a.classList.add('active');
    }
  });
  var y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();
})();
