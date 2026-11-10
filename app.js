/* ==========================================================================
   4social — painel de redes sociais da 4blue
   Front puro (sem framework). Dados vêm do Apps Script (POST text/plain) ou,
   com API_URL vazio, do demo.js. Cálculos e recomendações rodam aqui: são
   regras abertas, sem segredo, e funcionam igual no demo e na produção.
   ========================================================================== */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.API_URL;
  const app = document.getElementById('app');

  // ---------------------------------------------------------------- estado
  const hoje = new Date();
  const S = {
    user: null, token: null, dados: null, aba: 'geral',
    mes: mesDe(hoje), ini: '', fim: '', preset: 'mes', analise: 'objetivo', conta: '', busca: '', carregando: false, erroLogin: ''
  };

  const REDES = {
    instagram: { nome: 'Instagram', metrica: 'Alcance', cor: '#0072CE' },
    tiktok: { nome: 'TikTok', metrica: 'Visualizações', cor: '#F6BF00' },
    youtube: { nome: 'YouTube', metrica: 'Visualizações', cor: '#D93838' },
    linkedin: { nome: 'LinkedIn', metrica: 'Impressões', cor: '#004882' },
    blog: { nome: 'Blog', metrica: 'Visualizações', cor: '#12A150' }
  };
  const ABAS = [
    ['geral', 'Visão geral'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['blog', 'Blog'],
    ['-'], ['producao', 'Produção BC'], ['metas', 'Metas'], ['recomendacoes', 'Recomendações'], ['posts', 'Todos os posts'], ['equipe', 'Equipe']
  ];
  // objetivo do post: cada post é avaliado pela métrica que ele quer mover
  const OBJETIVOS = { curtidas: 'Curtidas', comentarios: 'Comentários', salvos: 'Salvamentos', compartilhamentos: 'Envios', alcance: 'Alcance' };
  const ANALISES = [['objetivo', 'Objetivo de cada post'], ['alcance', 'Alcance / visualizações'], ['curtidas', 'Curtidas'], ['comentarios', 'Comentários'], ['salvos', 'Salvamentos'], ['compartilhamentos', 'Envios']];
  const METRICAS = {
    posts: 'Posts publicados', alcance: 'Alcance', visualizacoes: 'Visualizações', engajamento: 'Taxa de engajamento',
    interacoes: 'Interações', seguidores_ganhos: 'Seguidores ganhos',
    imagens_feitas: 'Imagens feitas', imagens_postadas: 'Imagens postadas',
    videos_feitos: 'Vídeos feitos', videos_postados: 'Vídeos postados'
  };
  const ESCOPOS = { geral: 'Tudo', rede: 'Rede', conta: 'Conta', funcao: 'Função', pessoa: 'Pessoa' };

  // ---------------------------------------------------------------- utilidades
  function pad(n) { return String(n).padStart(2, '0'); }
  function mesDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function mesAnterior(m) { const p = m.split('-').map(Number); return mesDe(new Date(p[0], p[1] - 2, 1)); }
  function nomeMes(m) { const p = m.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
  function nomeMesCurto(m) { const p = m.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); }
  function diasNoMes(m) { const p = m.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
  function ultimosMeses(n, ate) { const r = []; let m = ate || mesDe(hoje); for (let i = 0; i < n; i++) { r.unshift(m); m = mesAnterior(m); } return r; }
  function num(v) { const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function fmt(n) { return Math.round(n).toLocaleString('pt-BR'); }
  function fmtC(n) {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return fmt(n);
  }
  function pct(n, casas) { return (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: casas == null ? 1 : casas }) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function urlSegura(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }
  function mediana(arr) { const a = arr.filter(function (x) { return isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return 0; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function soma(arr, f) { return arr.reduce(function (s, x) { return s + f(x); }, 0); }
  function agrupar(arr, f) { const g = {}; arr.forEach(function (x) { const k = f(x); (g[k] = g[k] || []).push(x); }); return g; }
  function dataBR(iso) { if (!iso) return ''; const p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
  function diaSemana(iso) { const p = iso.slice(0, 10).split('-').map(Number); return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(p[0], p[1] - 1, p[2]).getDay()]; }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.getElementById('toasts').appendChild(t); setTimeout(function () { t.remove(); }, 3500); }
  function guardar(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* navegador sem storage */ } }
  function ler(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  // ---------------------------------------------------------------- API
  async function api(action, corpo) {
    if (DEMO) throw new Error('Modo demonstração: nada é enviado.');
    const r = await fetch(CFG.API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action, token: S.token }, corpo || {}))
    });
    const j = await r.json();
    if (!j.ok) { if (j.sessao) { sair(); } throw new Error(j.erro || 'Erro no servidor.'); }
    return j;
  }

  // ---------------------------------------------------------------- métricas
  const M = {
    resultado: function (p) { return p.rede === 'instagram' ? num(p.alcance) : p.rede === 'linkedin' ? num(p.impressoes) : num(p.visualizacoes); },
    // valor do post na métrica escolhida: alcance em número; curtidas, comentários, salvos e envios em taxa sobre o alcance
    valorAnalise: function (p, k) { const r = M.resultado(p); if (k === 'alcance') return r; return r ? num(p[k]) / r : NaN; },
    interacoes: function (p) { return num(p.curtidas) + num(p.comentarios) + num(p.compartilhamentos) + num(p.salvos); },
    eng: function (p) { const r = M.resultado(p); if (!r) return NaN; return p.rede === 'blog' ? num(p.cliques) / r : M.interacoes(p) / r; },
    postados: function (l) { return l.filter(function (p) { return p.status === 'postado'; }); },
    doMes: function (l, mes) { return l.filter(function (p) { return String(p.data).slice(0, 7) === mes; }); },
    ate: function (l, mes, dia) { return l.filter(function (p) { return String(p.data).slice(0, 7) === mes && num(String(p.data).slice(8, 10)) <= dia; }); },
    ehVideo: function (p) { return p.tipo_peca === 'video'; },
    ehImagem: function (p) { return p.tipo_peca === 'imagem'; },
    resumo: function (l) {
      const pub = M.postados(l); const res = soma(pub, M.resultado); const inter = soma(pub, M.interacoes);
      return { posts: pub.length, resultado: res, interacoes: inter, eng: res ? inter / res : 0,
        salvos: soma(pub, function (p) { return num(p.salvos); }), compart: soma(pub, function (p) { return num(p.compartilhamentos); }),
        seguidores: soma(pub, function (p) { return num(p.seguidores_ganhos); }), visitas: soma(pub, function (p) { return num(p.visitas_perfil); }) };
    },
    valor: function (metrica, l) {
      const pub = M.postados(l);
      switch (metrica) {
        case 'posts': return pub.length;
        case 'alcance': return soma(pub, function (p) { return num(p.alcance); });
        case 'visualizacoes': return soma(pub, function (p) { return num(p.visualizacoes); });
        case 'interacoes': return soma(pub, M.interacoes);
        case 'engajamento': return M.resumo(l).eng;
        case 'seguidores_ganhos': return soma(pub, function (p) { return num(p.seguidores_ganhos); });
        case 'imagens_feitas': return l.filter(M.ehImagem).length;
        case 'imagens_postadas': return pub.filter(M.ehImagem).length;
        case 'videos_feitos': return l.filter(M.ehVideo).length;
        case 'videos_postados': return pub.filter(M.ehVideo).length;
      }
      return 0;
    },
    doEscopo: function (meta, posts) {
      const us = S.dados.usuarios;
      return posts.filter(function (p) {
        switch (meta.escopo) {
          case 'rede': return p.rede === meta.alvo;
          case 'conta': return p.conta === meta.alvo;
          case 'pessoa': return p.responsavel === meta.alvo;
          case 'funcao': return us.some(function (u) { return u.email === p.responsavel && u.funcao === meta.alvo; });
          default: return true;
        }
      });
    },
    progresso: function (meta) {
      const lista = M.doMes(M.doEscopo(meta, S.dados.posts), meta.periodo);
      const atual = M.valor(meta.metrica, lista); const alvo = num(meta.valor);
      const mesAtual = mesDe(hoje); const dias = diasNoMes(meta.periodo);
      const fracTempo = meta.periodo < mesAtual ? 1 : meta.periodo > mesAtual ? 0 : hoje.getDate() / dias;
      const taxa = meta.metrica === 'engajamento';
      const esperado = taxa ? alvo : alvo * fracTempo;
      const ritmo = esperado ? atual / esperado : (atual >= alvo ? 1 : 0);
      const status = fracTempo === 0 ? 'neutro' : ritmo >= 1 ? 'ok' : ritmo >= 0.85 ? 'atencao' : 'fora';
      const falta = Math.max(0, alvo - atual);
      const diasRest = meta.periodo === mesAtual ? dias - hoje.getDate() + 1 : meta.periodo > mesAtual ? dias : 0;
      return { atual: atual, alvo: alvo, frac: alvo ? atual / alvo : 0, fracTempo: fracTempo, status: status, falta: falta,
        porDia: diasRest ? falta / diasRest : 0, diasRest: diasRest, taxa: taxa };
    },
    // compara o post com a mediana da mesma conta e formato nos 90 dias anteriores, na métrica de análise
    vsMedia: function (p, k) {
      k = k || chaveAnalise(p);
      const ref = new Date(p.data); const ini = new Date(ref); ini.setDate(ini.getDate() - 90);
      const base = S.dados.posts.filter(function (q) {
        return q !== p && q.status === 'postado' && q.conta === p.conta && q.formato === p.formato && new Date(q.data) < ref && new Date(q.data) >= ini && M.resultado(q) > 0;
      });
      if (base.length < 4) return null;
      const med = mediana(base.map(function (q) { return M.valorAnalise(q, k); })); const v = M.valorAnalise(p, k);
      return med && isFinite(v) ? v / med - 1 : null;
    }
  };
  function chaveAnalise(p) { return S.analise === 'objetivo' ? (OBJETIVOS[p.objetivo] ? p.objetivo : 'alcance') : S.analise; }
  function fmtAnalise(p, k) { const v = M.valorAnalise(p, k); return !isFinite(v) ? '—' : k === 'alcance' ? fmtC(v) : pct(v, 2); }
  function podeMetas() { return S.user && (S.user.perfil === 'admin' || S.user.pode_metas === 'sim'); }
  // mês corrente compara com o mesmo intervalo de dias do mês anterior; meses fechados, com o mês inteiro
  // ---- período selecionado (de S.ini até S.fim, datas yyyy-mm-dd)
  function isoDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function somaDias(iso, n) { const p = iso.split('-').map(Number); return isoDe(new Date(p[0], p[1] - 1, p[2] + n)); }
  function diasEntre(a, b) { const x = a.split('-').map(Number), y = b.split('-').map(Number); return Math.round((new Date(y[0], y[1] - 1, y[2]) - new Date(x[0], x[1] - 1, x[2])) / 864e5) + 1; }
  function noPeriodo(posts, ini, fim) { ini = ini || S.ini; fim = fim || S.fim; return posts.filter(function (p) { const d = String(p.data).slice(0, 10); return d >= ini && d <= fim; }); }
  // período anterior: começando no dia 1, usa os mesmos dias do mês anterior; senão, o mesmo número de dias logo antes
  function anterior() {
    if (S.ini.slice(8) === '01' && S.ini.slice(0, 7) === S.fim.slice(0, 7)) {
      const m = mesAnterior(S.ini.slice(0, 7)); const dia = Math.min(Number(S.fim.slice(8)), diasNoMes(m));
      return { ini: m + '-01', fim: m + '-' + pad(dia) };
    }
    const n = diasEntre(S.ini, S.fim); return { ini: somaDias(S.ini, -n), fim: somaDias(S.ini, -1) };
  }
  function doAnterior(posts) { const a = anterior(); return noPeriodo(posts, a.ini, a.fim); }
  function rotuloPeriodo(ini, fim) {
    ini = ini || S.ini; fim = fim || S.fim;
    const f = function (iso, ano) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('pt-BR', ano ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }).replace(/\./g, ''); };
    return ini === fim ? f(ini, true) : f(ini, ini.slice(0, 4) !== fim.slice(0, 4)) + ' a ' + f(fim, true);
  }
  function rotAnt() { const a = anterior(); return 'vs ' + rotuloPeriodo(a.ini, a.fim); }
  function aplicarPreset(v) {
    const h = isoDe(hoje); S.preset = v;
    if (v === 'hoje') { S.ini = S.fim = h; }
    else if (v === 'ontem') { S.ini = S.fim = somaDias(h, -1); }
    else if (v === '7d') { S.ini = somaDias(h, -6); S.fim = h; }
    else if (v === '30d') { S.ini = somaDias(h, -29); S.fim = h; }
    else if (v === '90d') { S.ini = somaDias(h, -89); S.fim = h; }
    else if (v === 'mes') { S.ini = mesDe(hoje) + '-01'; S.fim = h; }
    else if (v === 'mesant') { const m = mesAnterior(mesDe(hoje)); S.ini = m + '-01'; S.fim = m + '-' + pad(diasNoMes(m)); }
    else if (/^m:/.test(v)) { const m = v.slice(2); S.ini = m + '-01'; S.fim = m === mesDe(hoje) ? h : m + '-' + pad(diasNoMes(m)); }
    S.mes = S.fim.slice(0, 7); // metas são mensais: usam o mês do fim do período
  }
  function nomeConta(id) { const c = (S.dados.contas || []).filter(function (x) { return x.id === id; })[0]; return c ? (REDES[c.rede] ? REDES[c.rede].nome + ' · ' : '') + c.nome : id; }
  function nomePessoa(email) { const u = S.dados.usuarios.filter(function (x) { return x.email === email; })[0]; return u ? u.nome : (email || '—'); }
  function rotuloAlvo(m) { return m.escopo === 'conta' ? nomeConta(m.alvo) : m.escopo === 'rede' ? (REDES[m.alvo] || {}).nome || m.alvo : m.escopo === 'pessoa' ? nomePessoa(m.alvo) : m.escopo === 'geral' ? 'Todas as redes' : m.alvo; }
  function fmtMetrica(metrica, v) { return metrica === 'engajamento' ? pct(v, 2) : fmtC(v); }

  // ---------------------------------------------------------------- recomendações (regras)
  function recomendar(mes) {
    const recs = []; const D = S.dados; const todos = D.posts; const pub = M.postados(todos);
    const fim = new Date(); const ini90 = new Date(fim); ini90.setDate(ini90.getDate() - 90);
    const janela = pub.filter(function (p) { const d = new Date(p.data); return d >= ini90 && d <= fim && M.resultado(p) > 0; });
    const mesAtual = mesDe(hoje);

    // 1. metas fora do ritmo
    D.metas.filter(function (m) { return m.periodo === mes; }).forEach(function (m) {
      const pr = M.progresso(m);
      if (pr.status === 'fora' || pr.status === 'atencao') {
        const quanto = pr.taxa ? 'Está em ' + pct(pr.atual, 2) + ' para uma meta de ' + pct(pr.alvo, 2) + '.'
          : 'Faltam ' + fmtC(pr.falta) + (pr.diasRest ? ' em ' + pr.diasRest + ' dias, cerca de ' + fmtC(Math.ceil(pr.porDia)) + ' por dia.' : '.');
        recs.push({ nivel: pr.status === 'fora' ? 'alta' : 'media', titulo: METRICAS[m.metrica] + ' · ' + rotuloAlvo(m) + (pr.status === 'fora' ? ' está fora do ritmo' : ' pede atenção'),
          texto: quanto, tag: 'Metas' });
      }
    });

    // por conta: formato, horário, editorial
    const porConta = agrupar(janela, function (p) { return p.conta; });
    Object.keys(porConta).forEach(function (cid) {
      const l = porConta[cid]; if (l.length < 10) return;
      const medConta = mediana(l.map(M.resultado)); const engConta = mediana(l.map(M.eng));
      const conta = nomeConta(cid);
      // 2. formato
      const fmts = agrupar(l, function (p) { return p.formato; });
      const ranking = Object.keys(fmts).filter(function (f) { return fmts[f].length >= 4 && f !== 'Stories'; }).map(function (f) {
        return { f: f, res: mediana(fmts[f].map(M.resultado)), eng: mediana(fmts[f].map(M.eng)), n: fmts[f].length };
      }).sort(function (a, b) { return b.res - a.res; });
      if (ranking.length >= 2) {
        const top = ranking[0], pior = ranking[ranking.length - 1];
        const doMes = M.postados(noPeriodo(todos)).filter(function (p) { return p.conta === cid; });
        const fatia = doMes.length ? doMes.filter(function (p) { return p.formato === top.f; }).length / doMes.length : 0;
        if (top.res > medConta * 1.2 && fatia < 0.5) {
          recs.push({ nivel: 'oportunidade', titulo: conta + ': ' + top.f + ' rende mais', tag: 'Formato',
            texto: top.f + ' tem resultado típico de ' + fmtC(top.res) + ' (' + pct(top.res / medConta - 1, 0) + ' acima da mediana da conta) e foi ' + pct(fatia, 0) + ' dos posts do período. Vale aumentar a fatia.' });
        }
        if (pior.res < medConta * 0.6) {
          recs.push({ nivel: 'media', titulo: conta + ': ' + pior.f + ' está abaixo', tag: 'Formato',
            texto: pior.f + ' entrega ' + pct(1 - pior.res / medConta, 0) + ' menos que a mediana da conta. Revise gancho e capa, ou troque parte desses posts pelo formato que rende mais.' });
        }
        const salvador = ranking.slice().sort(function (a, b) { return b.eng - a.eng; })[0];
        if (salvador && salvador.f !== top.f && salvador.eng > engConta * 1.3) {
          recs.push({ nivel: 'info', titulo: conta + ': ' + salvador.f + ' gera mais interação', tag: 'Engajamento',
            texto: 'Engajamento típico de ' + pct(salvador.eng, 2) + ' contra ' + pct(engConta, 2) + ' da conta. Use esse formato para conteúdo que pede salvamento e compartilhamento.' });
        }
      }
      // 3. horário
      const horas = agrupar(l.filter(function (p) { return p.hora; }), function (p) { return p.hora.slice(0, 2) + 'h'; });
      const hr = Object.keys(horas).filter(function (h) { return horas[h].length >= 4; }).map(function (h) { return { h: h, res: mediana(horas[h].map(M.resultado)) }; }).sort(function (a, b) { return b.res - a.res; });
      if (hr.length >= 2 && hr[0].res > hr[hr.length - 1].res * 1.25) {
        recs.push({ nivel: 'oportunidade', titulo: conta + ': priorize ' + hr[0].h, tag: 'Horário',
          texto: 'Posts às ' + hr[0].h + ' rendem ' + pct(hr[0].res / hr[hr.length - 1].res - 1, 0) + ' a mais que às ' + hr[hr.length - 1].h + ' (mediana dos últimos 90 dias).' });
      }
      // 4. editorial
      const eds = agrupar(l.filter(function (p) { return p.editorial; }), function (p) { return p.editorial; });
      const er = Object.keys(eds).filter(function (e) { return eds[e].length >= 4; }).map(function (e) { return { e: e, res: mediana(eds[e].map(M.resultado)) }; }).sort(function (a, b) { return b.res - a.res; });
      if (er.length >= 3 && er[0].res > medConta * 1.15) {
        recs.push({ nivel: 'info', titulo: conta + ': editorial ' + er[0].e + ' puxa o alcance', tag: 'Editorial',
          texto: er[0].e + ' fica ' + pct(er[0].res / medConta - 1, 0) + ' acima da mediana. O mais fraco é ' + er[er.length - 1].e + '. Teste novos ângulos de ' + er[0].e + ' antes de abrir pautas novas.' });
      }
    });

    // 5. frequência: mês atual até hoje x mesmo período do mês anterior
    {
      const pa = anterior();
      Object.keys(REDES).forEach(function (r) {
        const a = M.postados(noPeriodo(todos)).filter(function (p) { return p.rede === r; }).length;
        const b = M.postados(noPeriodo(todos, pa.ini, pa.fim)).filter(function (p) { return p.rede === r; }).length;
        if (b >= 4 && a < b * 0.8) {
          recs.push({ nivel: 'media', titulo: REDES[r].nome + ': frequência caiu', tag: 'Frequência',
            texto: a + ' posts em ' + rotuloPeriodo() + ', contra ' + b + ' em ' + rotuloPeriodo(pa.ini, pa.fim) + '. Frequência menor costuma derrubar o alcance.' });
        }
      });
    }

    // 6. posts que estouraram no mês
    M.postados(noPeriodo(todos)).forEach(function (p) {
      const v = M.vsMedia(p);
      if (v != null && v >= 1) {
        recs.push({ nivel: 'oportunidade', titulo: 'Replicar: "' + p.titulo + '"', tag: 'Destaque',
          texto: nomeConta(p.conta) + ', ' + p.formato + ' de ' + dataBR(p.data) + ' rendeu ' + pct(v, 0) + ' acima da média do formato. Faça uma variação, um corte para outra rede ou impulsione.' });
      }
    });

    // 7. vídeos com retenção baixa
    const vids = M.postados(noPeriodo(todos)).filter(function (p) { return M.ehVideo(p) && num(p.retencao) > 0; });
    if (vids.length >= 4) {
      const ret = mediana(vids.map(function (p) { return num(p.retencao); }));
      if (ret < 0.35) recs.push({ nivel: 'media', titulo: 'Retenção dos vídeos em ' + pct(ret, 0), tag: 'Vídeo',
        texto: 'A maioria sai antes da metade. Corte a introdução, coloque o gancho falado e visual nos 3 primeiros segundos e legende a promessa logo na abertura.' });
    }

    // 8. Reels sem alcance de não seguidores
    const reels = M.postados(noPeriodo(todos)).filter(function (p) { return p.formato === 'Reels' && num(p.alcance_nao_seguidores) > 0; });
    if (reels.length >= 4) {
      const ns = mediana(reels.map(function (p) { return num(p.alcance_nao_seguidores); }));
      if (ns < 0.4) recs.push({ nivel: 'media', titulo: 'Reels alcançando pouca gente nova (' + pct(ns, 0) + ')', tag: 'Crescimento',
        texto: 'Reels deveriam puxar não seguidores. Teste temas mais amplos, áudio em alta e collab com perfis parceiros.' });
    }

    // 9. imagem x vídeo
    const im = janela.filter(M.ehImagem), vi = janela.filter(M.ehVideo);
    if (im.length >= 6 && vi.length >= 6) {
      const ri = mediana(im.map(M.resultado)), rv = mediana(vi.map(M.resultado));
      if (rv > ri * 1.5) recs.push({ nivel: 'info', titulo: 'Vídeos rendem ' + (rv / ri).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'x o alcance das imagens', tag: 'Produção',
        texto: 'Use as imagens para o que pede salvamento (carrossel educativo, checklist) e direcione a capacidade extra de edição para vídeos curtos.' });
    }

    // 10. objetivo de cada post: quantos bateram a média na métrica que queriam mover
    const pubPer = M.postados(noPeriodo(todos));
    Object.keys(OBJETIVOS).forEach(function (k) {
      const l = pubPer.filter(function (p) { return p.objetivo === k; });
      const vs = l.map(function (p) { return M.vsMedia(p, k); }).filter(function (v) { return v != null; });
      if (vs.length < 5) return;
      const taxa = vs.filter(function (v) { return v >= 0; }).length / vs.length;
      const melhor = melhorFormato(janela, k);
      const dica = melhor ? ' O formato que mais gera ' + OBJETIVOS[k].toLowerCase() + ' nos últimos 90 dias é ' + melhor.f + '.' : '';
      if (taxa < 0.4) recs.push({ nivel: 'media', titulo: 'Objetivo ' + OBJETIVOS[k] + ': só ' + pct(taxa, 0) + ' dos posts bateram a média', tag: 'Objetivo',
        texto: vs.length + ' posts tinham esse objetivo no período.' + dica + ' Reforce o CTA pedindo essa ação.' });
      else if (taxa >= 0.7) recs.push({ nivel: 'oportunidade', titulo: 'Objetivo ' + OBJETIVOS[k] + ': ' + pct(taxa, 0) + ' dos posts acima da média', tag: 'Objetivo',
        texto: 'A receita está funcionando. Mantenha o padrão de gancho e CTA desses posts.' + dica });
    });

    // 11. qualidade do cadastro
    const doMesTodos = noPeriodo(todos);
    const semResp = doMesTodos.filter(function (p) { return !p.responsavel; }).length;
    const semPasta = M.postados(doMesTodos).filter(function (p) { return !p.pasta_drive; }).length;
    const semObj = M.postados(doMesTodos).filter(function (p) { return !OBJETIVOS[p.objetivo]; }).length;
    const faltas = [semResp ? semResp + ' sem responsável' : '', semPasta ? semPasta + ' sem pasta do Drive' : '', semObj ? semObj + ' sem objetivo' : ''].filter(Boolean);
    if (faltas.length) recs.push({ nivel: 'info', titulo: 'Complete o cadastro dos posts', tag: 'Dados',
      texto: faltas.join(', ') + '. Sem isso a produção do time, a análise por objetivo e o atalho para os arquivos ficam incompletos.' });

    const ordem = { alta: 0, media: 1, oportunidade: 2, info: 3 };
    return recs.sort(function (a, b) { return ordem[a.nivel] - ordem[b.nivel]; });
  }

  function melhorFormato(lista, k) {
    const fm = agrupar(M.postados(lista).filter(function (p) { return M.resultado(p) > 0; }), function (p) { return p.formato; });
    const r = Object.keys(fm).filter(function (f) { return fm[f].length >= 3; })
      .map(function (f) { return { f: f, v: mediana(fm[f].map(function (p) { return M.valorAnalise(p, k); })) }; })
      .sort(function (a, b) { return b.v - a.v; });
    return r[0] ? Object.assign(r[0], { segundo: r[1] }) : null;
  }
  function cardObjetivos(lista) {
    const pub = M.postados(lista);
    const linhas = Object.keys(OBJETIVOS).map(function (k) {
      const l = pub.filter(function (p) { return p.objetivo === k; }); if (!l.length) return '';
      const vs = l.map(function (p) { return M.vsMedia(p, k); }).filter(function (v) { return v != null; });
      const tipico = mediana(l.map(function (p) { return M.valorAnalise(p, k); }));
      return '<tr><td><b>' + OBJETIVOS[k] + '</b></td><td class="n">' + l.length + '</td><td class="n">' + (k === 'alcance' ? fmtC(tipico) : pct(tipico, 2)) + '</td><td class="n">' +
        (vs.length ? '<span class="' + (vs.filter(function (v) { return v >= 0; }).length / vs.length >= 0.5 ? 'acima' : 'abaixo') + '">' + pct(vs.filter(function (v) { return v >= 0; }).length / vs.length, 0) + '</span>' : '—') + '</td></tr>';
    }).join('');
    const sem = pub.filter(function (p) { return !OBJETIVOS[p.objetivo]; }).length;
    return '<div class="card"><h2>Resultado por objetivo<small>' + (sem ? sem + ' posts sem objetivo' : rotuloPeriodo()) + '</small></h2>' +
      (linhas ? '<div class="tabela-wrap"><table><thead><tr><th>Objetivo</th><th class="n">Posts</th><th class="n" title="Mediana. Curtidas, comentários, salvos e envios divididos pelo alcance">Taxa típica</th><th class="n" title="Posts acima da mediana da própria conta e formato">Bateram a média</th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : '<div class="vazio-msg">Nenhum post com objetivo definido no período. Defina em Editar.</div>') + '</div>';
  }
  function cardFormatoObjetivo(lista) {
    const linhas = Object.keys(OBJETIVOS).map(function (k) {
      const m = melhorFormato(lista, k); if (!m) return '';
      return '<tr><td><b>' + OBJETIVOS[k] + '</b></td><td>' + esc(m.f) + '</td><td class="n">' + (k === 'alcance' ? fmtC(m.v) : pct(m.v, 2)) + '</td><td>' + (m.segundo ? esc(m.segundo.f) : '—') + '</td></tr>';
    }).join('');
    return '<div class="card"><h2>Melhor formato para cada objetivo<small>' + rotuloPeriodo() + '</small></h2>' +
      (linhas ? '<div class="tabela-wrap"><table><thead><tr><th>Para gerar</th><th>Use</th><th class="n">Taxa típica</th><th>Depois</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' : '<div class="vazio-msg">Poucos posts no período.</div>') + '</div>';
  }

  // ---------------------------------------------------------------- gráficos SVG
  const CORES = ['#0072CE', '#F6BF00', '#1998FF', '#004882', '#12A150', '#D93838', '#8A5CF6'];
  function escalaMax(v) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function grafBarras(rotulos, series, opts) {
    opts = opts || {}; const W = 600, H = 220, L = 46, B = 26, T = 8;
    const max = escalaMax(Math.max.apply(null, series.map(function (s) { return Math.max.apply(null, s.valores.concat([0])); })));
    const gw = (W - L) / rotulos.length; const bw = Math.min(28, Math.max(2, gw * 0.8 / series.length));
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    for (let i = 0; i <= 4; i++) { const y = T + (H - B - T) * (1 - i / 4); svg += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#E6EBF4"/><text x="' + (L - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + (opts.pct ? pct(max * i / 4, 0) : fmtC(max * i / 4)) + '</text>'; }
    rotulos.forEach(function (r, i) {
      const x0 = L + gw * i + (gw - bw * series.length) / 2;
      series.forEach(function (s, j) {
        const v = s.valores[i] || 0; const h = (H - B - T) * v / max;
        svg += '<rect x="' + (x0 + j * bw) + '" y="' + (H - B - h) + '" width="' + Math.max(1, bw - (bw > 6 ? 2 : 0.5)) + '" height="' + Math.max(0, h) + '" rx="3" fill="' + s.cor + '"><title>' + esc(s.nome + ' · ' + r + ': ' + (opts.pct ? pct(v, 2) : fmt(v))) + '</title></rect>';
      });
      if (!opts.passo || i % opts.passo === 0) svg += '<text x="' + (L + gw * i + gw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(r) + '</text>';
    });
    return '<div class="grafico">' + svg + '</svg>' + legenda(series) + '</div>';
  }
  function grafLinhas(rotulos, series) {
    const W = 600, H = 200, L = 52, B = 26, T = 10;
    const todos = [].concat.apply([], series.map(function (s) { return s.valores; })).filter(isFinite);
    if (!todos.length) return '<div class="vazio-msg">Sem histórico de seguidores ainda.</div>';
    let min = Math.min.apply(null, todos), max = Math.max.apply(null, todos); const folga = (max - min) * 0.15 || max * 0.05 || 1; min = Math.max(0, min - folga); max += folga;
    const x = function (i) { return L + (W - L - 10) * (rotulos.length === 1 ? 0.5 : i / (rotulos.length - 1)); };
    const y = function (v) { return T + (H - B - T) * (1 - (v - min) / (max - min)); };
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    for (let i = 0; i <= 3; i++) { const v = min + (max - min) * i / 3; svg += '<line x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E6EBF4"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmtC(v) + '</text>'; }
    const passo = Math.ceil(rotulos.length / 8);
    rotulos.forEach(function (r, i) { if (i % passo === 0 || i === rotulos.length - 1) svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(r) + '</text>'; });
    series.forEach(function (s) {
      const pts = s.valores.map(function (v, i) { return isFinite(v) ? x(i) + ',' + y(v) : null; }).filter(Boolean);
      svg += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(' ') + '"/>';
    });
    return '<div class="grafico">' + svg + '</svg>' + (series.length > 1 ? legenda(series) : '') + '</div>';
  }
  function legenda(series) { return '<div class="legenda">' + series.map(function (s) { return '<span><i style="background:' + s.cor + '"></i>' + esc(s.nome) + '</span>'; }).join('') + '</div>'; }

  // ---------------------------------------------------------------- componentes
  function delta(atual, anterior, inverso) {
    if (!anterior) return '<span class="delta igual">sem base</span>';
    const d = atual / anterior - 1; const cls = Math.abs(d) < 0.005 ? 'igual' : (d > 0) !== !!inverso ? 'sobe' : 'desce';
    return '<span class="delta ' + cls + '">' + (d > 0 ? '+' : '') + pct(d, 0) + '</span>';
  }
  function kpi(rotulo, valor, rodape) { return '<div class="card kpi"><div class="rotulo">' + rotulo + '</div><div class="valor num">' + valor + '</div><div class="rodape">' + (rodape || '') + '</div></div>'; }
  function blocoMeta(m) {
    const p = M.progresso(m); const larg = Math.min(100, p.frac * 100);
    const rotStatus = { ok: 'No ritmo', atencao: 'Atenção', fora: 'Fora da meta', neutro: 'Não começou' }[p.status];
    const info = p.taxa ? 'Atual ' + pct(p.atual, 2) + ' de ' + pct(p.alvo, 2)
      : fmtC(p.atual) + ' de ' + fmtC(p.alvo) + ' (' + pct(p.frac, 0) + ')';
    const falta = p.taxa ? (p.atual >= p.alvo ? 'Meta batida' : 'Faltam ' + pct(p.alvo - p.atual, 2) + ' pontos')
      : p.falta <= 0 ? 'Meta batida' : 'Faltam ' + fmtC(p.falta) + (p.diasRest ? ' · ' + fmtC(Math.ceil(p.porDia)) + '/dia' : '');
    return '<div class="meta"><div class="meta-topo"><span><b>' + esc(METRICAS[m.metrica] || m.metrica) + '</b> · ' + esc(rotuloAlvo(m)) + '</span><span class="selo ' + p.status + '">' + rotStatus + '</span></div>' +
      '<div class="barra ' + p.status + '"><i style="width:' + larg + '%"></i>' + (!p.taxa && p.fracTempo > 0 && p.fracTempo < 1 ? '<span class="ritmo" style="left:' + (p.fracTempo * 100) + '%" title="Onde deveria estar hoje"></span>' : '') + '</div>' +
      '<div class="meta-info"><span class="num">' + info + '</span><span>' + falta + '</span></div>' +
      (podeMetas() && S.aba === 'metas' ? '<div style="margin-top:6px"><button class="btn peq sec perigo" data-excluir-meta="' + esc(m.id) + '">Excluir</button></div>' : '') + '</div>';
  }
  function blocoRec(r) {
    const ic = { alta: '!', media: '•', oportunidade: '↑', info: 'i' }[r.nivel];
    return '<div class="rec ' + r.nivel + '"><div class="ic">' + ic + '</div><div><b>' + esc(r.titulo) + '</b><p>' + esc(r.texto) + '</p><div class="tag">' + esc(r.tag) + '</div></div></div>';
  }
  function linkDrive(p) {
    const u = urlSegura(p.pasta_drive);
    return u ? '<a class="link-drive" href="' + esc(u) + '" target="_blank" rel="noopener">Abrir pasta ↗</a>' : '<span class="link-drive vazio">sem pasta</span>';
  }
  function tabelaPosts(lista, opts) {
    opts = opts || {};
    if (!lista.length) return '<div class="vazio-msg">Nenhum post neste filtro.</div>';
    const linhas = lista.slice().sort(function (a, b) { return (b.data + b.hora).localeCompare(a.data + a.hora); }).slice(0, opts.limite || 400).map(function (p) {
      const k = chaveAnalise(p); const v = p.status === 'postado' ? M.vsMedia(p, k) : null; const e = p.status === 'postado' ? M.eng(p) : NaN;
      const link = urlSegura(p.link);
      return '<tr><td class="num">' + dataBR(p.data) + '<div class="mini">' + diaSemana(p.data) + (p.hora ? ' · ' + esc(p.hora) : '') + '</div></td>' +
        (opts.semConta ? '' : '<td>' + esc(nomeConta(p.conta)) + '</td>') +
        '<td><span class="pill">' + esc(p.formato) + '</span></td>' +
        '<td>' + (link ? '<a class="titulo-post" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(p.titulo) + '</a>' : '<span class="titulo-post">' + esc(p.titulo) + '</span>') + '<div class="mini">' + esc(p.editorial || '') + (p.status !== 'postado' ? ' · ' + esc(p.status) : '') + '</div></td>' +
        '<td>' + esc(nomePessoa(p.responsavel)) + '</td>' +
        '<td class="n">' + (p.status === 'postado' ? fmtC(M.resultado(p)) : '—') + '</td>' +
        '<td class="n">' + (isFinite(e) ? pct(e, 2) : '—') + '</td>' +
        '<td><span class="pill' + (OBJETIVOS[p.objetivo] ? ' obj' : '') + '">' + esc(OBJETIVOS[p.objetivo] || 'sem objetivo') + '</span>' +
        (p.status === 'postado' ? '<div class="mini">' + esc(OBJETIVOS[k]) + ': ' + fmtAnalise(p, k) + '</div>' : '') + '</td>' +
        '<td class="n">' + (v == null ? '<span class="mini">—</span>' : '<span class="' + (v >= 0 ? 'acima' : 'abaixo') + '">' + (v >= 0 ? '✓ +' : '') + pct(v, 0) + '</span>') + '</td>' +
        '<td>' + linkDrive(p) + '</td>' +
        '<td><button class="btn peq sec" data-editar="' + esc(p.id) + '">Editar</button></td></tr>';
    }).join('');
    return '<div class="tabela-wrap"><table><thead><tr><th>Data</th>' + (opts.semConta ? '' : '<th>Conta</th>') + '<th>Formato</th><th>Post</th><th>Responsável</th><th class="n">Resultado</th><th class="n">Eng.</th><th>Objetivo</th><th class="n" title="Na métrica escolhida em Analisar por: comparado à mediana da mesma conta e formato nos 90 dias anteriores. Curtidas, comentários, salvos e envios são taxas sobre o alcance.">vs média</th><th>Drive</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
  }
  function seletorPeriodo() {
    const ops = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias'], ['mes', 'Este mês'], ['mesant', 'Mês anterior']];
    const meses = ultimosMeses(12).reverse().slice(2).map(function (m) { return ['m:' + m, nomeMes(m)]; });
    const o = function (x) { return '<option value="' + x[0] + '"' + (x[0] === S.preset ? ' selected' : '') + '>' + x[1] + '</option>'; };
    return '<select id="f-analise" aria-label="Analisar por" title="Analisar posts por">' + ANALISES.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === S.analise ? ' selected' : '') + '>Analisar: ' + a[1] + '</option>'; }).join('') + '</select>' +
      '<select id="f-periodo" aria-label="Período">' + ops.map(o).join('') + '<optgroup label="Meses">' + meses.map(o).join('') + '</optgroup>' +
      (S.preset === 'custom' ? '<option value="custom" selected>Personalizado</option>' : '') + '</select>' +
      '<input type="date" id="f-ini" value="' + S.ini + '" max="' + S.fim + '" aria-label="De"><span class="mini">até</span>' +
      '<input type="date" id="f-fim" value="' + S.fim + '" min="' + S.ini + '" max="' + isoDe(hoje) + '" aria-label="Até">';
  }

  // ---------------------------------------------------------------- telas
  function telaGeral() {
    const D = S.dados; const doMes = noPeriodo(D.posts); const ant = doAnterior(D.posts);
    const a = M.resumo(doMes), b = M.resumo(ant);
    const diario = diasEntre(S.ini, S.fim) <= 31; const baldes = [];
    if (diario) { for (let d = S.ini; d <= S.fim; d = somaDias(d, 1)) baldes.push(d); }
    else { for (let m = S.ini.slice(0, 7); m <= S.fim.slice(0, 7); m = mesDe(new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 1))) baldes.push(m); }
    const series = Object.keys(REDES).map(function (r) {
      return { nome: REDES[r].nome, cor: REDES[r].cor, valores: baldes.map(function (b) { return M.postados(noPeriodo(D.posts)).filter(function (p) { return p.rede === r && String(p.data).slice(0, b.length) === b; }).length; }) };
    });
    const metas = D.metas.filter(function (m) { return m.periodo === S.mes; });
    const recs = recomendar(S.mes);
    const porRede = Object.keys(REDES).map(function (r) {
      const x = M.resumo(doMes.filter(function (p) { return p.rede === r; })); const y = M.resumo(ant.filter(function (p) { return p.rede === r; }));
      return '<tr><td><b>' + REDES[r].nome + '</b></td><td class="n">' + x.posts + '</td><td class="n">' + fmtC(x.resultado) + ' ' + delta(x.resultado, y.resultado) + '</td><td class="n">' + pct(x.eng, 2) + '</td><td class="n">' + fmtC(x.seguidores) + '</td></tr>';
    }).join('');
    const top = M.postados(doMes).filter(function (p) { return M.vsMedia(p) != null; }).sort(function (x, y) { return M.vsMedia(y) - M.vsMedia(x); }).slice(0, 5);
    return '<div class="grade g4">' +
      kpi('Posts publicados', fmt(a.posts), delta(a.posts, b.posts) + ' ' + rotAnt()) +
      kpi('Alcance + visualizações', fmtC(a.resultado), delta(a.resultado, b.resultado) + ' ' + rotAnt()) +
      kpi('Taxa de engajamento', pct(a.eng, 2), delta(a.eng, b.eng) + ' interações ÷ alcance') +
      kpi('Seguidores ganhos', fmtC(a.seguidores), delta(a.seguidores, b.seguidores) + ' atribuídos a posts') + '</div>' +
      '<div class="grade g2 secao"><div class="card"><h2>Metas de ' + nomeMes(S.mes) + '<small><button class="btn peq sec" data-ir="metas">Ver todas</button></small></h2>' +
      (metas.length ? metas.slice(0, 5).map(blocoMeta).join('') : '<div class="vazio-msg">Nenhuma meta para este mês.</div>') + '</div>' +
      '<div class="card"><h2>Próximos passos<small><button class="btn peq sec" data-ir="recomendacoes">Ver ' + recs.length + '</button></small></h2>' +
      (recs.length ? recs.slice(0, 4).map(blocoRec).join('') : '<div class="vazio-msg">Nada pedindo ação agora.</div>') + '</div></div>' +
      '<div class="grade g2 secao"><div class="card"><h2>Posts por rede · ' + (diario ? 'por dia' : 'por mês') + '</h2>' + grafBarras(baldes.map(diario ? dataBR : nomeMesCurto), series, { passo: Math.ceil(baldes.length / 10) }) + '</div>' +
      '<div class="card"><h2>Resumo por rede<small>' + rotuloPeriodo() + '</small></h2><div class="tabela-wrap"><table><thead><tr><th>Rede</th><th class="n">Posts</th><th class="n">Resultado</th><th class="n">Eng.</th><th class="n">Seguidores</th></tr></thead><tbody>' + porRede + '</tbody></table></div></div></div>' +
      '<div class="grade g2 secao">' + cardObjetivos(doMes) + cardFormatoObjetivo(doMes) + '</div>' +
      '<div class="card secao"><h2>Destaques do período<small>acima da média do próprio formato, na métrica de análise</small></h2>' + tabelaPosts(top) + '</div>';
  }

  function telaRede(rede) {
    const D = S.dados; const contas = D.contas.filter(function (c) { return c.rede === rede; });
    if (S.conta && !contas.some(function (c) { return c.id === S.conta; })) S.conta = '';
    const filtro = function (p) { return p.rede === rede && (!S.conta || p.conta === S.conta); };
    const doMes = noPeriodo(D.posts).filter(filtro), ant = doAnterior(D.posts).filter(filtro);
    const a = M.resumo(doMes), b = M.resumo(ant); const R = REDES[rede];
    // seguidores (snapshots)
    const snaps = D.snapshots.filter(function (s) { return s.rede === rede && (!S.conta || s.conta === S.conta); });
    const datas = Array.from(new Set(snaps.map(function (s) { return s.data; }))).sort();
    const segSeries = (S.conta ? contas.filter(function (c) { return c.id === S.conta; }) : contas).map(function (c, i) {
      return { nome: c.nome, cor: CORES[i % CORES.length], valores: datas.map(function (d) { const s = snaps.filter(function (x) { return x.conta === c.id && x.data === d; })[0]; return s ? num(s.seguidores) : NaN; }) };
    }).filter(function (s) { return s.valores.some(isFinite); });
    // por formato
    const fmts = agrupar(M.postados(doMes), function (p) { return p.formato; }); const nomesF = Object.keys(fmts);
    const fmtsAnt = agrupar(M.postados(ant), function (p) { return p.formato; });
    const extraKpi = rede === 'instagram' ? kpi('Salvos + envios', fmtC(a.salvos + a.compart), delta(a.salvos + a.compart, b.salvos + b.compart))
      : rede === 'linkedin' ? kpi('Reações, comentários e reposts', fmtC(a.interacoes), delta(a.interacoes, b.interacoes))
      : rede === 'blog' ? kpi('Cliques no CTA', fmtC(soma(M.postados(doMes), function (p) { return num(p.cliques); })), '')
        : kpi('Retenção média', (function () { const v = M.postados(doMes).filter(function (p) { return num(p.retencao) > 0; }); return v.length ? pct(mediana(v.map(function (p) { return num(p.retencao); })), 0) : '—'; })(), 'mediana dos vídeos');
    return '<div class="filtros" style="margin-bottom:14px"><select id="f-conta"><option value="">Todas as contas</option>' + contas.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === S.conta ? ' selected' : '') + '>' + esc(c.nome) + '</option>'; }).join('') + '</select></div>' +
      '<div class="grade g4">' + kpi('Posts', fmt(a.posts), delta(a.posts, b.posts)) + kpi(R.metrica, fmtC(a.resultado), delta(a.resultado, b.resultado)) +
      kpi('Engajamento', pct(a.eng, 2), delta(a.eng, b.eng)) + extraKpi + '</div>' +
      '<div class="grade g2 secao">' +
      (rede !== 'blog' ? '<div class="card"><h2>Seguidores</h2>' + grafLinhas(datas.map(dataBR), segSeries) + '</div>' : '') +
      '<div class="card"><h2>' + R.metrica + ' médio por formato<small>período x anterior</small></h2>' +
      (nomesF.length ? grafBarras(nomesF, [
        { nome: 'Período', cor: '#0072CE', valores: nomesF.map(function (f) { return M.resumo(fmts[f]).resultado / fmts[f].length; }) },
        { nome: 'Período anterior', cor: '#B9D9F5', valores: nomesF.map(function (f) { return fmtsAnt[f] ? M.resumo(fmtsAnt[f]).resultado / fmtsAnt[f].length : 0; }) }]) : '<div class="vazio-msg">Sem posts no período.</div>') + '</div></div>' +
      (rede !== 'blog' ? '<div class="grade g2 secao">' + cardObjetivos(doMes) + cardFormatoObjetivo(doMes) + '</div>' : '') +
      '<div class="card secao"><h2>Posts · ' + rotuloPeriodo() + '<small>' + doMes.length + ' itens</small></h2>' + tabelaPosts(doMes, { semConta: !!S.conta }) + '</div>';
  }

  function telaProducao() {
    const D = S.dados; const doMes = noPeriodo(D.posts), ant = doAnterior(D.posts);
    const pessoas = D.usuarios.filter(function (u) { return u.ativo !== 'não'; });
    const linha = function (u) {
      const l = doMes.filter(function (p) { return p.responsavel === u.email; }); const la = ant.filter(function (p) { return p.responsavel === u.email; });
      const imgs = M.postados(l).filter(M.ehImagem), vids = M.postados(l).filter(M.ehVideo);
      return { u: u, imF: l.filter(M.ehImagem).length, imP: imgs.length, viF: l.filter(M.ehVideo).length, viP: vids.length,
        txt: l.filter(function (p) { return p.tipo_peca === 'texto'; }).length,
        resIm: imgs.length ? mediana(imgs.map(M.resultado)) : 0, resVi: vids.length ? mediana(vids.map(M.resultado)) : 0,
        eng: M.resumo(l).eng, total: M.postados(l).length, totalAnt: M.postados(la).length };
    };
    const L = pessoas.map(linha).filter(function (x) { return x.imF + x.viF + x.txt + x.totalAnt > 0; });
    const imgsMes = M.postados(doMes).filter(M.ehImagem), vidsMes = M.postados(doMes).filter(M.ehVideo);
    const imgsAnt = M.postados(ant).filter(M.ehImagem), vidsAnt = M.postados(ant).filter(M.ehVideo);
    const r = function (l) { return l.length ? mediana(l.map(M.resultado)) : 0; };
    const funcoes = agrupar(L, function (x) { return x.u.funcao || 'Sem função'; });
    return '<div class="grade g4">' +
      kpi('Imagens postadas', fmt(imgsMes.length) + ' <span class="mini">/ ' + doMes.filter(M.ehImagem).length + ' feitas</span>', delta(imgsMes.length, imgsAnt.length) + ' ' + rotAnt()) +
      kpi('Resultado típico · imagem', fmtC(r(imgsMes)), delta(r(imgsMes), r(imgsAnt)) + ' mediana por post') +
      kpi('Vídeos postados', fmt(vidsMes.length) + ' <span class="mini">/ ' + doMes.filter(M.ehVideo).length + ' feitos</span>', delta(vidsMes.length, vidsAnt.length) + ' ' + rotAnt()) +
      kpi('Resultado típico · vídeo', fmtC(r(vidsMes)), delta(r(vidsMes), r(vidsAnt)) + ' mediana por post') + '</div>' +
      '<div class="grade g2 secao"><div class="card"><h2>Feitos x postados por pessoa</h2>' +
      (L.length ? grafBarras(L.map(function (x) { return x.u.nome.split(' ')[0]; }), [
        { nome: 'Imagens feitas', cor: '#B9D9F5', valores: L.map(function (x) { return x.imF; }) },
        { nome: 'Imagens postadas', cor: '#0072CE', valores: L.map(function (x) { return x.imP; }) },
        { nome: 'Vídeos feitos', cor: '#FCE29A', valores: L.map(function (x) { return x.viF; }) },
        { nome: 'Vídeos postados', cor: '#F6BF00', valores: L.map(function (x) { return x.viP; }) }]) : '<div class="vazio-msg">Sem produção atribuída neste mês.</div>') + '</div>' +
      '<div class="card"><h2>Por função</h2><div class="tabela-wrap"><table><thead><tr><th>Função</th><th class="n">Pessoas</th><th class="n">Postados</th><th class="n">Mês anterior</th><th class="n">Eng.</th></tr></thead><tbody>' +
      Object.keys(funcoes).map(function (f) { const g = funcoes[f]; const t = soma(g, function (x) { return x.total; }), ta = soma(g, function (x) { return x.totalAnt; });
        return '<tr><td><b>' + esc(f) + '</b></td><td class="n">' + g.length + '</td><td class="n">' + t + ' ' + delta(t, ta) + '</td><td class="n">' + ta + '</td><td class="n">' + pct(mediana(g.map(function (x) { return x.eng; })), 2) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div></div>' +
      '<div class="card secao"><h2>Detalhe por pessoa<small>' + rotuloPeriodo() + '</small></h2><div class="tabela-wrap"><table><thead><tr><th>Pessoa</th><th>Função</th><th class="n">Imagens feitas</th><th class="n">Imagens postadas</th><th class="n">Vídeos feitos</th><th class="n">Vídeos postados</th><th class="n">Textos</th><th class="n">Resultado imagem</th><th class="n">Resultado vídeo</th><th class="n">Postados vs anterior</th></tr></thead><tbody>' +
      L.map(function (x) { return '<tr><td><b>' + esc(x.u.nome) + '</b></td><td>' + esc(x.u.funcao || '') + '</td><td class="n">' + x.imF + '</td><td class="n">' + x.imP + '</td><td class="n">' + x.viF + '</td><td class="n">' + x.viP + '</td><td class="n">' + x.txt + '</td><td class="n">' + (x.resIm ? fmtC(x.resIm) : '—') + '</td><td class="n">' + (x.resVi ? fmtC(x.resVi) : '—') + '</td><td class="n">' + x.total + ' ' + delta(x.total, x.totalAnt) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  function telaMetas() {
    const metas = S.dados.metas.filter(function (m) { return m.periodo === S.mes; });
    const grupos = agrupar(metas, function (m) { return ESCOPOS[m.escopo] || m.escopo; });
    return '<p class="mini" style="margin-bottom:12px">Metas são mensais. Mostrando ' + nomeMes(S.mes) + ' (mês da data final do período).' + (podeMetas() ? '' : ' Só a gestão e quem ela liberar criam metas.') + '</p>' +
      (podeMetas() ? '<div style="margin-bottom:14px"><button class="btn prim" id="nova-meta">+ Nova meta</button></div>' : '') +
      (metas.length ? '<div class="grade g2">' + Object.keys(grupos).map(function (g) { return '<div class="card"><h2>' + esc(g) + '</h2>' + grupos[g].map(blocoMeta).join('') + '</div>'; }).join('') + '</div>'
        : '<div class="card"><div class="vazio-msg">Nenhuma meta em ' + nomeMes(S.mes) + '.' + (podeMetas() ? ' Crie a primeira no botão acima.' : '') + '</div></div>') +
      '<p class="mini secao">A linha fina na barra mostra onde a meta deveria estar hoje, proporcional aos dias do mês. "Por dia" é quanto falta dividido pelos dias restantes. Engajamento é taxa: compara direto com a meta.</p>';
  }

  function telaRecs() {
    const recs = recomendar(S.mes);
    const grupos = { alta: 'Prioridade alta', media: 'Atenção', oportunidade: 'Oportunidades', info: 'Para saber' };
    return '<div class="faixa-demo" style="background:var(--azul-2);border-color:#C5DDF5;color:var(--azul-escuro)">Recomendações geradas por regras sobre os dados do sistema (mediana dos últimos 90 dias, ritmo das metas e comparação com o mês anterior). Nada sai do sistema.</div>' +
      '<div class="grade g2">' + Object.keys(grupos).map(function (k) {
        const l = recs.filter(function (r) { return r.nivel === k; }); if (!l.length) return '';
        return '<div class="card"><h2>' + grupos[k] + '<small>' + l.length + '</small></h2>' + l.map(blocoRec).join('') + '</div>';
      }).join('') + '</div>' + (recs.length ? '' : '<div class="card"><div class="vazio-msg">Nenhuma recomendação para este mês.</div></div>');
  }

  function telaPosts() {
    const q = S.busca.toLowerCase();
    const l = noPeriodo(S.dados.posts).filter(function (p) { return !q || [p.titulo, p.editorial, p.formato, nomeConta(p.conta), nomePessoa(p.responsavel)].join(' ').toLowerCase().indexOf(q) >= 0; });
    return '<div class="filtros" style="margin-bottom:14px"><input type="search" id="f-busca" placeholder="Buscar título, editorial, pessoa…" value="' + esc(S.busca) + '" style="min-width:280px"></div>' +
      '<div class="card"><h2>' + l.length + ' posts · ' + rotuloPeriodo() + '</h2>' + tabelaPosts(l) + '</div>';
  }

  function telaEquipe() {
    if (S.user.perfil !== 'admin') return '<div class="card"><div class="vazio-msg">Só a gestão vê esta tela.</div></div>';
    const us = S.dados.usuarios.slice().sort(function (a, b) { return String(a.nome).localeCompare(b.nome); });
    return '<p class="mini" style="margin-bottom:12px">Quem estiver aqui e ativo entra com a conta Google @' + esc(CFG.DOMINIO || '4blue.com.br') + '. Gestão vê esta tela, libera pessoas e define quem cria metas.</p>' +
      '<div style="margin-bottom:14px"><button class="btn prim" id="nova-pessoa">+ Pessoa</button></div>' +
      '<div class="card"><div class="tabela-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Perfil</th><th>Cria metas</th><th>Ativo</th><th></th></tr></thead><tbody>' +
      us.map(function (u) {
        return '<tr><td><b>' + esc(u.nome) + '</b></td><td>' + esc(u.email) + '</td><td>' + esc(u.funcao || '') + '</td><td>' + (u.perfil === 'admin' ? '<span class="pill obj">Gestão</span>' : 'Membro') + '</td>' +
          '<td>' + (u.perfil === 'admin' || u.pode_metas === 'sim' ? 'Sim' : 'Não') + '</td><td>' + (u.ativo === 'não' ? '<span class="abaixo">Não</span>' : 'Sim') + '</td>' +
          '<td><button class="btn peq sec" data-pessoa="' + esc(u.email) + '">Editar</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }
  function editarPessoa(email) {
    const u = S.dados.usuarios.filter(function (x) { return x.email === email; })[0] || { email: '', nome: '', funcao: '', perfil: 'membro', pode_metas: 'não', ativo: 'sim' };
    const funcoes = ['Gestão', 'Social media', 'Designer', 'Editor de vídeo', 'Redator', 'Analista de conteúdo'];
    abrirModal('<h3>' + (email ? 'Editar pessoa' : 'Nova pessoa') + '</h3>' +
      '<label class="campo">E-mail @' + esc(CFG.DOMINIO || '4blue.com.br') + '<input type="text" id="u-email" value="' + esc(u.email) + '"' + (email ? ' disabled' : '') + '></label>' +
      '<label class="campo">Nome<input type="text" id="u-nome" value="' + esc(u.nome) + '"></label>' +
      '<label class="campo">Função em Branding e Conteúdo<select id="u-funcao">' + opcoes(funcoes.indexOf(u.funcao) < 0 && u.funcao ? funcoes.concat([u.funcao]) : funcoes, u.funcao) + '</select></label>' +
      '<label class="campo">Perfil<select id="u-perfil">' + opcoes([['membro', 'Membro'], ['admin', 'Gestão (libera pessoas e metas)']], u.perfil) + '</select></label>' +
      '<label class="campo">Pode criar metas<select id="u-metas">' + opcoes([['não', 'Não'], ['sim', 'Sim']], u.pode_metas === 'sim' ? 'sim' : 'não') + '</select></label>' +
      '<label class="campo">Ativo<select id="u-ativo">' + opcoes([['sim', 'Sim'], ['não', 'Não (bloqueia o acesso)']], u.ativo === 'não' ? 'não' : 'sim') + '</select></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="u-salvar">Salvar</button></div>');
    document.getElementById('u-salvar').onclick = async function () {
      const dados = { email: document.getElementById('u-email').value.trim().toLowerCase(), nome: document.getElementById('u-nome').value.trim(),
        funcao: document.getElementById('u-funcao').value, perfil: document.getElementById('u-perfil').value,
        pode_metas: document.getElementById('u-metas').value, ativo: document.getElementById('u-ativo').value };
      const dom = '@' + (CFG.DOMINIO || '4blue.com.br');
      if (!DEMO && !dados.email.endsWith(dom)) { toast('Use um e-mail ' + dom + '.'); return; }
      if (!dados.nome) { toast('Informe o nome.'); return; }
      try {
        if (!DEMO) await api('salvarUsuario', { usuario: dados });
        const i = S.dados.usuarios.findIndex(function (x) { return x.email === dados.email; });
        if (i >= 0) Object.assign(S.dados.usuarios[i], dados); else S.dados.usuarios.push(dados);
        fecharModal(); render(); toast('Equipe atualizada.');
      } catch (e) { toast(e.message); }
    };
  }

  // ---------------------------------------------------------------- modais
  function abrirModal(html) { document.getElementById('modal').innerHTML = '<div class="fundo-modal"><div class="caixa">' + html + '</div></div>'; }
  function fecharModal() { document.getElementById('modal').innerHTML = ''; }
  function opcoes(lista, atual) { return lista.map(function (o) { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''); }

  function editarPost(id) {
    const p = S.dados.posts.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    const pessoas = [['', '— sem responsável —']].concat(S.dados.usuarios.map(function (u) { return [u.email, u.nome + (u.funcao ? ' · ' + u.funcao : '')]; }));
    abrirModal('<h3>Editar post</h3><p class="mini" style="margin:-8px 0 12px">' + esc(p.titulo) + '</p>' +
      '<label class="campo">Responsável<select id="e-resp">' + opcoes(pessoas, p.responsavel) + '</select></label>' +
      '<label class="campo">Tipo de peça<select id="e-tipo">' + opcoes([['imagem', 'Imagem / carrossel'], ['video', 'Vídeo'], ['texto', 'Texto / artigo']], p.tipo_peca) + '</select></label>' +
      '<label class="campo">Editorial<input type="text" id="e-ed" value="' + esc(p.editorial) + '"></label>' +
      '<label class="campo">Objetivo do post<select id="e-obj">' + opcoes([['', '— sem objetivo —']].concat(Object.keys(OBJETIVOS).map(function (k) { return [k, OBJETIVOS[k]]; })), p.objetivo) + '</select></label>' +
      '<label class="campo">Status<select id="e-status">' + opcoes([['produzido', 'Produzido'], ['agendado', 'Agendado'], ['postado', 'Postado']], p.status) + '</select></label>' +
      '<label class="campo">Pasta no Drive (link)<input type="url" id="e-pasta" value="' + esc(p.pasta_drive) + '" placeholder="https://drive.google.com/drive/folders/…"></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="e-salvar">Salvar</button></div>');
    document.getElementById('e-salvar').onclick = async function () {
      const pasta = document.getElementById('e-pasta').value.trim();
      if (pasta && !/^https:\/\/(drive|docs)\.google\.com\//.test(pasta)) { toast('Use um link do Google Drive.'); return; }
      const campos = { responsavel: document.getElementById('e-resp').value, tipo_peca: document.getElementById('e-tipo').value,
        editorial: document.getElementById('e-ed').value.trim(), objetivo: document.getElementById('e-obj').value,
        status: document.getElementById('e-status').value, pasta_drive: pasta };
      try { if (!DEMO) await api('salvarPost', { id: id, campos: campos }); Object.assign(p, campos); fecharModal(); render(); toast(DEMO ? 'Alterado só nesta tela (demo).' : 'Post atualizado.'); }
      catch (e) { toast(e.message); }
    };
  }

  function novaMeta() {
    const D = S.dados; const funcoes = Array.from(new Set(D.usuarios.map(function (u) { return u.funcao; }).filter(Boolean)));
    const alvos = {
      geral: [['todas', 'Todas as redes']], rede: Object.keys(REDES).map(function (r) { return [r, REDES[r].nome]; }),
      conta: D.contas.map(function (c) { return [c.id, nomeConta(c.id)]; }), funcao: funcoes, pessoa: D.usuarios.map(function (u) { return [u.email, u.nome]; })
    };
    abrirModal('<h3>Nova meta · ' + nomeMes(S.mes) + '</h3>' +
      '<label class="campo">Para quem<select id="m-escopo">' + opcoes(Object.keys(ESCOPOS).map(function (k) { return [k, ESCOPOS[k]]; }), 'conta') + '</select></label>' +
      '<label class="campo">Qual<select id="m-alvo"></select></label>' +
      '<label class="campo">Métrica<select id="m-metrica">' + opcoes(Object.keys(METRICAS).map(function (k) { return [k, METRICAS[k]]; }), 'posts') + '</select></label>' +
      '<label class="campo">Valor da meta <span class="mini" id="m-dica"></span><input type="number" id="m-valor" min="0" step="any"></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="m-salvar">Criar meta</button></div>');
    const esc_ = document.getElementById('m-escopo'), alvo = document.getElementById('m-alvo'), met = document.getElementById('m-metrica');
    const atualizar = function () { alvo.innerHTML = opcoes(alvos[esc_.value]); document.getElementById('m-dica').textContent = met.value === 'engajamento' ? '(em %, ex.: 3,5)' : ''; };
    esc_.onchange = atualizar; met.onchange = atualizar; atualizar();
    document.getElementById('m-salvar').onclick = async function () {
      let v = parseFloat(String(document.getElementById('m-valor').value).replace(',', '.'));
      if (!isFinite(v) || v <= 0) { toast('Informe um valor maior que zero.'); return; }
      if (met.value === 'engajamento') v = v / 100;
      const meta = { escopo: esc_.value, alvo: alvo.value, metrica: met.value, periodo: S.mes, valor: v };
      try { if (!DEMO) { const r = await api('salvarMeta', { meta: meta }); meta.id = r.id; } else meta.id = 'm' + Date.now();
        S.dados.metas.push(meta); fecharModal(); render(); toast('Meta criada.'); } catch (e) { toast(e.message); }
    };
  }

  async function excluirMeta(id) {
    if (!confirm('Excluir esta meta?')) return;
    try { if (!DEMO) await api('excluirMeta', { id: id }); S.dados.metas = S.dados.metas.filter(function (m) { return m.id !== id; }); render(); toast('Meta excluída.'); }
    catch (e) { toast(e.message); }
  }

  // ---------------------------------------------------------------- login
  function telaLogin() {
    app.innerHTML = '<div class="login-wrap"><div class="login"><div class="marca"><img src="img/logo-branco.png" alt="4blue"></div>' +
      '<h1>4social</h1><p>Painel das redes sociais da 4blue. Entre com sua conta @' + esc(CFG.DOMINIO || '4blue.com.br') + '.</p>' +
      '<div id="botao-google"></div>' + (S.erroLogin ? '<div class="erro">' + esc(S.erroLogin) + '</div>' : '') + '</div></div>';
    if (!CFG.GOOGLE_CLIENT_ID) { document.getElementById('botao-google').innerHTML = '<p class="erro">Falta o GOOGLE_CLIENT_ID no config.js.</p>'; return; }
    const iniciar = function () {
      google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, hd: CFG.DOMINIO, callback: entrarGoogle, ux_mode: 'popup' });
      google.accounts.id.renderButton(document.getElementById('botao-google'), { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-BR' });
    };
    if (window.google && google.accounts) iniciar();
    else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = iniciar; document.head.appendChild(s); }
  }
  async function entrarGoogle(resp) {
    try {
      const r = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'login', credential: resp.credential }) }).then(function (x) { return x.json(); });
      if (!r.ok) throw new Error(r.erro || 'Acesso negado.');
      S.token = r.token; S.user = r.user; guardar('4social_token', r.token); S.erroLogin = '';
      await carregar();
    } catch (e) { S.erroLogin = e.message; telaLogin(); }
  }
  function sair() { S.user = null; S.token = null; S.dados = null; guardar('4social_token', null); if (!DEMO) telaLogin(); }

  async function carregar() {
    app.innerHTML = '<div class="login-wrap"><div class="login"><p>Carregando dados…</p></div></div>';
    const r = await api('dados');
    S.dados = r.dados; S.user = r.user; render();
  }

  // ---------------------------------------------------------------- render
  function render() {
    if (!S.user) { telaLogin(); return; }
    const titulos = { geral: 'Visão geral', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', blog: 'Blog', producao: 'Produção · Branding e Conteúdo', metas: 'Metas', recomendacoes: 'Recomendações', posts: 'Todos os posts', equipe: 'Equipe e acessos' };
    const nRecs = recomendar(S.mes).filter(function (r) { return r.nivel === 'alta' || r.nivel === 'media'; }).length;
    const corpo = { geral: telaGeral, producao: telaProducao, metas: telaMetas, recomendacoes: telaRecs, posts: telaPosts, equipe: telaEquipe }[S.aba];
    const atualizado = S.dados.atualizadoEm ? new Date(S.dados.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    app.innerHTML = '<div class="layout"><aside class="lateral"><div class="logo"><img src="img/logo-branco.png" alt="4blue"></div><div class="logo-sub">4social · redes</div><nav class="menu">' +
      ABAS.filter(function (a) { return a[0] !== 'equipe' || S.user.perfil === 'admin'; }).map(function (a) { if (a[0] === '-') return '<div class="sep"></div>'; return '<button data-aba="' + a[0] + '"' + (S.aba === a[0] ? ' class="ativo"' : '') + '>' + a[1] + (a[0] === 'recomendacoes' && nRecs ? '<span class="contador">' + nRecs + '</span>' : '') + '</button>'; }).join('') +
      '</nav><div class="usuario"><b>' + esc(S.user.nome) + '</b>' + esc(S.user.funcao || '') + (DEMO ? '' : '<br><button id="sair">Sair</button>') + '</div></aside>' +
      '<main class="conteudo">' + (DEMO ? '<div class="faixa-demo"><b>Modo demonstração.</b> Dados fictícios gerados no navegador; nada é salvo.</div>' : '') +
      '<div class="topo"><div><h1>' + titulos[S.aba] + '</h1><p>Dados até ' + atualizado + '</p></div><div class="filtros">' + seletorPeriodo() + '</div></div>' +
      (corpo ? corpo() : telaRede(S.aba)) + '</main></div>';
  }

  app.addEventListener('click', function (e) {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.aba) { S.aba = t.dataset.aba; S.conta = ''; render(); window.scrollTo(0, 0); }
    else if (t.dataset.ir) { S.aba = t.dataset.ir; render(); window.scrollTo(0, 0); }
    else if (t.dataset.editar) editarPost(t.dataset.editar);
    else if (t.dataset.excluirMeta) excluirMeta(t.dataset.excluirMeta);
    else if (t.id === 'nova-meta') novaMeta();
    else if (t.id === 'nova-pessoa') editarPessoa('');
    else if (t.dataset.pessoa) editarPessoa(t.dataset.pessoa);
    else if (t.id === 'sair') sair();
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'f-periodo') { aplicarPreset(e.target.value); render(); }
    else if (e.target.id === 'f-analise') { S.analise = e.target.value; render(); }
    else if (e.target.id === 'f-ini' || e.target.id === 'f-fim') {
      const ini = document.getElementById('f-ini').value, fim = document.getElementById('f-fim').value;
      if (ini && fim && ini <= fim) { S.ini = ini; S.fim = fim; S.preset = 'custom'; S.mes = fim.slice(0, 7); render(); }
      else toast('A data inicial precisa ser antes da final.');
    }
    else if (e.target.id === 'f-conta') { S.conta = e.target.value; render(); }
  });
  app.addEventListener('input', function (e) {
    if (e.target.id === 'f-busca') { S.busca = e.target.value; const pos = e.target.selectionStart; render(); const b = document.getElementById('f-busca'); b.focus(); b.setSelectionRange(pos, pos); }
  });
  document.getElementById('modal').addEventListener('click', function (e) { if (e.target.matches('[data-fechar], .fundo-modal')) fecharModal(); });

  // ---------------------------------------------------------------- início
  aplicarPreset('mes');
  if (DEMO) { S.dados = window.DEMO_DADOS; S.user = S.dados.usuarios[0]; render(); }
  else {
    S.token = ler('4social_token');
    if (S.token) carregar().catch(function () { sair(); }); else telaLogin();
  }
})();
