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

/* Lightbox: click any figure/gallery/portrait image to view it floating and
   zoomable. Click the image to zoom in/out; click the backdrop, the close
   button, or Escape to dismiss. */
(function(){
  var targets = document.querySelectorAll('.illus img, .gallery img, .portrait-frame img');
  if(!targets.length) return;

  var overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Enlarged image');

  var img = document.createElement('img');
  overlay.appendChild(img);

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  overlay.appendChild(closeBtn);

  var caption = document.createElement('div');
  caption.className = 'lightbox-caption';
  overlay.appendChild(caption);

  document.body.appendChild(overlay);

  function exitZoom(){
    img.style.width = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    overlay.classList.remove('zoomed');
    overlay.scrollTop = 0;
    overlay.scrollLeft = 0;
  }

  // Zoom in, keeping the point under (clientX, clientY) in view instead of
  // always jumping to the top-left corner of the enlarged image.
  function enterZoom(clientX, clientY){
    var beforeRect = img.getBoundingClientRect();
    var fx = beforeRect.width ? (clientX - beforeRect.left) / beforeRect.width : 0.5;
    var fy = beforeRect.height ? (clientY - beforeRect.top) / beforeRect.height : 0.5;

    var targetWidth = Math.max(img.naturalWidth || 0, Math.round(window.innerWidth * 1.6));
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = targetWidth + 'px';
    overlay.classList.add('zoomed');

    var overlayRect = overlay.getBoundingClientRect();
    var afterRect = img.getBoundingClientRect();
    var imgLeftInScroll = overlay.scrollLeft + (afterRect.left - overlayRect.left);
    var imgTopInScroll = overlay.scrollTop + (afterRect.top - overlayRect.top);
    overlay.scrollLeft = imgLeftInScroll + fx * afterRect.width - overlay.clientWidth / 2;
    overlay.scrollTop = imgTopInScroll + fy * afterRect.height - overlay.clientHeight / 2;
  }

  function open(src, alt){
    exitZoom();
    img.src = src;
    img.alt = alt || '';
    caption.textContent = alt || '';
    caption.style.display = alt ? '' : 'none';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close(){
    overlay.classList.remove('open');
    exitZoom();
    img.src = '';
    document.body.style.overflow = '';
  }

  targets.forEach(function(el){
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', function(){
      open(el.currentSrc || el.src, el.alt);
    });
  });

  // Click-vs-drag: a plain click toggles zoom; a drag (beyond a small
  // threshold) pans the zoomed image by scrolling the overlay.
  var dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;

  img.addEventListener('pointerdown', function(e){
    if(e.button !== undefined && e.button !== 0) return;
    dragging = true;
    moved = false;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    img.setPointerCapture(e.pointerId);
    if(overlay.classList.contains('zoomed')) overlay.classList.add('dragging');
    e.preventDefault();
  });

  img.addEventListener('pointermove', function(e){
    if(!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    if(!moved && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
    if(moved && overlay.classList.contains('zoomed')){
      overlay.scrollLeft -= dx;
      overlay.scrollTop -= dy;
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  img.addEventListener('pointerup', function(e){
    dragging = false;
    overlay.classList.remove('dragging');
    if(!moved){
      if(overlay.classList.contains('zoomed')) exitZoom();
      else enterZoom(e.clientX, e.clientY);
    }
  });

  overlay.addEventListener('click', function(e){
    if(e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
})();
