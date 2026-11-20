(function () {
'use strict';
var C = window.CONFIG;
var DB = null;
var ICON = {
  fundacao: 'M3 20h18M4 20v-6h7v6M13 20v-6h7v6M8 14V8h8v6', estrutura: 'M5 21V5M12 21V5M19 21V5M3 8h18M3 15h18',
  alvenaria: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6', telhado: 'M2 12l10-8 10 8M5 11v9h14v-9',
  eletrica: 'M13 2L4 14h7l-1 8 9-12h-7z', acabamento: 'M5 4h12v5H5zM17 6.5h2v5H11v3M10 14.5h2v6h-2z',
  material: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8', mao: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.5-7 8-7s8 3 8 7',
  equip: 'M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  comida: 'M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3c-2 2-2 6 0 8v10',
  cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', ok: 'M5 12.5l4.5 4.5L19 7',
  warn: 'M12 3l10 18H2zM12 10v4M12 17.5v.5', back: 'M15 5l-7 7 7 7', up: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  del: 'M9 5h11v14H9l-6-7zM12 9l5 6M17 9l-5 6', clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z'
};
var S = { tela: 'home', etapa: null, pct: null, foto: null, tipo: null, serv: null, dig: '', qtd: 0, fotoC: null, pend: 0, hist: [], nome: '', msg: '' };
var alvo = null, syncing = false;

function svg(n, sz, sw, col) { return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="' + (col || 'currentColor') + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="' + ICON[n] + '"/></svg>'; }
function brl(c) { return 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function nomeDe(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i][0] === id) return lista[i][1]; return id; }
function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ---------- armazenamento local (fila offline) ---------- */
function openDB() {
  return new Promise(function (res) {
    if (!window.indexedDB) return res();
    var r = indexedDB.open('obra', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('reg', { keyPath: 'id' }); };
    r.onsuccess = function () { DB = r.result; res(); };
    r.onerror = function () { res(); };
  });
}
function store(mode) { return DB.transaction('reg', mode).objectStore('reg'); }
function put(o) { return new Promise(function (res, rej) { var q = store('readwrite').put(o); q.onsuccess = function () { res(); }; q.onerror = function () { rej(q.error); }; }); }
function all() { return new Promise(function (res) { if (!DB) return res([]); var q = store('readonly').getAll(); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res([]); }; }); }
function remove(id) { return new Promise(function (res) { var q = store('readwrite').delete(id); q.onsuccess = function () { res(); }; q.onerror = function () { res(); }; }); }

/* ---------- envio ---------- */
function postar(r) {
  var ctl = new AbortController();
  var t = setTimeout(function () { ctl.abort(); }, 60000);
  var corpo = Object.assign({ token: C.TOKEN }, r);
  return fetch(C.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo), signal: ctl.signal })
    .then(function (x) { clearTimeout(t); return x.json(); })
    .catch(function (e) { clearTimeout(t); throw e; });
}
function sync() {
  if (syncing || !C.ENDPOINT || !DB || navigator.onLine === false) return Promise.resolve();
  syncing = true;
  return all().then(function (rs) {
    var fila = rs.filter(function (r) { return !r.sent; }).sort(function (a, b) { return a.ts - b.ts; });
    var p = Promise.resolve();
    var parou = false;
    fila.forEach(function (r) {
      p = p.then(function () {
        if (parou) return;
        return postar(r).then(function (j) {
          if (j && j.ok) { r.sent = true; r.sentAt = Date.now(); delete r.foto; return put(r); }
          parou = true;
        }).catch(function () { parou = true; });
      });
    });
    return p;
  }).then(function () {
    return all().then(function (rs) {
      var sete = Date.now() - 7 * 86400000;
      return Promise.all(rs.filter(function (r) { return r.sent && r.sentAt < sete; }).map(function (r) { return remove(r.id); }));
    });
  }).then(function () { syncing = false; return refresh(); }, function () { syncing = false; });
}
function refresh() {
  return all().then(function (rs) {
    S.pend = rs.filter(function (r) { return !r.sent; }).length;
    S.hist = rs.sort(function (a, b) { return b.ts - a.ts; }).slice(0, 5);
    if (S.tela === 'home') render();
  });
}

