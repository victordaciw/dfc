/* DFC · a página de cada luta (abre por cima do site, com #luta-N no endereço) e o ajuste dos títulos de largura fixa.
   Os dados vêm de dados/lutas.js (gerado por ferramentas/dados.py). O conteúdo de cada luta paga (fotos, pasta, vídeos)
   está num cofre cifrado: só abre com o código de 8 dígitos que o Victor manda a quem pagou (ferramentas/cifrar.mjs). */
(function () {
  var D = window.DFC || { lutas: [] };
  var porN = {};
  D.lutas.forEach(function (l) { porN[l.n] = l; });

  var caixa = document.getElementById('dfc-luta');
  var lb = document.getElementById('dfc-lb');
  if (!caixa) return;
  var fundo = caixa.querySelector('.dfc-luta-fundo'), cap = caixa.querySelector('.dfc-luta-cap'),
      titulo = caixa.querySelector('.dfc-luta-h'), cint = caixa.querySelector('.dfc-luta-cint'),
      slots = caixa.querySelector('.dfc-slots'), painel = caixa.querySelector('.dfc-painel'),
      fechar = caixa.querySelector('.dfc-fechar'), rola = caixa.querySelector('.dfc-luta-rola');
  var SETA = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
  var BAIXA = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var mini = function (id, w) { return 'https://lh3.googleusercontent.com/d/' + id + '=w' + w; };
  var baixar = function (id) { return 'https://drive.usercontent.google.com/download?id=' + id + '&export=download'; };
  var pasta = function (id) { return 'https://drive.google.com/drive/folders/' + id; };
  var atual = null, voltarPara = null, fotos = [], aberta = -1;

  /* comprar: WhatsApp com a luta já escrita, se o número estiver nos dados; senão, o bloco de preços */
  function linkCompra(l) {
    var w = (D.contato && D.contato.whatsapp || '').replace(/\D/g, '');
    if (!w) return '#precos';
    var txt = l ? 'Oi! Paguei o Pix da Luta ' + l.n + ' do DFC (' + l.azul + ' x ' + l.vermelho + '). Segue o comprovante.' : 'Oi! Quero liberar a minha luta do DFC.';
    return 'https://wa.me/' + w + '?text=' + encodeURIComponent(txt);
  }
  [].forEach.call(document.querySelectorAll('[data-dfc-comprar]'), function (a) {
    var w = linkCompra(null);
    if (w !== '#precos') { a.href = w; a.target = '_blank'; a.rel = 'noopener'; }
  });
  /* chave Pix com botão de copiar (no bloco de preços e na luta trancada) */
  function pixHtml() {
    var k = D.contato && D.contato.pix;
    if (!k) return '';
    return '<div class="dfc-pix"><span class="dfc-pix-t">Chave Pix' + (D.contato.pix_tipo ? ' (' + esc(D.contato.pix_tipo) + ')' : '') + '</span>' +
      '<code class="dfc-pix-k">' + esc(k) + '</code>' +
      '<button type="button" class="dfc-btn dfc-pix-copiar" data-pix="' + esc(k) + '">Copiar chave Pix</button>' +
      '<span class="dfc-pix-ok" role="status" aria-live="polite"></span></div>';
  }
  [].forEach.call(document.querySelectorAll('[data-dfc-pix]'), function (el) { el.outerHTML = pixHtml(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.dfc-pix-copiar');
    if (!b) return;
    var k = b.getAttribute('data-pix'), ok = b.parentNode.querySelector('.dfc-pix-ok');
    var feito = function () { if (ok) { ok.textContent = 'Chave copiada. Cole no app do seu banco.'; setTimeout(function () { ok.textContent = ''; }, 4000); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k).then(feito, function () { reserva(); });
    else reserva();
    function reserva() {
      var c = b.parentNode.querySelector('.dfc-pix-k'), r = document.createRange();
      r.selectNodeContents(c); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); feito(); } catch (er) { if (ok) ok.textContent = 'Toque e segure a chave para copiar.'; }
    }
  });
  /* o código fica guardado neste navegador: quem já digitou não digita de novo */
  var guardado = function (n) { try { return localStorage.getItem('dfc-codigo-' + n) || ''; } catch (e) { return ''; } };
  var guardar = function (n, c) { try { localStorage.setItem('dfc-codigo-' + n, c); } catch (e) {} };
  /* capa de luta já aberta neste navegador ganha o selo */
  [].forEach.call(document.querySelectorAll('.dfc-cover[data-luta]'), function (a) {
    var l = porN[a.getAttribute('data-luta')];
    if (l && l.cofre && guardado(l.n)) a.classList.add('dfc-livre');
  });

  /* o cofre: PBKDF2 do código com o sal da luta abre uma das chaves embrulhadas, que abre o conteúdo */
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  function abrirCofre(l, codigo) {
    var sub = window.crypto && window.crypto.subtle, c = l.cofre;
    if (!sub || !c) return Promise.resolve(false);
    return sub.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return sub.deriveKey({ name: 'PBKDF2', salt: b64(c.s), iterations: c.it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    }).then(function (kek) {
      return c.chaves.reduce(function (p, ch) {
        return p.then(function (achou) {
          return achou || sub.decrypt({ name: 'AES-GCM', iv: b64(ch.iv) }, kek, b64(ch.k)).catch(function () { return null; });
        });
      }, Promise.resolve(null));
    }).then(function (bruta) {
      if (!bruta) return false;
      return sub.importKey('raw', bruta, 'AES-GCM', false, ['decrypt']).then(function (k) {
        return sub.decrypt({ name: 'AES-GCM', iv: b64(c.iv) }, k, b64(c.ct));
      }).then(function (claro) {
        var conteudo = JSON.parse(new TextDecoder().decode(claro));
        l.pasta = conteudo.pasta; l.pasta_completa = conteudo.pasta_completa; l.fotos = conteudo.fotos; l.completa = conteudo.completa; l.highlight = conteudo.highlight;
        l.liberada = true;
        return true;
      });
    }).catch(function () { return false; });
  }

  var SLOTS = [
    { k: 'fotos', t: 'Fotos', s: function (l) { return l.total_fotos + ' fotos para ver e baixar'; } },
    { k: 'completa', t: 'Luta completa', s: function () { return 'Da entrada ao resultado, para baixar'; } },
    { k: 'highlight', t: 'Highlight', s: function () { return 'Os melhores momentos, para baixar'; } },
  ];

  function abrir(n, foco) {
    var l = porN[n];
    if (!l) return;
    if (!atual) voltarPara = document.activeElement;
    atual = l;
    fundo.style.backgroundImage = 'url(' + l.capa + ')';
    cap.textContent = 'Luta ' + String(l.n).padStart(2, '0') + ' · ' + l.modalidade + ' · ' + l.rounds;
    titulo.innerHTML = '<span class="a">' + esc(l.azul) + '</span><span class="vs">vs</span><span class="b">' + esc(l.vermelho) + '</span>';
    cint.textContent = l.cinturao ? 'Disputa do ' + l.cinturao : '';
    slots.innerHTML = SLOTS.map(function (s, i) {
      return '<button type="button" role="tab" class="dfc-slot' + (l.liberada ? '' : ' trancado') + '" data-k="' + s.k + '" aria-selected="false">' +
        '<span class="num">0' + (i + 1) + '</span><span class="t">' + s.t + '</span><span class="s">' + esc(s.s(l)) + '</span></button>';
    }).join('');
    caixa.hidden = false;
    document.documentElement.classList.add('dfc-trava');
    rola.scrollTop = 0;
    var cod = !l.liberada && l.cofre && guardado(l.n);
    if (cod) {          // código já digitado neste navegador: abre sozinho
      painel.innerHTML = '<div class="dfc-aviso"><p>Abrindo a sua luta…</p></div>';
      abrirCofre(l, cod).then(function () { if (atual === l) { marcarSlots(l); mostrar(foco || 'fotos'); } });
    } else {
      mostrar(foco || 'fotos');
    }
    fechar.focus({ preventScroll: true });
  }
  function marcarSlots(l) {
    [].forEach.call(slots.children, function (b) { b.classList.toggle('trancado', !l.liberada); });
  }

  function fecharLuta() {
    if (!atual) return;
    atual = null; fotos = [];
    caixa.hidden = true;
    painel.innerHTML = '';
    document.documentElement.classList.remove('dfc-trava');
    if (/^#luta-\d+/.test(location.hash)) history.replaceState(null, '', '#lutas');
    if (voltarPara && voltarPara.focus) voltarPara.focus({ preventScroll: true });
  }

  function mostrar(k) {
    var l = atual;
    [].forEach.call(slots.children, function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-k') === k)); });
    if (!l.liberada) { painel.innerHTML = trancada(l); return; }
    if (k === 'fotos') return galeria(l);
    var v = l[k];
    if (!v) {
      painel.innerHTML = '<div class="dfc-aviso"><h3>Em edição</h3><p>' + (k === 'completa' ? 'O vídeo da luta inteira' : 'O highlight') +
        ' ainda está sendo montado. Assim que ficar pronto, aparece aqui, nesta mesma página.</p></div>';
      return;
    }
    var titulo = (k === 'completa' ? 'Luta completa' : 'Highlight') + (v.duracao ? ' · ' + esc(v.duracao) : '');
    if (v.drive) {     // vídeo no Google Drive do Victor: toca no player do Google e baixa direto
      painel.innerHTML = '<div class="dfc-barra"><p>' + titulo + '</p>' +
        '<a class="dfc-btn dfc-btn--cheio" href="https://drive.usercontent.google.com/download?id=' + esc(v.drive) + '&export=download&confirm=t" target="_blank" rel="noopener">Baixar o vídeo' + BAIXA + '</a></div>' +
        '<div class="dfc-video dfc-video--drive"><iframe src="https://drive.google.com/file/d/' + esc(v.drive) + '/preview" allow="autoplay; fullscreen" allowfullscreen title="' + titulo + '"></iframe></div>';
      return;
    }
    painel.innerHTML = '<div class="dfc-barra"><p>' + titulo + '</p>' +
      '<a class="dfc-btn dfc-btn--cheio" href="' + esc(v.baixar || v.ver) + '" download>Baixar o vídeo' + BAIXA + '</a></div>' +
      '<div class="dfc-video"><video controls playsinline preload="metadata" poster="' + esc(l.capa) + '" src="' + esc(v.ver) + '"></video></div>';
  }

  function trancada(l) {
    var compra = '<p class="preco">R$ ' + (D.preco || 140) + '<small>no Pix</small></p>' + pixHtml() +
      '<a class="dfc-btn' + (l.cofre ? '' : ' dfc-btn--cheio') + '" href="' + esc(linkCompra(l)) + '"' + (linkCompra(l) === '#precos' ? ' data-fecha' : ' target="_blank" rel="noopener"') + '>' +
      (D.contato && D.contato.whatsapp ? 'Mandar o comprovante no WhatsApp' : 'Quero liberar esta luta') + SETA + '</a>';
    if (!l.cofre) {
      return '<div class="dfc-aviso"><h3>Esta luta ainda não foi liberada</h3>' +
        '<p>As ' + l.total_fotos + ' fotos, a luta completa e o highlight ficam aqui assim que o pagamento for confirmado.</p>' + compra + '</div>';
    }
    return '<div class="dfc-aviso"><h3>Digite o seu código</h3>' +
      '<p>Quem já pagou recebe no privado um código de 8 números. Ele libera as ' + l.total_fotos + ' fotos, a luta completa e o highlight.</p>' +
      '<form class="dfc-codigo" novalidate><label class="dfc-sr" for="dfc-cod">Código de acesso</label>' +
      '<input id="dfc-cod" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="0000 0000" spellcheck="false">' +
      '<button type="submit" class="dfc-btn dfc-btn--cheio">Liberar' + SETA + '</button></form>' +
      '<p class="dfc-erro" role="alert" aria-live="polite"></p>' +
      '<div class="dfc-ou"><span>ainda não tem o código?</span></div>' + compra + '</div>';
  }

  /* digitou o código: confere, guarda e abre */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('.dfc-codigo');
    if (!f || !atual) return;
    e.preventDefault();
    var l = atual, campo = f.querySelector('input'), botao = f.querySelector('button'), erro = painel.querySelector('.dfc-erro');
    var cod = campo.value.replace(/\D/g, '');
    if (cod.length !== 8) { erro.textContent = 'O código tem 8 números.'; campo.focus(); return; }
    botao.disabled = true; erro.textContent = 'Conferindo…';
    abrirCofre(l, cod).then(function (ok) {
      if (atual !== l) return;
      botao.disabled = false;
      if (!ok) { erro.textContent = 'Esse código não abre esta luta. Confira os números ou fale com o Victor.'; campo.select(); return; }
      guardar(l.n, cod);
      var capa = document.querySelector('.dfc-cover[data-luta="' + l.n + '"]');
      if (capa) capa.classList.add('dfc-livre');
      marcarSlots(l);
      var sel = slots.querySelector('[aria-selected="true"]');
      mostrar(sel ? sel.getAttribute('data-k') : 'fotos');
    });
  });
  /* o campo aceita só números e separa em 4 + 4 enquanto a pessoa digita */
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'dfc-cod') return;
    var d = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
  });

  /* galeria: as miniaturas entram aos poucos, 90 por vez, conforme a pessoa desce */
  function galeria(l) {
    fotos = l.fotos || [];
    painel.innerHTML = '<div class="dfc-barra"><p>' + fotos.length + ' fotos · toque numa foto para abrir e baixar</p>' +
      (l.pasta ? '<a class="dfc-btn" href="' + pasta(l.pasta) + '" target="_blank" rel="noopener">' + (l.pasta_completa ? 'Pasta da luta no Drive (fotos e vídeo)' : 'Baixar todas no Google Drive') + BAIXA + '</a>' : '') +
      '</div><div class="dfc-grade"></div><div class="dfc-mais"></div>';
    var grade = painel.querySelector('.dfc-grade'), mais = painel.querySelector('.dfc-mais'), feito = 0;
    function lote() {
      var html = '';
      for (var i = feito; i < Math.min(fotos.length, feito + 90); i++) {
        html += '<button type="button" data-i="' + i + '" aria-label="Abrir a foto ' + (i + 1) + '"><img src="' + mini(fotos[i], 480) + '" alt="" loading="lazy" decoding="async"></button>';
      }
      grade.insertAdjacentHTML('beforeend', html);
      feito = Math.min(fotos.length, feito + 90);
      [].forEach.call(grade.querySelectorAll('img:not(.ok)'), function (im) {
        if (im.complete) im.classList.add('ok'); else im.addEventListener('load', function () { im.classList.add('ok'); }, { once: true });
      });
      if (feito >= fotos.length && io) io.disconnect();
    }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (e) { if (e[0].isIntersecting) lote(); }, { root: rola, rootMargin: '800px' }) : null;
    lote();
    if (io && feito < fotos.length) io.observe(mais); else while (feito < fotos.length) lote();
  }

  /* foto aberta: anterior, próxima, baixar; setas do teclado e deslizar no celular */
  function verFoto(i) {
    if (i < 0 || i >= fotos.length) return;
    aberta = i;
    var im = lb.querySelector('img');
    im.src = mini(fotos[i], 480);
    var grande = new Image();
    grande.onload = function () { if (aberta === i) im.src = grande.src; };
    grande.src = mini(fotos[i], 2000);
    lb.querySelector('.dfc-lb-n').textContent = 'Foto ' + (i + 1) + ' de ' + fotos.length;
    lb.querySelector('.dfc-lb-baixar').href = baixar(fotos[i]);
    if (lb.hidden) { lb.hidden = false; lb.querySelector('.dfc-lb-x').focus({ preventScroll: true }); }
  }
  function fecharFoto() {
    if (lb.hidden) return;
    lb.hidden = true;
    var b = painel.querySelector('.dfc-grade button[data-i="' + aberta + '"]');
    aberta = -1;
    if (b) b.focus({ preventScroll: true });
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var capa = e.target.closest('.dfc-cover[data-luta]');
    if (capa) { e.preventDefault(); history.pushState(null, '', '#luta-' + capa.getAttribute('data-luta')); abrir(capa.getAttribute('data-luta')); return; }
    if (!atual) return;
    var s = e.target.closest('.dfc-slot');
    if (s) { mostrar(s.getAttribute('data-k')); return; }
    var f = e.target.closest('.dfc-grade button');
    if (f) { verFoto(Number(f.getAttribute('data-i'))); return; }
    if (e.target.closest('[data-fecha]')) { e.preventDefault(); fecharLuta(); var p = document.getElementById('precos'); if (p) p.scrollIntoView({ behavior: 'smooth' }); }
  });
  fechar.addEventListener('click', fecharLuta);
  lb.querySelector('.dfc-lb-x').addEventListener('click', fecharFoto);
  lb.querySelector('.dfc-lb-ant').addEventListener('click', function () { verFoto(aberta - 1); });
  lb.querySelector('.dfc-lb-prox').addEventListener('click', function () { verFoto(aberta + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) fecharFoto(); });
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) verFoto(aberta + (dx < 0 ? 1 : -1));
  });
  document.addEventListener('keydown', function (e) {
    if (!lb.hidden) {
      if (e.key === 'Escape') fecharFoto();
      else if (e.key === 'ArrowRight') verFoto(aberta + 1);
      else if (e.key === 'ArrowLeft') verFoto(aberta - 1);
      return;
    }
    if (atual && e.key === 'Escape') fecharLuta();
  });

  function pelaUrl() {
    var m = location.hash.match(/^#luta-(\d+)(?:-(fotos|completa|highlight))?$/);
    if (m && porN[m[1]]) abrir(m[1], m[2]);
    else if (atual) fecharLuta();
  }
  window.addEventListener('hashchange', pelaUrl);
  window.addEventListener('popstate', pelaUrl);
  pelaUrl();
})();

/* títulos de largura fixa (.dfc-fit): cada linha ganha o tamanho que a faz ocupar a largura toda, medido na própria fonte.
   É o mesmo resultado do --k que a TMS media à mão, só que calculado para o texto do DFC. */
(function () {
  function medir() {
    [].forEach.call(document.querySelectorAll('.dfc-fit > span'), function (s) {
      var c = document.createElement('span');
      var cs = getComputedStyle(s);
      c.textContent = s.textContent;
      c.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:100px;font-family:' + cs.fontFamily + ';letter-spacing:' + cs.letterSpacing +
        ';text-transform:' + cs.textTransform + ';font-weight:' + cs.fontWeight;
      document.body.appendChild(c);
      var k = c.getBoundingClientRect().width / 100 * 1.01;
      c.remove();
      if (k > 0) { s.style.setProperty('--k', k.toFixed(3)); s.style.fontSize = 'calc(100cqw / ' + k.toFixed(3) + ')'; }
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir); else window.addEventListener('load', medir);
})();
