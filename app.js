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
    ['-'], ['conteudo', 'Pautas e aprovação'], ['tarefas', 'Tarefas'], ['farol', 'Farol'], ['feed', 'Prévia do feed'],
    ['-'], ['producao', 'Produção BC'], ['metas', 'Metas'], ['recomendacoes', 'Recomendações'], ['posts', 'Todos os posts'],
    ['-'], ['equipe', 'Equipe'], ['integracoes', 'Integrações']
  ];
  // objetivo do post: cada post é avaliado pela métrica que ele quer mover
  const OBJETIVOS = { curtidas: 'Curtidas', comentarios: 'Comentários', salvos: 'Salvamentos', compartilhamentos: 'Envios', alcance: 'Alcance' };
  const ANALISES = [['objetivo', 'Objetivo de cada post'], ['alcance', 'Alcance / visualizações'], ['curtidas', 'Curtidas'], ['comentarios', 'Comentários'], ['salvos', 'Salvamentos'], ['compartilhamentos', 'Envios']];
  const METRICAS = {
    posts: 'Posts publicados', alcance: 'Alcance', visualizacoes: 'Visualizações', engajamento: 'Taxa de engajamento',
    interacoes: 'Interações', comentarios: 'Comentários', salvos: 'Salvamentos', compartilhamentos: 'Envios', levantadas: 'Levantadas de mão', seguidores_ganhos: 'Seguidores ganhos',
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
        salvos: soma(pub, function (p) { return num(p.salvos); }), comentarios: soma(pub, function (p) { return num(p.comentarios); }), compart: soma(pub, function (p) { return num(p.compartilhamentos); }),
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
        case 'comentarios': case 'salvos': case 'compartilhamentos': case 'levantadas': return soma(pub, function (p) { return num(p[metrica]); });
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
      const atual = M.valor(meta.metrica, lista) + (meta.metrica === 'levantadas' ? levantadasExtras(meta.periodo + '-01', meta.periodo + '-31', meta) : 0); const alvo = num(meta.valor);
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
        '<td><div class="acoes-post">' + (link ? '<a class="link-drive" href="' + esc(link) + '" target="_blank" rel="noopener">Ver post ↗</a>' : '') + linkDrive(p) + '</div></td>' +
        '<td><button class="btn peq sec" data-editar="' + esc(p.id) + '">Editar</button></td></tr>';
    }).join('');
    return '<div class="tabela-wrap"><table><thead><tr><th>Data</th>' + (opts.semConta ? '' : '<th>Conta</th>') + '<th>Formato</th><th>Post</th><th>Responsável</th><th class="n">Resultado</th><th class="n">Eng.</th><th>Objetivo</th><th class="n" title="Na métrica escolhida em Analisar por: comparado à mediana da mesma conta e formato nos 90 dias anteriores. Curtidas, comentários, salvos e envios são taxas sobre o alcance.">vs média</th><th>Abrir</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
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
    const pa = anterior(); const levAtual = soma(M.postados(doMes), function (p) { return num(p.levantadas); }) + levantadasExtras(S.ini, S.fim);
    const levAnt = soma(M.postados(ant), function (p) { return num(p.levantadas); }) + levantadasExtras(pa.ini, pa.fim);
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
      kpi('Levantadas de mão', fmt(levAtual), delta(levAtual, levAnt) + ' ' + fmt(a.comentarios) + ' comentários') + '</div>' +
      cardParaHoje() +
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
      (rede !== 'blog' ? cardHorarios(D.posts.filter(filtro)) : '') +
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
      '<label class="campo">Aniversário (dd/mm)<input type="text" id="u-aniv" maxlength="5" placeholder="25/12" value="' + esc(u.aniversario || '') + '"></label>' +
      '<label class="campo">Entrada na 4blue<input type="date" id="u-entrada" value="' + esc(String(u.entrada || '').slice(0, 10)) + '"></label>' +
      '<label class="campo">Ativo<select id="u-ativo">' + opcoes([['sim', 'Sim'], ['não', 'Não (bloqueia o acesso)']], u.ativo === 'não' ? 'não' : 'sim') + '</select></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="u-salvar">Salvar</button></div>');
    document.getElementById('u-salvar').onclick = async function () {
      const dados = { email: document.getElementById('u-email').value.trim().toLowerCase(), nome: document.getElementById('u-nome').value.trim(),
        funcao: document.getElementById('u-funcao').value, perfil: document.getElementById('u-perfil').value,
        pode_metas: document.getElementById('u-metas').value, ativo: document.getElementById('u-ativo').value,
        aniversario: document.getElementById('u-aniv').value.trim(), entrada: document.getElementById('u-entrada').value };
      if (dados.aniversario && !/^\d{2}\/\d{2}$/.test(dados.aniversario)) { toast('Aniversário no formato dd/mm.'); return; }
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

  // ================================================================ operação do time: farol, tarefas, pautas, feed, integrações
  const STATUS_PAUTA = [['sugerida', 'Sugeridas'], ['aprovada', 'Em produção'], ['aprovacao', 'Aguardando aprovação'], ['ajustes', 'Ajustes'], ['agendada', 'Agendadas'], ['postada', 'Postadas']];
  const SO_APROVADOR = ['aprovada', 'agendada', 'recusada'];
  const FAROL_FAIXAS = [['feriado', 'Feriados e datas', 'f-feriado'], ['folga', 'Férias, folgas e nivers', 'f-folga'], ['evento', 'Eventos paralelos', 'f-evento'], ['campanha', 'Campanhas', 'f-campanha']];
  const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  function lista(n) { if (!S.dados[n]) S.dados[n] = []; return S.dados[n]; }
  function podeAprovar() { return S.user.perfil === 'admin' || S.user.pode_metas === 'sim'; }
  function hojeISO() { return isoDe(hoje); }
  function dataLonga(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''); }

  // grava em qualquer coleção do backend (Tarefas, Pautas, Farol, Levantadas, Contas)
  async function gravar(colecao, item) {
    if (!DEMO) { const r = await api('salvarItem', { colecao: colecao, item: item }); if (r.id) item.id = r.id; }
    else if (!item.id) item.id = colecao.slice(0, 2).toLowerCase() + Date.now();
    const l = lista(colecao.toLowerCase()); const i = l.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) Object.assign(l[i], item); else l.push(item);
    return item;
  }
  async function apagar(colecao, id) {
    if (!DEMO) await api('excluirItem', { colecao: colecao, id: id });
    S.dados[colecao.toLowerCase()] = lista(colecao.toLowerCase()).filter(function (x) { return x.id !== id; });
  }

  // ---- levantadas de mão que não vêm de comentário de post (Kaizen ou registro manual)
  function levantadasExtras(ini, fim, meta) {
    return lista('levantadas').filter(function (l) {
      const d = String(l.data).slice(0, 10); if (d < ini || d > fim) return false;
      if (!meta || meta.escopo === 'geral') return true;
      if (meta.escopo === 'rede') return (l.rede || 'instagram') === meta.alvo;
      if (meta.escopo === 'conta') return l.conta === meta.alvo;
      return false;
    }).length;
  }

  // ---- datas automáticas: feriados nacionais e datas comemorativas (calculadas, sem digitar)
  function pascoa(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  function enesimoDia(y, mes, diaSemana, n) { const d = new Date(y, mes, 1); return new Date(y, mes, 1 + ((7 + diaSemana - d.getDay()) % 7) + 7 * (n - 1)); }
  const memoDatas = {};
  function datasAuto(ano) {
    if (memoDatas[ano]) return memoDatas[ano];
    const P = pascoa(ano); const mais = function (n) { const x = new Date(P); x.setDate(x.getDate() + n); return isoDe(x); };
    const r = [];
    [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência do Brasil'], ['10-12', 'Nossa Senhora Aparecida'],
      ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Dia da Consciência Negra'], ['12-25', 'Natal']]
      .forEach(function (f) { r.push({ data: ano + '-' + f[0], titulo: f[1], feriado: true }); });
    r.push({ data: mais(-48), titulo: 'Carnaval', feriado: true }, { data: mais(-47), titulo: 'Carnaval', feriado: true }, { data: mais(-2), titulo: 'Sexta-feira Santa', feriado: true },
      { data: mais(0), titulo: 'Páscoa' }, { data: mais(60), titulo: 'Corpus Christi (ponto facultativo)' });
    [['03-08', 'Dia Internacional da Mulher'], ['03-15', 'Dia do Consumidor'], ['04-25', 'Dia do Contador'], ['05-25', 'Dia da Indústria'], ['06-12', 'Dia dos Namorados'],
      ['07-20', 'Dia do Amigo'], ['09-15', 'Dia do Cliente'], ['10-05', 'Dia da Micro e Pequena Empresa'], ['10-15', 'Dia do Professor'], ['11-19', 'Dia do Empreendedorismo Feminino'], ['12-31', 'Réveillon']]
      .forEach(function (f) { r.push({ data: ano + '-' + f[0], titulo: f[1] }); });
    r.push({ data: isoDe(enesimoDia(ano, 4, 0, 2)), titulo: 'Dia das Mães' }, { data: isoDe(enesimoDia(ano, 7, 0, 2)), titulo: 'Dia dos Pais' });
    const bf = enesimoDia(ano, 10, 4, 4); bf.setDate(bf.getDate() + 1); r.push({ data: isoDe(bf), titulo: 'Black Friday (mercado)' });
    return (memoDatas[ano] = r);
  }
  function aniversarios(ano) {
    const r = [];
    S.dados.usuarios.filter(function (u) { return u.ativo !== 'não'; }).forEach(function (u) {
      const a = String(u.aniversario || '').match(/^(\d{2})\/(\d{2})$/);
      if (a) r.push({ data: ano + '-' + a[2] + '-' + a[1], titulo: 'Niver ' + String(u.nome).split(' ')[0], tipo: 'niver', pessoa: u.email });
      const e = String(u.entrada || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (e && Number(e[1]) < ano) r.push({ data: ano + '-' + e[2] + '-' + e[3], titulo: String(u.nome).split(' ')[0] + ': ' + (ano - Number(e[1])) + ' ano(s) de casa', tipo: 'casa', pessoa: u.email });
    });
    return r;
  }
  // tudo o que cai num dia, por faixa
  function itensDoDia(iso) {
    const ano = Number(iso.slice(0, 4)); const out = { feriado: [], folga: [], evento: [], campanha: [] };
    datasAuto(ano).filter(function (d) { return d.data === iso; }).forEach(function (d) { out.feriado.push({ titulo: d.titulo + (d.feriado ? ' *' : ''), auto: true, feriado: d.feriado }); });
    aniversarios(ano).filter(function (d) { return d.data === iso; }).forEach(function (d) { out.folga.push({ titulo: d.titulo, auto: true, niver: true }); });
    lista('farol').forEach(function (f) { if (iso >= f.ini && iso <= (f.fim || f.ini) && out[f.tipo]) out[f.tipo].push(f); });
    return out;
  }
  function pessoasForaNoDia(iso) { return itensDoDia(iso).folga.filter(function (f) { return !f.auto; }).map(function (f) { return f.pessoa || f.titulo; }); }
  // farol da semana: verde, amarelo ou vermelho, com o motivo
  function farolSemana(dias) {
    const motivos = []; let pontos = 0; const fora = new Set(); let campanha = false, feriadoUtil = false;
    dias.forEach(function (d, i) {
      const it = itensDoDia(d);
      if (it.campanha.length) campanha = true;
      if (i < 5 && it.feriado.some(function (f) { return f.feriado; })) feriadoUtil = true;
      it.folga.filter(function (f) { return !f.auto; }).forEach(function (f) { fora.add(f.pessoa || f.titulo); });
    });
    if (campanha) { pontos++; motivos.push('campanha no ar'); }
    if (fora.size) { pontos++; motivos.push(fora.size + ' pessoa(s) de folga ou férias'); }
    if (fora.size >= 2) pontos++;
    if (feriadoUtil) { pontos++; motivos.push('feriado em dia útil'); }
    const conflitos = lista('pautas').filter(function (p) { return p.data_prevista && dias.indexOf(p.data_prevista) >= 0 && p.responsavel && pessoasForaNoDia(p.data_prevista).some(function (x) { return x === p.responsavel || String(x).toLowerCase().indexOf(String(nomePessoa(p.responsavel)).split(' ')[0].toLowerCase()) >= 0; }); });
    if (conflitos.length) { pontos += 2; motivos.push(conflitos.length + ' pauta(s) com responsável de folga'); }
    return { cor: pontos >= 2 ? 'vermelho' : pontos === 1 ? 'amarelo' : 'verde', motivos: motivos.length ? motivos : ['semana tranquila'] };
  }
  // alertas automáticos dos próximos dias
  function alertasFarol(dias) {
    const r = []; const h = hojeISO();
    for (let i = 0; i <= dias; i++) {
      const d = somaDias(h, i); const it = itensDoDia(d);
      it.feriado.forEach(function (f) { if (i >= 3) r.push({ d: d, tipo: 'data', texto: f.titulo.replace(' *', ''), dica: f.feriado ? 'Feriado: antecipe a programação' : 'Data comemorativa: vale um post', pauta: !f.feriado || /Natal|Réveillon/.test(f.titulo) }); });
      it.folga.forEach(function (f) { if (f.niver) r.push({ d: d, tipo: 'niver', texto: f.titulo, dica: 'Arte para o grupo interno' }); });
      it.campanha.forEach(function (f) { if (f.ini === d) r.push({ d: d, tipo: 'campanha', texto: 'Começa: ' + f.titulo, dica: 'Confira pautas e artes da campanha' }); });
      it.folga.forEach(function (f) { if (!f.auto && f.ini === d) r.push({ d: d, tipo: 'folga', texto: f.titulo, dica: 'Redistribua as entregas desses dias' }); });
    }
    return r;
  }

  // ---- visão geral: o que precisa de atenção hoje
  function cardParaHoje() {
    const minhas = lista('tarefas').filter(function (t) { return t.status !== 'feita' && (!t.responsavel || t.responsavel === S.user.email); })
      .sort(function (a, b) { return String(a.prazo || '9').localeCompare(String(b.prazo || '9')); }).slice(0, 5);
    const aprovar = podeAprovar() ? lista('pautas').filter(function (p) { return p.status === 'aprovacao' || p.status === 'sugerida'; }) : lista('pautas').filter(function (p) { return p.status === 'ajustes' && p.responsavel === S.user.email; });
    const alertas = alertasFarol(14).slice(0, 5);
    const h = hojeISO();
    const colTarefas = minhas.length ? minhas.map(function (t) { return '<li><label class="chk"><input type="checkbox" data-feita="' + esc(t.id) + '"> <span>' + esc(t.titulo) + '</span></label>' + (t.prazo ? '<span class="mini' + (t.prazo < h ? ' abaixo' : '') + '"> ' + dataBR(t.prazo) + '</span>' : '') + '</li>'; }).join('') : '<li class="mini">Nada pendente.</li>';
    const colPautas = aprovar.length ? aprovar.slice(0, 5).map(function (p) { return '<li><button class="link" data-pauta="' + esc(p.id) + '">' + esc(p.titulo) + '</button> <span class="pill">' + esc((STATUS_PAUTA.filter(function (s) { return s[0] === p.status; })[0] || [0, p.status])[1]) + '</span></li>'; }).join('') : '<li class="mini">Nenhuma pauta esperando você.</li>';
    const colFarol = alertas.length ? alertas.map(function (a) { return '<li><b>' + dataBR(a.d) + '</b> ' + esc(a.texto) + '<div class="mini">' + esc(a.dica) + '</div></li>'; }).join('') : '<li class="mini">Sem datas nos próximos 14 dias.</li>';
    return '<div class="card secao"><h2>Para hoje<small>' + dataLonga(h) + '</small></h2><div class="grade g3 hoje">' +
      '<div><h3>Minhas tarefas <button class="btn peq sec" data-ir="tarefas">Abrir</button></h3><ul class="lista">' + colTarefas + '</ul></div>' +
      '<div><h3>' + (podeAprovar() ? 'Pautas para aprovar' : 'Meus ajustes') + ' <button class="btn peq sec" data-ir="conteudo">Abrir</button></h3><ul class="lista">' + colPautas + '</ul></div>' +
      '<div><h3>Farol · próximos 14 dias <button class="btn peq sec" data-ir="farol">Abrir</button></h3><ul class="lista">' + colFarol + '</ul></div></div></div>';
  }

  // ---- horários de pico (mediana do resultado por dia da semana e hora, 90 dias)
  function cardHorarios(posts) {
    const ini = somaDias(hojeISO(), -90);
    const l = M.postados(posts).filter(function (p) { return p.hora && String(p.data) >= ini && M.resultado(p) > 0; });
    if (l.length < 8) return '';
    const horas = Array.from(new Set(l.map(function (p) { return p.hora.slice(0, 2); }))).sort();
    const cel = {}; l.forEach(function (p) { const dw = (new Date(p.data + 'T12:00').getDay() + 6) % 7; const k = dw + '|' + p.hora.slice(0, 2); (cel[k] = cel[k] || []).push(M.resultado(p)); });
    const meds = {}; Object.keys(cel).forEach(function (k) { meds[k] = mediana(cel[k]); });
    const max = Math.max.apply(null, Object.keys(meds).map(function (k) { return meds[k]; }));
    const topo = Object.keys(meds).sort(function (a, b) { return meds[b] - meds[a]; })[0].split('|');
    return '<div class="card secao"><h2>Horários de pico<small>mediana do resultado por post · 90 dias · melhor: ' + DIAS_SEM[topo[0]] + ' ' + topo[1] + 'h</small></h2><div class="tabela-wrap"><table class="calor"><thead><tr><th></th>' +
      horas.map(function (h) { return '<th class="n">' + h + 'h</th>'; }).join('') + '</tr></thead><tbody>' +
      DIAS_SEM.map(function (d, i) {
        return '<tr><td><b>' + d + '</b></td>' + horas.map(function (h) {
          const v = meds[i + '|' + h]; if (v == null) return '<td class="n vazio-cel">·</td>';
          const a = 0.12 + 0.88 * v / max; return '<td class="n" style="background:rgba(0,114,206,' + a.toFixed(2) + ');color:' + (a > 0.55 ? '#fff' : 'var(--texto)') + '" title="' + cel[i + '|' + h].length + ' posts">' + fmtC(v) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  // ---- Tarefas
  function telaTarefas() {
    const so = S.filtroTarefas || 'minhas';
    const l = lista('tarefas').filter(function (t) { return so === 'todas' || !t.responsavel || t.responsavel === S.user.email; });
    const abertas = l.filter(function (t) { return t.status !== 'feita'; }).sort(function (a, b) { return String(a.prazo || '9').localeCompare(String(b.prazo || '9')); });
    const feitas = l.filter(function (t) { return t.status === 'feita'; }).sort(function (a, b) { return String(b.feita_em || '').localeCompare(String(a.feita_em || '')); }).slice(0, 30);
    const h = hojeISO();
    const linha = function (t) {
      return '<li class="tarefa' + (t.status === 'feita' ? ' feita' : '') + '"><label class="chk"><input type="checkbox" data-feita="' + esc(t.id) + '"' + (t.status === 'feita' ? ' checked' : '') + '></label>' +
        '<button class="link" data-tarefa="' + esc(t.id) + '">' + esc(t.titulo) + '</button>' +
        '<span class="mini">' + esc(nomePessoa(t.responsavel)) + (t.prazo ? ' · <span class="' + (t.prazo < h && t.status !== 'feita' ? 'abaixo' : '') + '">' + dataBR(t.prazo) + '</span>' : '') + '</span></li>';
    };
    const pessoas = [['', 'Sem responsável']].concat(S.dados.usuarios.filter(function (u) { return u.ativo !== 'não'; }).map(function (u) { return [u.email, u.nome]; }));
    return '<div class="card"><div class="nova-tarefa"><input type="text" id="t-titulo" placeholder="Nova tarefa (ex.: layout do carrossel de pró-labore)">' +
      '<select id="t-resp">' + opcoes(pessoas, S.user.email) + '</select><input type="date" id="t-prazo"><button class="btn prim" id="t-add">Adicionar</button></div></div>' +
      '<div class="filtros secao"><select id="f-tarefas">' + opcoes([['minhas', 'Minhas e sem responsável'], ['todas', 'Todas da equipe']], so) + '</select></div>' +
      '<div class="grade g2 secao"><div class="card"><h2>Para fazer<small>' + abertas.length + '</small></h2><ul class="lista">' + (abertas.map(linha).join('') || '<li class="mini">Tudo em dia.</li>') + '</ul></div>' +
      '<div class="card"><h2>Feitas<small>últimas ' + feitas.length + '</small></h2><ul class="lista">' + (feitas.map(linha).join('') || '<li class="mini">Nada concluído ainda.</li>') + '</ul></div></div>';
  }
  function editarTarefa(id) {
    const t = lista('tarefas').filter(function (x) { return x.id === id; })[0]; if (!t) return;
    const pessoas = [['', 'Sem responsável']].concat(S.dados.usuarios.map(function (u) { return [u.email, u.nome]; }));
    abrirModal('<h3>Tarefa</h3><label class="campo">Título<input type="text" id="te-tit" value="' + esc(t.titulo) + '"></label>' +
      '<label class="campo">Detalhes<textarea id="te-det" rows="4">' + esc(t.detalhe || '') + '</textarea></label>' +
      '<label class="campo">Responsável<select id="te-resp">' + opcoes(pessoas, t.responsavel) + '</select></label><label class="campo">Prazo<input type="date" id="te-prazo" value="' + esc(t.prazo || '') + '"></label>' +
      '<div class="acoes"><button class="btn sec perigo" id="te-del">Excluir</button><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="te-ok">Salvar</button></div>');
    document.getElementById('te-ok').onclick = async function () {
      try { await gravar('Tarefas', Object.assign({}, t, { titulo: document.getElementById('te-tit').value.trim() || t.titulo, detalhe: document.getElementById('te-det').value.trim(), responsavel: document.getElementById('te-resp').value, prazo: document.getElementById('te-prazo').value })); fecharModal(); render(); } catch (e) { toast(e.message); }
    };
    document.getElementById('te-del').onclick = async function () { if (!confirm('Excluir a tarefa?')) return; try { await apagar('Tarefas', id); fecharModal(); render(); } catch (e) { toast(e.message); } };
  }

  // ---- Pautas e aprovação (banco de pautas → produção → aprovação → agendada → postada)
  function telaConteudo() {
    const l = lista('pautas');
    return '<p class="mini" style="margin-bottom:12px">Qualquer pessoa sugere pautas. ' + (podeAprovar() ? 'Você aprova, pede ajustes e agenda.' : 'Gestão e quem ela liberar aprovam e agendam.') + ' Os comentários ficam no card.</p>' +
      '<div style="margin-bottom:14px"><button class="btn prim" id="nova-pauta">+ Sugerir pauta</button></div>' +
      '<div class="kanban">' + STATUS_PAUTA.map(function (st) {
        const cards = l.filter(function (p) { return p.status === st[0]; }).sort(function (a, b) { return String(a.data_prevista || '9').localeCompare(String(b.data_prevista || '9')); });
        return '<div class="coluna"><h3>' + st[1] + ' <span class="mini">' + cards.length + '</span></h3>' + cards.slice(0, 40).map(function (p) {
          const com = comentariosDe(p).length;
          return '<button class="cartao" data-pauta="' + esc(p.id) + '"><b>' + esc(p.titulo) + '</b><span class="mini">' + esc([(REDES[p.rede] || {}).nome, p.formato].filter(Boolean).join(' · ')) + '</span>' +
            '<span class="linha-cartao">' + (OBJETIVOS[p.objetivo] ? '<span class="pill obj">' + OBJETIVOS[p.objetivo] + '</span>' : '') + (p.data_prevista ? '<span class="pill">' + dataBR(p.data_prevista) + '</span>' : '') + (com ? '<span class="pill">💬 ' + com + '</span>' : '') + '</span>' +
            '<span class="mini">' + esc(p.responsavel ? nomePessoa(p.responsavel) : 'sem responsável') + '</span></button>';
        }).join('') + '</div>';
      }).join('') + '</div>';
  }
  function comentariosDe(p) { try { return JSON.parse(p.comentarios || '[]'); } catch (e) { return []; } }
  function editarPauta(id, base) {
    const p = id ? lista('pautas').filter(function (x) { return x.id === id; })[0] : Object.assign({ status: 'sugerida', sugerido_por: S.user.email, rede: 'instagram' }, base || {});
    if (!p) return;
    const pessoas = [['', 'Sem responsável']].concat(S.dados.usuarios.filter(function (u) { return u.ativo !== 'não'; }).map(function (u) { return [u.email, u.nome]; }));
    const contas = [['', '—']].concat(S.dados.contas.filter(function (c) { return !p.rede || c.rede === p.rede; }).map(function (c) { return [c.id, nomeConta(c.id)]; }));
    const proximos = { sugerida: podeAprovar() ? [['aprovada', 'Aprovar pauta'], ['recusada', 'Recusar']] : [],
      aprovada: [['aprovacao', 'Enviar para aprovação']], ajustes: [['aprovacao', 'Reenviar para aprovação']],
      aprovacao: podeAprovar() ? [['agendada', 'Aprovar e agendar'], ['ajustes', 'Pedir ajustes']] : [], agendada: [['postada', 'Marcar como postada']], postada: [], recusada: podeAprovar() ? [['sugerida', 'Reabrir']] : [] }[p.status] || [];
    const coms = comentariosDe(p);
    abrirModal('<h3>' + (id ? 'Pauta' : 'Sugerir pauta') + '</h3>' +
      (id ? '<p class="mini" style="margin:-8px 0 12px">Sugerida por ' + esc(nomePessoa(p.sugerido_por)) + ' · status: ' + esc((STATUS_PAUTA.filter(function (s) { return s[0] === p.status; })[0] || [0, p.status])[1]) + '</p>' : '') +
      '<label class="campo">Tema / título<input type="text" id="pa-tit" value="' + esc(p.titulo || '') + '"></label>' +
      '<label class="campo">Ideia, roteiro ou referência<textarea id="pa-desc" rows="4">' + esc(p.descricao || '') + '</textarea></label>' +
      '<div class="dois"><label class="campo">Rede<select id="pa-rede">' + opcoes(Object.keys(REDES).map(function (r) { return [r, REDES[r].nome]; }), p.rede) + '</select></label>' +
      '<label class="campo">Conta<select id="pa-conta">' + opcoes(contas, p.conta || '') + '</select></label></div>' +
      '<div class="dois"><label class="campo">Formato<input type="text" id="pa-fmt" value="' + esc(p.formato || '') + '" placeholder="Reels, Carrossel…"></label>' +
      '<label class="campo">Objetivo<select id="pa-obj">' + opcoes([['', '—']].concat(Object.keys(OBJETIVOS).map(function (k) { return [k, OBJETIVOS[k]]; })), p.objetivo || '') + '</select></label></div>' +
      '<div class="dois"><label class="campo">Responsável<select id="pa-resp">' + opcoes(pessoas, p.responsavel || '') + '</select></label>' +
      '<label class="campo">Data prevista<input type="date" id="pa-data" value="' + esc(p.data_prevista || '') + '"></label></div>' +
      '<label class="campo">Pasta no Drive<input type="url" id="pa-pasta" value="' + esc(p.pasta_drive || '') + '" placeholder="https://drive.google.com/…"></label>' +
      '<label class="campo">Link do post publicado<input type="url" id="pa-link" value="' + esc(p.link || '') + '" placeholder="https://www.instagram.com/p/…"></label>' +
      (id ? '<div class="comentarios"><b>Comentários</b>' + (coms.length ? coms.map(function (c) { return '<div class="com"><span class="mini">' + esc(nomePessoa(c.por)) + ' · ' + esc(String(c.em).slice(0, 16).replace('T', ' ')) + '</span><p>' + esc(c.texto) + '</p></div>'; }).join('') : '<p class="mini">Nenhum comentário.</p>') +
        '<textarea id="pa-com" rows="2" placeholder="Comentário de aprovação ou ajuste"></textarea></div>' : '') +
      '<div class="acoes quebra">' + proximos.map(function (n) { return '<button class="btn sec" data-mover="' + n[0] + '">' + n[1] + '</button>'; }).join('') +
      (id && (podeAprovar() || p.sugerido_por === S.user.email) ? '<button class="btn sec perigo" id="pa-del">Excluir</button>' : '') +
      '<button class="btn sec" data-fechar>Fechar</button><button class="btn prim" id="pa-ok">Salvar</button></div>');
    const coletar = function (status) {
      const pasta = document.getElementById('pa-pasta').value.trim(), link = document.getElementById('pa-link').value.trim();
      if (pasta && !/^https:\/\/(drive|docs)\.google\.com\//.test(pasta)) throw new Error('A pasta precisa ser um link do Google Drive.');
      if (link && !/^https:\/\//.test(link)) throw new Error('O link do post precisa começar com https://');
      const novo = Object.assign({}, p, { titulo: document.getElementById('pa-tit').value.trim(), descricao: document.getElementById('pa-desc').value.trim(), rede: document.getElementById('pa-rede').value,
        conta: document.getElementById('pa-conta').value, formato: document.getElementById('pa-fmt').value.trim(), objetivo: document.getElementById('pa-obj').value,
        responsavel: document.getElementById('pa-resp').value, data_prevista: document.getElementById('pa-data').value, pasta_drive: pasta, link: link, status: status || p.status });
      if (!novo.titulo) throw new Error('Dê um título à pauta.');
      const txt = id ? document.getElementById('pa-com').value.trim() : '';
      if (txt || (status && status !== p.status)) { const c = comentariosDe(p); c.push({ por: S.user.email, em: new Date().toISOString(), texto: (status && status !== p.status ? '[' + (STATUS_PAUTA.filter(function (s) { return s[0] === status; })[0] || [0, status])[1] + '] ' : '') + txt }); novo.comentarios = JSON.stringify(c.slice(-50)); }
      return novo;
    };
    const salvar = async function (status) { try { await gravar('Pautas', coletar(status)); fecharModal(); render(); toast('Pauta salva.'); } catch (e) { toast(e.message); } };
    document.getElementById('pa-ok').onclick = function () { salvar(); };
    document.querySelectorAll('[data-mover]').forEach(function (b) { b.onclick = function () { salvar(b.dataset.mover); }; });
    document.getElementById('pa-rede').onchange = function () { const r = this.value; document.getElementById('pa-conta').innerHTML = opcoes([['', '—']].concat(S.dados.contas.filter(function (c) { return c.rede === r; }).map(function (c) { return [c.id, nomeConta(c.id)]; })), ''); };
    const del = document.getElementById('pa-del'); if (del) del.onclick = async function () { if (!confirm('Excluir a pauta?')) return; try { await apagar('Pautas', id); fecharModal(); render(); } catch (e) { toast(e.message); } };
  }

  // ---- Farol (cronograma do time: feriados e datas, folgas e nivers, eventos, campanhas)
  function telaFarol() {
    const mes = S.mes; const p = mes.split('-').map(Number);
    const primeiro = new Date(p[0], p[1] - 1, 1); const inicio = new Date(primeiro); inicio.setDate(1 - ((primeiro.getDay() + 6) % 7));
    const semanas = []; for (let d = new Date(inicio); d.getMonth() <= p[1] - 1 || d.getFullYear() < p[0]; d.setDate(d.getDate() + 7)) {
      if (d.getFullYear() > p[0]) break; const s = []; for (let i = 0; i < 7; i++) { const x = new Date(d); x.setDate(x.getDate() + i); s.push(isoDe(x)); } semanas.push(s); if (semanas.length > 6) break;
    }
    const h = hojeISO();
    const postsDia = {}; S.dados.posts.forEach(function (q) { const d = String(q.data).slice(0, 10); postsDia[d] = (postsDia[d] || 0) + 1; });
    const pautasDia = {}; lista('pautas').forEach(function (q) { if (q.data_prevista && q.status !== 'postada' && q.status !== 'recusada') pautasDia[q.data_prevista] = (pautasDia[q.data_prevista] || 0) + 1; });
    const corpo = semanas.map(function (s) {
      const f = farolSemana(s); const its = s.map(itensDoDia);
      return '<tbody class="semana"><tr class="dias"><th><span class="farol ' + f.cor + '" title="' + esc(f.motivos.join(' · ')) + '"></span><span class="mini">' + esc(f.motivos[0]) + '</span></th>' +
        s.map(function (d) { return '<th class="' + (d.slice(0, 7) !== mes ? 'fora-mes' : '') + (d === h ? ' hoje' : '') + '">' + Number(d.slice(8)) + (postsDia[d] || pautasDia[d] ? '<span class="mini"> · ' + (postsDia[d] || 0) + ' post' + (pautasDia[d] ? ' + ' + pautasDia[d] + ' pauta' : '') + '</span>' : '') + '</th>'; }).join('') + '</tr>' +
        FAROL_FAIXAS.map(function (fx) {
          return '<tr class="' + fx[2] + '"><td class="faixa">' + fx[1] + '</td>' + its.map(function (it, i) {
            return '<td data-dia="' + s[i] + '" data-tipo="' + fx[0] + '">' + it[fx[0]].map(function (x) { return x.id ? '<button class="chip" data-farol="' + esc(x.id) + '">' + esc(x.titulo) + '</button>' : '<span class="chip auto">' + esc(x.titulo) + '</span>'; }).join('') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>';
    }).join('');
    const alertas = alertasFarol(21);
    return '<p class="mini" style="margin-bottom:12px">Feriados, datas comemorativas, aniversários e tempo de casa entram sozinhos (da tela Equipe). Dê dois cliques num dia para adicionar folga, evento ou campanha. A luz de cada semana avisa quando há campanha, gente de folga, feriado útil ou pauta com responsável ausente.</p>' +
      '<div style="margin-bottom:14px"><button class="btn prim" id="novo-farol">+ Adicionar ao farol</button></div>' +
      '<div class="card farol-card"><div class="tabela-wrap"><table class="farol-tab"><thead><tr><th>' + nomeMes(mes) + '</th>' + DIAS_SEM.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead>' + corpo + '</table></div></div>' +
      '<div class="card secao"><h2>Próximos 21 dias<small>avisos automáticos</small></h2>' + (alertas.length ? '<ul class="lista">' + alertas.map(function (a) {
        return '<li><b>' + dataLonga(a.d) + '</b> · ' + esc(a.texto) + ' <span class="mini">' + esc(a.dica) + '</span>' + (a.pauta ? ' <button class="btn peq sec" data-pauta-data="' + a.d + '" data-pauta-tema="' + esc(a.texto) + '">Criar pauta</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<div class="vazio-msg">Nada nos próximos 21 dias.</div>') + '</div>';
  }
  function editarFarol(id, base) {
    const f = id ? lista('farol').filter(function (x) { return x.id === id; })[0] : Object.assign({ tipo: 'campanha', ini: hojeISO(), fim: hojeISO() }, base || {});
    if (!f) return;
    const pessoas = [['', '—']].concat(S.dados.usuarios.map(function (u) { return [u.email, u.nome]; }));
    abrirModal('<h3>' + (id ? 'Editar' : 'Adicionar ao farol') + '</h3>' +
      '<label class="campo">Faixa<select id="fa-tipo">' + opcoes(FAROL_FAIXAS.map(function (x) { return [x[0], x[1]]; }), f.tipo) + '</select></label>' +
      '<label class="campo">Descrição<input type="text" id="fa-tit" value="' + esc(f.titulo || '') + '" placeholder="Ex.: Black Friday, Férias da Ana, Evento em SP"></label>' +
      '<div class="dois"><label class="campo">De<input type="date" id="fa-ini" value="' + esc(f.ini) + '"></label><label class="campo">Até<input type="date" id="fa-fim" value="' + esc(f.fim || f.ini) + '"></label></div>' +
      '<label class="campo">Pessoa (para folgas e férias)<select id="fa-pes">' + opcoes(pessoas, f.pessoa || '') + '</select></label>' +
      '<div class="acoes">' + (id ? '<button class="btn sec perigo" id="fa-del">Excluir</button>' : '') + '<button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="fa-ok">Salvar</button></div>');
    document.getElementById('fa-ok').onclick = async function () {
      const n = Object.assign({}, f, { tipo: document.getElementById('fa-tipo').value, titulo: document.getElementById('fa-tit').value.trim(), ini: document.getElementById('fa-ini').value, fim: document.getElementById('fa-fim').value || document.getElementById('fa-ini').value, pessoa: document.getElementById('fa-pes').value });
      if (!n.titulo || !n.ini || n.fim < n.ini) { toast('Preencha a descrição e um período válido.'); return; }
      try { await gravar('Farol', n); fecharModal(); render(); } catch (e) { toast(e.message); }
    };
    const del = document.getElementById('fa-del'); if (del) del.onclick = async function () { if (!confirm('Excluir do farol?')) return; try { await apagar('Farol', id); fecharModal(); render(); } catch (e) { toast(e.message); } };
  }

  // ---- Prévia do feed (publicados + agendados, grade de 3)
  function telaFeed() {
    const contas = S.dados.contas.filter(function (c) { return c.rede === 'instagram'; });
    if (!contas.length) return '<div class="card"><div class="vazio-msg">Cadastre uma conta do Instagram em Integrações.</div></div>';
    const cid = S.contaFeed && contas.some(function (c) { return c.id === S.contaFeed; }) ? S.contaFeed : contas[0].id;
    const futuros = lista('pautas').filter(function (p) { return p.rede === 'instagram' && (!p.conta || p.conta === cid) && ['agendada', 'aprovacao', 'ajustes', 'aprovada'].indexOf(p.status) >= 0 && p.data_prevista >= hojeISO(); })
      .sort(function (a, b) { return b.data_prevista.localeCompare(a.data_prevista); });
    const publicados = S.dados.posts.filter(function (p) { return p.conta === cid && p.status === 'postado' && p.formato !== 'Stories'; })
      .sort(function (a, b) { return (b.data + b.hora).localeCompare(a.data + a.hora); }).slice(0, 30 - Math.min(12, futuros.length));
    const tile = function (x, futuro) {
      const img = urlSegura(x.thumb);
      return '<div class="tile' + (futuro ? ' futuro' : '') + '"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : '') + '>' +
        (img ? '' : '<span class="tile-txt">' + esc(x.titulo) + '</span>') + '<span class="tile-rot">' + (futuro ? (x.status === 'agendada' ? 'Agendado ' : 'Previsto ') + dataBR(x.data_prevista) : dataBR(x.data) + ' · ' + esc(x.formato)) + '</span>' +
        (futuro ? '<button class="tile-btn" data-pauta="' + esc(x.id) + '">abrir</button>' : (urlSegura(x.link) ? '<a class="tile-btn" href="' + esc(x.link) + '" target="_blank" rel="noopener">ver</a>' : '')) + '</div>';
    };
    return '<div class="filtros" style="margin-bottom:14px"><select id="f-feed">' + opcoes(contas.map(function (c) { return [c.id, c.nome]; }), cid) + '</select><span class="mini">' + futuros.length + ' previstos/agendados (tracejado) + publicados</span></div>' +
      '<div class="feed">' + futuros.map(function (x) { return tile(x, true); }).join('') + publicados.map(function (x) { return tile(x, false); }).join('') + '</div>';
  }

  // ---- Integrações (só gestão): credenciais em Propriedades do script, contas, palavras-gatilho, Kaizen
  const INTEGRACOES = [
    { id: 'instagram', nome: 'Instagram (Meta)', campos: [['IG_TOKEN', 'Token do usuário do sistema', true], ['GRAPH_VERSAO', 'Versão da Graph API', false]],
      ajuda: 'Business Manager > Configurações > Usuários do sistema: crie um usuário somente leitura, dê acesso às contas do Instagram e gere o token com instagram_basic, instagram_manage_insights, instagram_manage_comments e pages_read_engagement. O ID de cada conta vai em Contas, abaixo.' },
    { id: 'youtube', nome: 'YouTube', campos: [], ajuda: 'Usa a conta Google dona do script. Ela precisa ser dona ou gerente do canal, e os serviços YouTube Data API e YouTube Analytics precisam estar ativos no editor do Apps Script.' },
    { id: 'tiktok', nome: 'TikTok', campos: [['TIKTOK_CLIENT_KEY', 'Client key', false], ['TIKTOK_CLIENT_SECRET', 'Client secret', true], ['TIKTOK_REFRESH_TOKEN', 'Refresh token', true]],
      ajuda: 'App no TikTok for Developers com Login Kit e Display API (aprovação leva alguns dias). Até lá, cole o export do TikTok Studio na aba Importar_TikTok da planilha.' },
    { id: 'linkedin', nome: 'LinkedIn', campos: [], ajuda: 'A API de páginas exige aprovação do LinkedIn. Por enquanto, exporte o conteúdo da página e cole na aba Importar_LinkedIn da planilha.' },
    { id: 'blog', nome: 'Blog (WordPress + GA4)', campos: [['WP_URL', 'Endereço do site', false], ['GA4_PROPERTY_ID', 'ID da propriedade GA4 (só números)', false]], ajuda: 'O WordPress é lido pela API pública. As visualizações vêm do GA4: a conta dona do script precisa ser leitora da propriedade.' },
    { id: 'drive', nome: 'Google Drive', campos: [['DRIVE_PASTA_POSTS', 'Link ou ID da pasta dos posts', false]], ajuda: 'Pastas com a data no nome (ex.: 2026-11-10 Título) são ligadas ao post sozinhas. A conta dona do script precisa ter acesso à pasta.' },
    { id: 'kaizen', nome: 'Kaizen (levantada de mão)', campos: [], ajuda: 'Na automação da Kaizen (gatilho comentário do Instagram ou mensagem com palavra-gatilho), adicione uma ação HTTP POST para a URL abaixo com o corpo em JSON. Cada chamada conta 1 levantada de mão.' }
  ];
  function telaIntegracoes() {
    if (S.user.perfil !== 'admin') return '<div class="card"><div class="vazio-msg">Só a gestão vê esta tela.</div></div>';
    const st = S.dados.integracoes || { props: {}, ultimo: {} };
    const cards = INTEGRACOES.map(function (ig) {
      const ok = ig.campos.length ? ig.campos.filter(function (c) { return !/VERSAO/.test(c[0]); }).every(function (c) { return st.props[c[0]]; }) : true;
      const ult = st.ultimo[ig.id] || '';
      return '<div class="card integ"><h2>' + esc(ig.nome) + '<small><span class="selo ' + (ig.id === 'kaizen' ? (st.kaizen ? 'ok' : 'neutro') : ok ? 'ok' : 'atencao') + '">' + (ig.id === 'kaizen' ? (st.kaizen ? 'Chave criada' : 'Sem chave') : ok ? 'Configurado' : 'Falta configurar') + '</span></small></h2>' +
        '<p class="mini">' + esc(ig.ajuda) + '</p>' +
        ig.campos.map(function (c) { return '<div class="mini"><b>' + esc(c[1]) + ':</b> ' + (st.props[c[0]] ? esc(st.props[c[0]]) : '<span class="abaixo">vazio</span>') + '</div>'; }).join('') +
        (ult ? '<div class="mini" style="margin-top:6px">Última sincronização: ' + esc(ult) + '</div>' : '') +
        '<div class="acoes" style="justify-content:flex-start">' + (ig.campos.length ? '<button class="btn peq sec" data-integ="' + ig.id + '">Configurar</button>' : '') +
        (['instagram', 'youtube', 'tiktok', 'blog', 'drive'].indexOf(ig.id) >= 0 ? '<button class="btn peq sec" data-sync="' + ig.id + '">Sincronizar agora</button>' : '') +
        (ig.id === 'kaizen' ? '<button class="btn peq sec" id="kaizen-chave">' + (st.kaizen ? 'Gerar nova chave' : 'Gerar chave') + '</button>' : '') + '</div></div>';
    }).join('');
    const contas = S.dados.contas.slice().sort(function (a, b) { return (a.rede + a.nome).localeCompare(b.rede + b.nome); });
    return '<p class="mini" style="margin-bottom:12px">Tokens e chaves ficam guardados no servidor (Propriedades do script). Depois de salvos, aparecem só os 4 últimos caracteres, nem para a gestão o valor volta.</p>' +
      '<div class="grade g3">' + cards + '</div>' +
      '<div class="card secao"><h2>Contas<small><button class="btn peq prim" data-conta="">+ Conta</button></small></h2><div class="tabela-wrap"><table><thead><tr><th>Rede</th><th>Nome</th><th>ID na plataforma</th><th>Ativa</th><th></th></tr></thead><tbody>' +
      contas.map(function (c) { return '<tr><td>' + esc((REDES[c.rede] || {}).nome || c.rede) + '</td><td><b>' + esc(c.nome) + '</b></td><td class="mini">' + esc(c.conta_id || '—') + '</td><td>' + (c.ativo === 'não' ? 'Não' : 'Sim') + '</td><td><button class="btn peq sec" data-conta="' + esc(c.id) + '">Editar</button></td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="grade g2 secao"><div class="card"><h2>Palavras-gatilho<small>levantada de mão</small></h2><p class="mini">Uma por linha. Comentário no Instagram que contém uma delas conta como levantada de mão no post (ex.: EU QUERO, LUCRO, MENTORIA).</p>' +
      '<textarea id="gatilhos" rows="6">' + esc((S.dados.gatilhos || []).join('\n')) + '</textarea><div class="acoes"><button class="btn prim" id="salvar-gatilhos">Salvar palavras</button></div></div>' +
      '<div class="card"><h2>Webhook da Kaizen</h2><p class="mini">URL (método POST, corpo JSON):</p><code class="bloco">' + esc(CFG.API_URL || '(modo demonstração)') + '</code>' +
      '<p class="mini">Corpo:</p><code class="bloco">{"action":"levantada","chave":"SUA_CHAVE","rede":"instagram","conta":"ig-4blue","palavra":"{{palavra}}","post_id":"","contato":"{{contact.phone}}"}</code>' +
      '<p class="mini">O contato é guardado só como código (hash), para não contar a mesma pessoa duas vezes no dia. Registrar à mão: <button class="btn peq sec" id="lev-manual">+ Levantada manual</button></p></div></div>';
  }
  function configurarIntegracao(id) {
    const ig = INTEGRACOES.filter(function (x) { return x.id === id; })[0]; const st = (S.dados.integracoes || { props: {} }).props;
    abrirModal('<h3>' + esc(ig.nome) + '</h3><p class="mini" style="margin:-8px 0 12px">' + esc(ig.ajuda) + '</p>' +
      ig.campos.map(function (c) { return '<label class="campo">' + esc(c[1]) + (st[c[0]] ? ' <span class="mini">(atual: ' + esc(st[c[0]]) + ')</span>' : '') + '<input type="' + (c[2] ? 'password' : 'text') + '" data-prop="' + c[0] + '" autocomplete="off" placeholder="' + (st[c[0]] ? 'deixe vazio para manter' : '') + '"></label>'; }).join('') +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="integ-ok">Salvar</button></div>');
    document.getElementById('integ-ok').onclick = async function () {
      const valores = {}; document.querySelectorAll('[data-prop]').forEach(function (i) { if (i.value.trim()) valores[i.dataset.prop] = i.value.trim(); });
      if (!Object.keys(valores).length) { fecharModal(); return; }
      try {
        if (DEMO) { Object.keys(valores).forEach(function (k) { S.dados.integracoes.props[k] = '••••' + valores[k].slice(-4); }); }
        else { const r = await api('salvarIntegracao', { valores: valores }); S.dados.integracoes = r.integracoes; }
        fecharModal(); render(); toast('Integração salva.');
      } catch (e) { toast(e.message); }
    };
  }
  function editarConta(id) {
    const c = id ? S.dados.contas.filter(function (x) { return x.id === id; })[0] : { rede: 'instagram', ativo: 'sim' };
    abrirModal('<h3>' + (id ? 'Editar conta' : 'Nova conta') + '</h3>' +
      '<label class="campo">Rede<select id="co-rede"' + (id ? ' disabled' : '') + '>' + opcoes(Object.keys(REDES).map(function (r) { return [r, REDES[r].nome]; }), c.rede) + '</select></label>' +
      '<label class="campo">Nome (ex.: 4blue, Renan, Aleks)<input type="text" id="co-nome" value="' + esc(c.nome || '') + '"></label>' +
      '<label class="campo">ID na plataforma <span class="mini">(Instagram: ID da conta comercial; demais podem ficar vazios)</span><input type="text" id="co-id" value="' + esc(c.conta_id || '') + '"></label>' +
      '<label class="campo">Ativa<select id="co-ativo">' + opcoes([['sim', 'Sim'], ['não', 'Não']], c.ativo === 'não' ? 'não' : 'sim') + '</select></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="co-ok">Salvar</button></div>');
    document.getElementById('co-ok').onclick = async function () {
      const rede = document.getElementById('co-rede').value, nome = document.getElementById('co-nome').value.trim();
      if (!nome) { toast('Informe o nome.'); return; }
      const n = Object.assign({}, c, { rede: rede, nome: nome, conta_id: document.getElementById('co-id').value.trim(), ativo: document.getElementById('co-ativo').value });
      if (!n.id) n.id = rede.slice(0, 2).replace('ti', 'tt').replace('bl', 'blog') + '-' + nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '');
      try {
        if (!DEMO) await api('salvarItem', { colecao: 'Contas', item: n });
        const i = S.dados.contas.findIndex(function (x) { return x.id === n.id; }); if (i >= 0) Object.assign(S.dados.contas[i], n); else S.dados.contas.push(n);
        fecharModal(); render(); toast('Conta salva.');
      } catch (e) { toast(e.message); }
    };
  }
  function levantadaManual() {
    abrirModal('<h3>Registrar levantada de mão</h3>' +
      '<label class="campo">Data<input type="date" id="lv-data" value="' + hojeISO() + '"></label>' +
      '<label class="campo">Conta<select id="lv-conta">' + opcoes(S.dados.contas.map(function (c) { return [c.id, nomeConta(c.id)]; }), '') + '</select></label>' +
      '<label class="campo">Quantidade<input type="number" id="lv-qtd" min="1" value="1"></label>' +
      '<label class="campo">Palavra ou origem<input type="text" id="lv-pal" placeholder="Ex.: EU QUERO, direct, story"></label>' +
      '<div class="acoes"><button class="btn sec" data-fechar>Cancelar</button><button class="btn prim" id="lv-ok">Registrar</button></div>');
    document.getElementById('lv-ok').onclick = async function () {
      const conta = document.getElementById('lv-conta').value; const c = S.dados.contas.filter(function (x) { return x.id === conta; })[0] || {};
      const qtd = Math.min(200, Math.max(1, parseInt(document.getElementById('lv-qtd').value, 10) || 1));
      try {
        for (let i = 0; i < qtd; i++) await gravar('Levantadas', { data: document.getElementById('lv-data').value, conta: conta, rede: c.rede || '', origem: 'manual', palavra: document.getElementById('lv-pal').value.trim() });
        fecharModal(); render(); toast(qtd + ' levantada(s) registrada(s).');
      } catch (e) { toast(e.message); }
    };
  }

  // ---- cliques e mudanças do módulo
  function cliqueModulo2(t) {
    const d = t.dataset;
    if (t.id === 't-add') {
      const tit = document.getElementById('t-titulo').value.trim(); if (!tit) { toast('Escreva a tarefa.'); return true; }
      gravar('Tarefas', { titulo: tit, responsavel: document.getElementById('t-resp').value, prazo: document.getElementById('t-prazo').value, status: 'aberta', criado_por: S.user.email })
        .then(render).catch(function (e) { toast(e.message); });
      return true;
    }
    if (d.tarefa) { editarTarefa(d.tarefa); return true; }
    if (t.id === 'nova-pauta') { editarPauta(''); return true; }
    if (d.pautaData) { editarPauta('', { titulo: d.pautaTema, data_prevista: d.pautaData }); return true; }
    if (d.pauta) { editarPauta(d.pauta); return true; }
    if (t.id === 'novo-farol') { editarFarol(''); return true; }
    if (d.farol) { editarFarol(d.farol); return true; }
    if (d.integ) { configurarIntegracao(d.integ); return true; }
    if (d.conta !== undefined && t.tagName === 'BUTTON') { editarConta(d.conta); return true; }
    if (t.id === 'lev-manual') { levantadaManual(); return true; }
    if (t.id === 'salvar-gatilhos') {
      const palavras = document.getElementById('gatilhos').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 100);
      (DEMO ? Promise.resolve() : api('salvarGatilhos', { palavras: palavras })).then(function () { S.dados.gatilhos = palavras; toast('Palavras salvas. Valem a partir da próxima sincronização.'); }).catch(function (e) { toast(e.message); });
      return true;
    }
    if (t.id === 'kaizen-chave') {
      if (DEMO) { toast('No modo demonstração não há chave.'); return true; }
      if (!confirm('Gerar uma nova chave? A anterior deixa de funcionar na Kaizen.')) return true;
      api('gerarChaveKaizen').then(function (r) {
        S.dados.integracoes = r.integracoes; render();
        abrirModal('<h3>Chave da Kaizen</h3><p class="mini">Copie agora e cole no corpo da ação HTTP da Kaizen, no campo "chave". Ela não aparece de novo.</p><code class="bloco">' + esc(r.chave) + '</code><div class="acoes"><button class="btn prim" data-fechar>Copiei</button></div>');
      }).catch(function (e) { toast(e.message); });
      return true;
    }
    if (d.sync) {
      if (DEMO) { toast('No modo demonstração não há sincronização.'); return true; }
      t.disabled = true; t.textContent = 'Sincronizando…';
      api('sincronizar', { rede: d.sync }).then(function (r) { S.dados.integracoes = r.integracoes; toast(r.resultado); return carregar(); }).catch(function (e) { toast(e.message); render(); });
      return true;
    }
    return false;
  }
  function mudancaModulo2(e) {
    const t = e.target;
    if (t.dataset.feita) {
      const it = lista('tarefas').filter(function (x) { return x.id === t.dataset.feita; })[0]; if (!it) return true;
      gravar('Tarefas', Object.assign({}, it, { status: t.checked ? 'feita' : 'aberta', feita_em: t.checked ? new Date().toISOString() : '' })).then(render).catch(function (er) { toast(er.message); });
      return true;
    }
    if (t.id === 'f-tarefas') { S.filtroTarefas = t.value; render(); return true; }
    if (t.id === 'f-feed') { S.contaFeed = t.value; render(); return true; }
    return false;
  }
  // clique em dia vazio do farol
  app.addEventListener('dblclick', function (e) { const td = e.target.closest('td[data-dia]'); if (td && !e.target.closest('.chip')) editarFarol('', { ini: td.dataset.dia, fim: td.dataset.dia, tipo: td.dataset.tipo }); });


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
    const corpo = { geral: telaGeral, producao: telaProducao, metas: telaMetas, recomendacoes: telaRecs, posts: telaPosts, equipe: telaEquipe,
      conteudo: telaConteudo, tarefas: telaTarefas, farol: telaFarol, feed: telaFeed, integracoes: telaIntegracoes }[S.aba];
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
    else if (cliqueModulo2(t)) { /* tratado no módulo de operação */ }
    else if (t.id === 'sair') sair();
  });
  app.addEventListener('change', function (e) {
    if (mudancaModulo2(e)) return;
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