/* ---------- foto ---------- */
function comprimir(file) {
  return new Promise(function (res, rej) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var k = Math.min(1, 1280 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

/* ---------- ações ---------- */
var A = {
  go: function (t) { S.tela = t; S.msg = ''; render(); window.scrollTo(0, 0); },
  novo: function (t) { S.etapa = S.pct = S.foto = S.tipo = S.serv = S.fotoC = null; S.dig = ''; S.qtd = 0; A.go(t); },
  set: function (k, v) { S[k] = v; render(); },
  tirar: function (k) { alvo = k; document.getElementById('cam').click(); },
  key: function (n) {
    if (n === 'c') S.dig = ''; else if (n === 'b') S.dig = S.dig.slice(0, -1);
    else if (S.dig.length < 8 && !(n === '0' && S.dig === '')) S.dig += n;
    render();
  },
  qtd: function (d) { S.qtd = Math.max(0, Math.min(999, S.qtd + d)); render(); },
  nome: function () { var v = (document.getElementById('nm').value || '').trim(); if (v.length < 2) return; S.nome = v; lsSet('nome', v); A.go('home'); },
  trocar: function () { S.nome = ''; render(); },
  agora: function () { S.msg = navigator.onLine ? '' : 'Sem sinal agora. Vai enviar sozinho quando voltar.'; render(); sync(); },
  enviar: function (tipo) {
    var base = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ts: Date.now(), obra: C.OBRA, quem: S.nome, tipo: tipo, sent: false };
    var r;
    if (tipo === 'avanco') r = Object.assign(base, { servico: nomeDe(C.ETAPAS, S.etapa), percentual: S.pct, foto: S.foto });
    else r = Object.assign(base, { tipoGasto: nomeDe(C.TIPOS, S.tipo), servico: nomeDe(C.ETAPAS, S.serv), valor: parseInt(S.dig || '0', 10), quantidade: S.tipo === 'material' ? S.qtd : '', foto: S.fotoC });
    if (!DB) { S.msg = 'Este celular não deixa guardar registros. Use o Chrome.'; return render(); }
    put(r).then(function () { A.go('ok'); refresh(); sync(); }, function () { S.msg = 'Não deu para guardar. Tente de novo.'; render(); });
  }
};
window.A = A;

/* ---------- telas ---------- */
function gate(falta, tipo) {
  if (falta.length) return '<div class="gate"><div class="falta">' + svg('warn', 30, 2.2, 'var(--warn)') + '<span>Falta: ' + falta.join(', ') + '</span></div></div>';
  return '<div class="gate"><button class="send" onclick="A.enviar(\'' + tipo + '\')">' + svg('ok', 34, 2.8) + '<span>Enviar</span></button></div>';
}
function back() { return '<button class="back" onclick="A.go(\'home\')">' + svg('back', 28, 2.4) + '<span>Voltar</span></button>'; }
function fotoBtn(k, vazio, cheio, h) {
  var f = S[k];
  return '<button class="tile" style="width:100%;height:' + h + 'px;justify-content:flex-start;padding:0 12px;font-size:21px;' + (f ? 'background:var(--okbg);border-color:var(--ok)' : '') + '" onclick="A.tirar(\'' + k + '\')">' +
    (f ? '<img class="thumb" alt="" src="' + f + '">' : svg('cam', 32, 1.8)) + '<span style="flex-grow:1;text-align:left">' + (f ? cheio : vazio) + '</span>' + (f ? svg('ok', 28, 3, 'var(--ok)') : '') + '</button>';
}

var V = {
  nome: function () {
    return '<h1 style="margin-top:24px">Qual é o seu nome?</h1><input id="nm" class="txt" type="text" autocomplete="given-name" placeholder="Seu nome">' +
      '<div class="gate"><button class="send" onclick="A.nome()">' + svg('ok', 34, 2.8) + '<span>Entrar</span></button></div>';
  },
  home: function () {
    var tudo = S.pend === 0;
    var pill = tudo ? '<span class="pill" style="background:var(--okbg);color:var(--ok)">' + svg('ok', 18, 3) + 'Tudo enviado</span>'
      : '<button class="pill" style="border:0;background:var(--y)" onclick="A.agora()">' + svg('clock', 18, 2.4) + S.pend + ' para enviar</button>';
    var demo = C.ENDPOINT ? '' : '<div class="note" style="background:#FFF4C2">' + svg('warn', 26, 2, 'var(--fg)') + '<span>Modo demonstração: os registros ficam só neste celular.</span></div>';
    var h = S.hist.map(function (r) {
      var txt = r.tipo === 'avanco' ? r.servico + ' ' + r.percentual + '%' : r.tipoGasto + ' ' + brl(r.valor);
      return '<div class="hrow">' + (r.sent ? svg('ok', 22, 3, 'var(--ok)') : svg('clock', 22, 2.4, 'var(--mute)')) + '<span style="flex:1;min-width:0">' + txt + '</span><span style="color:var(--mute);font-weight:500">' + new Date(r.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</span></div>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-size:18px;font-weight:700;color:var(--mute)">' + C.OBRA + '</div>' + pill + '</div>' +
      '<h1 style="font-size:42px">Bom dia, ' + S.nome + '</h1>' + (S.msg ? '<div class="note">' + S.msg + '</div>' : '') + demo +
      '<button class="big" style="background:var(--y);height:112px;font-size:32px" onclick="A.novo(\'avanco\')">O que foi feito hoje</button>' +
      '<button class="big" style="background:var(--fg);color:#fff;height:112px;font-size:32px" onclick="A.novo(\'custo\')">Gastei ou comprei</button>' +
      '<div class="note">' + svg('up', 26, 2) + '<span>Sem sinal? O registro fica guardado no celular e segue sozinho quando o sinal voltar.</span></div>' +
      (h ? '<div class="hist"><b style="font-size:18px">Últimos registros</b>' + h + '</div>' : '') +
      '<button onclick="A.trocar()" style="margin-top:auto;border:0;background:none;text-decoration:underline;font-size:16px;font-weight:600;color:var(--mute);padding:12px">Não sou ' + S.nome + '</button>';
  },
  avanco: function () {
    var f = []; if (!S.etapa) f.push('serviço'); if (!S.pct) f.push('quanto'); if (!S.foto) f.push('foto');
    var t = C.ETAPAS.map(function (e) { var on = S.etapa === e[0]; return '<button class="tile' + (on ? ' on' : '') + '" style="height:92px;flex-direction:column;font-size:17px;padding:6px" onclick="A.set(\'etapa\',\'' + e[0] + '\')">' + svg(e[0], 36, 1.8) + '<span>' + e[1] + '</span></button>'; }).join('');
    var p = [25, 50, 75, 100].map(function (n) { var on = S.pct === n; return '<button class="tile' + (on ? ' on' : '') + '" style="height:84px;flex-direction:column;font-size:24px;font-weight:800" onclick="A.set(\'pct\',' + n + ')"><span style="display:flex;align-items:flex-end;width:36px;height:26px;border:2px solid var(--fg);border-radius:4px;background:#fff;overflow:hidden"><span style="display:block;width:100%;height:' + n + '%;background:var(--fg)"></span></span>' + n + '%</button>'; }).join('');
    return back() + '<h1>O que foi feito hoje?</h1>' +
      '<div><div class="step"><b>1</b>Qual serviço?</div><div class="grid" style="grid-template-columns:repeat(3,1fr)">' + t + '</div></div>' +
      '<div><div class="step"><b>2</b>Quanto já está pronto?</div><div class="grid" style="grid-template-columns:repeat(4,1fr)">' + p + '</div></div>' +
      '<div><div class="step"><b>3</b>Foto</div>' + fotoBtn('foto', 'Tirar foto do serviço', 'Foto tirada', 72) + '</div>' + (S.msg ? '<div class="note">' + S.msg + '</div>' : '') + gate(f, 'avanco');
  },
  custo: function () {
    var c = parseInt(S.dig || '0', 10);
    var f = []; if (!S.tipo) f.push('em quê'); if (!S.serv) f.push('serviço'); if (!(c > 0)) f.push('valor');
    if (S.tipo === 'material' && S.qtd < 1) f.push('quantidade'); if (!S.fotoC) f.push('foto da nota');
    var t = C.TIPOS.map(function (e) { var on = S.tipo === e[0]; return '<button class="tile' + (on ? ' on' : '') + '" style="height:56px;justify-content:flex-start;padding:0 10px;font-size:19px" onclick="A.set(\'tipo\',\'' + e[0] + '\')">' + svg(e[0], 28, 1.8) + '<span>' + e[1] + '</span></button>'; }).join('');
    var sv = C.ETAPAS.map(function (e) { var on = S.serv === e[0]; return '<button class="tile' + (on ? ' on' : '') + '" style="height:56px;font-size:17px;padding:0 4px" onclick="A.set(\'serv\',\'' + e[0] + '\')">' + e[1] + '</button>'; }).join('');
    var ks = ''; ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (n) { ks += '<button class="key" onclick="A.key(\'' + n + '\')">' + n + '</button>'; });
    ks += '<button class="key" style="background:#fff;font-size:18px" onclick="A.key(\'c\')">Limpar</button><button class="key" onclick="A.key(\'0\')">0</button><button class="key" aria-label="Apagar" onclick="A.key(\'b\')">' + svg('del', 28, 2) + '</button>';
    var qh = S.tipo === 'material' ? '<div style="margin-top:12px"><div style="font-size:19px;font-weight:700;margin-bottom:6px">Quantas unidades? <span style="font-weight:500;color:var(--mute)">(sacos, barras, peças)</span></div><div style="display:flex;align-items:center;gap:10px"><button class="key" style="width:72px;font-size:34px" aria-label="Menos" onclick="A.qtd(-1)">−</button><div class="disp" style="flex:1;justify-content:center;height:56px">' + S.qtd + '</div><button class="key" style="width:72px;font-size:34px" aria-label="Mais" onclick="A.qtd(1)">+</button><button class="key" style="width:72px;font-size:20px" aria-label="Mais dez" onclick="A.qtd(10)">+10</button></div></div>' : '';
    return back() + '<h1>Gastei ou comprei</h1>' +
      '<div><div class="step"><b>1</b>Em quê?</div><div class="grid" style="grid-template-columns:repeat(2,1fr)">' + t + '</div></div>' +
      '<div><div class="step"><b>2</b>Para qual serviço?</div><div class="grid" style="grid-template-columns:repeat(3,1fr)">' + sv + '</div></div>' +
      '<div><div class="step"><b>3</b>Quanto?</div><div class="disp" style="color:' + (c > 0 ? 'var(--fg)' : 'var(--mute)') + '">' + brl(c) + '</div><div class="keys" style="margin-top:8px">' + ks + '</div>' + qh + '</div>' +
      '<div><div class="step"><b>4</b>Foto da nota</div>' + fotoBtn('fotoC', 'Tirar foto da nota', 'Nota fotografada', 60) + '</div>' + (S.msg ? '<div class="note">' + S.msg + '</div>' : '') + gate(f, 'custo');
  },
  ok: function () {
    var msg = !C.ENDPOINT ? 'Guardado neste celular (modo demonstração).' : (navigator.onLine === false ? 'Guardado. Vai para o escritório quando o sinal voltar.' : 'O escritório já recebe o que você registrou.');
    return '<div style="flex-grow:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;min-height:50vh"><div style="width:168px;height:168px;border-radius:50%;background:var(--ok);display:flex;align-items:center;justify-content:center">' + svg('ok', 100, 2.6, '#fff') + '</div><h1 style="font-size:54px">Registrado!</h1><p style="margin:0;font-size:23px;font-weight:500;line-height:1.2;color:var(--mute);max-width:300px">' + msg + '</p></div>' +
      '<button class="big" style="background:var(--y)" onclick="A.go(\'home\')">Voltar ao início</button>';
  }
};

function render() {
  var t = S.nome ? S.tela : 'nome';
  document.getElementById('app').innerHTML = V[t]();
  var inp = document.getElementById('nm'); if (inp) inp.focus();
}

/* ---------- início ---------- */
document.getElementById('cam').addEventListener('change', function (ev) {
  var file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file || !alvo) return;
  var k = alvo;
  comprimir(file).then(function (d) { S[k] = d; S.msg = ''; render(); }, function () { S.msg = 'Não deu para ler a foto. Tente de novo.'; render(); });
});
window.addEventListener('online', function () { sync(); });
setInterval(function () { sync(); }, 30000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

S.nome = lsGet('nome');
openDB().then(function () { render(); return refresh(); }).then(function () { sync(); });
})();
