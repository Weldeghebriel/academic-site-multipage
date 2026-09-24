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
   zoomable. Click the image, or scroll/pinch over it, to zoom in/out toward
   the cursor; drag to pan once zoomed. Click the backdrop, the close
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

  // scale === 1 means "fit to screen" (the browser-computed max-width/
  // max-height/object-fit size). fitWidth/fitHeight are captured fresh
  // each time an image loads, since every figure has a different size.
  var scale = 1, fitWidth = 0, fitHeight = 0, maxScale = 4;

  function setScale(newScale, clientX, clientY){
    newScale = Math.min(maxScale, Math.max(1, newScale));
    if(newScale === scale) return;

    // Back to fit scale: just re-center, nothing to keep under the cursor.
    if(newScale === 1){
      resetZoom();
      return;
    }

    var overlayRect = overlay.getBoundingClientRect();
    var beforeRect = img.getBoundingClientRect();
    // Fraction of the image under the cursor, so that exact point stays
    // under the cursor after resizing (standard "zoom toward pointer").
    var fx = beforeRect.width ? (clientX - beforeRect.left) / beforeRect.width : 0.5;
    var fy = beforeRect.height ? (clientY - beforeRect.top) / beforeRect.height : 0.5;

    scale = newScale;
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = Math.round(fitWidth * scale) + 'px';
    overlay.classList.add('zoomed');

    var afterRect = img.getBoundingClientRect();
    var imgLeftInScroll = overlay.scrollLeft + (afterRect.left - overlayRect.left);
    var imgTopInScroll = overlay.scrollTop + (afterRect.top - overlayRect.top);
    overlay.scrollLeft = imgLeftInScroll + fx * afterRect.width - (clientX - overlayRect.left);
    overlay.scrollTop = imgTopInScroll + fy * afterRect.height - (clientY - overlayRect.top);
  }

  function resetZoom(){
    scale = 1;
    img.style.width = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    overlay.classList.remove('zoomed');
    overlay.scrollTop = 0;
    overlay.scrollLeft = 0;
  }

  function open(src, alt){
    resetZoom();
    img.src = src;
    img.alt = alt || '';
    caption.textContent = alt || '';
    caption.style.display = alt ? '' : 'none';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close(){
    overlay.classList.remove('open');
    resetZoom();
    img.src = '';
    document.body.style.overflow = '';
  }

  img.addEventListener('load', function(){
    var r = img.getBoundingClientRect();
    fitWidth = r.width;
    fitHeight = r.height;
    maxScale = Math.min(6, Math.max(2, (img.naturalWidth || fitWidth) / (fitWidth || 1)));
  });

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
    if(scale > 1) overlay.classList.add('dragging');
    e.preventDefault();
  });

  img.addEventListener('pointermove', function(e){
    if(!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    if(!moved && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
    if(moved && scale > 1){
      overlay.scrollLeft -= dx;
      overlay.scrollTop -= dy;
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  img.addEventListener('pointerup', function(e){
    dragging = false;
    overlay.classList.remove('dragging');
    if(!moved) setScale(scale > 1 ? 1 : Math.min(2.5, maxScale), e.clientX, e.clientY);
  });

  // Mouse wheel / trackpad scroll zooms toward the cursor.
  overlay.addEventListener('wheel', function(e){
    if(!overlay.classList.contains('open')) return;
    e.preventDefault();
    var factor = Math.pow(1.0015, -e.deltaY);
    setScale(scale * factor, e.clientX, e.clientY);
  }, {passive: false});

  overlay.addEventListener('click', function(e){
    if(e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
})();
