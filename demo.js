/*
 * MODO DEMONSTRAÇÃO — dados 100% fictícios, gerados aqui no navegador.
 * Só é usado quando APP_CONFIG.API_URL está vazio. Nenhum número é real.
 */
window.DEMO_DADOS = (function () {
  let semente = 42;
  const rnd = function () { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  const entre = function (a, b) { return Math.round(a + rnd() * (b - a)); };
  const pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  const usuarios = [
    { email: 'demo@4blue.com.br', nome: 'Você (demo)', funcao: 'Gestão', perfil: 'admin', pode_metas: 'sim', ativo: 'sim' },
    { email: 'ana@exemplo.com', nome: 'Ana Exemplo', funcao: 'Designer', perfil: 'membro', ativo: 'sim' },
    { email: 'bruno@exemplo.com', nome: 'Bruno Exemplo', funcao: 'Editor de vídeo', perfil: 'membro', ativo: 'sim' },
    { email: 'carla@exemplo.com', nome: 'Carla Exemplo', funcao: 'Social media', perfil: 'membro', pode_metas: 'sim', ativo: 'sim' },
    { email: 'diego@exemplo.com', nome: 'Diego Exemplo', funcao: 'Editor de vídeo', perfil: 'membro', ativo: 'sim' },
    { email: 'elisa@exemplo.com', nome: 'Elisa Exemplo', funcao: 'Redator', perfil: 'membro', ativo: 'sim' }
  ];
  const contas = [
    { id: 'ig-4blue', rede: 'instagram', nome: '4blue', base: 440000 },
    { id: 'ig-socio1', rede: 'instagram', nome: 'Sócio 1', base: 24000 },
    { id: 'ig-socio2', rede: 'instagram', nome: 'Sócio 2', base: 22000 },
    { id: 'tt-4blue', rede: 'tiktok', nome: '4blue', base: 12000 },
    { id: 'yt-4blue', rede: 'youtube', nome: '4blue', base: 180000 },
    { id: 'li-4blue', rede: 'linkedin', nome: '4blue', base: 19000 },
    { id: 'blog-4blue', rede: 'blog', nome: 'Blog 4blue', base: 0 }
  ];
  const formatos = {
    instagram: ['Reels', 'Reels', 'Carrossel', 'Carrossel', 'Imagem', 'Stories'],
    tiktok: ['Vídeo'], linkedin: ['Post', 'Carrossel', 'Newsletter', 'Vídeo'], youtube: ['Vídeo', 'Shorts', 'Shorts'], blog: ['Artigo']
  };
  const editoriais = ['Finanças', 'Gestão', 'Pessoas', 'Vendas', 'Marketing', 'Interação', 'Hardsell'];
  const objetivos = ['curtidas', 'comentarios', 'salvos', 'compartilhamentos', 'alcance', ''];
  const temas = ['Os 3 números da sua empresa', 'Como calcular o pró-labore', 'Fluxo de caixa sem mistério',
    'Feedback que faz a equipe crescer', 'Precificação: pare de perder margem', 'Checklist do empresário',
    'Erros que travam o lucro', 'Como vender mais caro', 'Rotina de gestão semanal', 'Meta x realidade'];
  const pessoasPor = { imagem: ['ana@exemplo.com', 'carla@exemplo.com'], video: ['bruno@exemplo.com', 'diego@exemplo.com'], texto: ['elisa@exemplo.com'] };

  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const inicio = new Date(hoje); inicio.setMonth(inicio.getMonth() - 6); inicio.setDate(1);
  const posts = []; let n = 0;

  contas.forEach(function (c) {
    const porSemana = { 'ig-4blue': 9, 'ig-socio1': 4, 'ig-socio2': 4, 'tt-4blue': 4, 'yt-4blue': 3, 'li-4blue': 3, 'blog-4blue': 1 }[c.id];
    for (let d = new Date(inicio); d <= hoje; d.setDate(d.getDate() + 1)) {
      if (rnd() > porSemana / 7) continue;
      const fmt = pick(formatos[c.rede]);
      const tipo = c.rede === 'blog' || fmt === 'Newsletter' ? 'texto' : (['Reels', 'Vídeo', 'Shorts'].indexOf(fmt) >= 0 ? 'video' : 'imagem');
      const hora = pick(['11:00', '15:00', '19:00', '19:00', '12:00']);
      const fatorHora = hora === '19:00' ? 1.25 : 1;
      const fatorFmt = { Reels: 1.6, Carrossel: 1.1, Imagem: 0.6, Stories: 0.35, 'Vídeo': 1, Shorts: 1.3, Artigo: 1, Post: 1, Newsletter: 0.8 }[fmt];
      const escala = c.rede === 'instagram' ? (c.id === 'ig-4blue' ? 12000 : 3000) : c.rede === 'tiktok' ? 2500 : c.rede === 'youtube' ? 4000 : c.rede === 'linkedin' ? 600 : 900;
      const base = Math.round(escala * fatorFmt * fatorHora * (0.4 + rnd() * 1.4) * (rnd() > 0.95 ? 3.5 : 1));
      const engBase = { Reels: 0.03, Carrossel: 0.045, Imagem: 0.018, Stories: 0.01, 'Vídeo': 0.04, Shorts: 0.035, Artigo: 0.02, Post: 0.03, Newsletter: 0.025 }[fmt] * (0.5 + rnd());
      const inter = Math.round(base * engBase);
      const postado = d < hoje || rnd() > 0.5;
      const dia = new Date(d);
      posts.push({
        id: 'p' + (++n), rede: c.rede, conta: c.id, post_id: 'demo' + n,
        data: iso(dia), hora: hora, formato: fmt, tipo_peca: tipo,
        editorial: pick(editoriais), objetivo: pick(objetivos),
        titulo: pick(temas), link: '#',
        responsavel: rnd() > 0.08 ? pick(pessoasPor[tipo]) : '',
        status: postado ? 'postado' : 'produzido',
        pasta_drive: rnd() > 0.15 ? 'https://drive.google.com/drive/folders/EXEMPLO' : '',
        alcance: c.rede === 'instagram' ? base : '',
        visualizacoes: c.rede === 'instagram' ? (tipo === 'video' ? Math.round(base * 1.4) : '') : c.rede === 'linkedin' ? '' : base,
        impressoes: c.rede === 'linkedin' ? base : '',
        curtidas: Math.round(inter * 0.7), comentarios: Math.round(inter * 0.06),
        compartilhamentos: Math.round(inter * 0.12), salvos: Math.round(inter * (fmt === 'Carrossel' ? 0.3 : 0.1)),
        visitas_perfil: Math.round(base * 0.004), seguidores_ganhos: Math.round(base * 0.0015),
        cliques: c.rede === 'blog' ? Math.round(base * 0.03) : '',
        alcance_nao_seguidores: c.rede === 'instagram' ? (fmt === 'Reels' ? 0.55 + rnd() * 0.35 : 0.1 + rnd() * 0.3) : '',
        retencao: tipo === 'video' ? 0.2 + rnd() * 0.45 : ''
      });
    }
  });

  // produção ainda não postada (aparece em "feitos")
  for (let i = 0; i < 9; i++) {
    const tipo = pick(['imagem', 'video', 'video']);
    posts.push({ id: 'p' + (++n), rede: 'instagram', conta: 'ig-4blue', post_id: '', data: iso(hoje), hora: '',
      formato: tipo === 'video' ? 'Reels' : 'Carrossel', tipo_peca: tipo, editorial: pick(editoriais), objetivo: pick(objetivos),
      titulo: pick(temas) + ' (em aprovação)', link: '', responsavel: pick(pessoasPor[tipo]), status: 'produzido', pasta_drive: '' });
  }

  const snapshots = [];
  contas.forEach(function (c) {
    if (!c.base) return;
    let s = c.base;
    for (let d = new Date(inicio); d <= hoje; d.setDate(d.getDate() + 7)) {
      s = Math.round(s * (1 + (rnd() * 0.012 - 0.002)));
      snapshots.push({ data: iso(d), rede: c.rede, conta: c.id, seguidores: s });
    }
  });

  const mes = hoje.getFullYear() + '-' + pad(hoje.getMonth() + 1);
  const metas = [
    { id: 'm1', escopo: 'conta', alvo: 'ig-4blue', metrica: 'posts', periodo: mes, valor: 40 },
    { id: 'm2', escopo: 'conta', alvo: 'ig-4blue', metrica: 'alcance', periodo: mes, valor: 450000 },
    { id: 'm3', escopo: 'conta', alvo: 'ig-4blue', metrica: 'engajamento', periodo: mes, valor: 0.035 },
    { id: 'm4', escopo: 'rede', alvo: 'youtube', metrica: 'visualizacoes', periodo: mes, valor: 60000 },
    { id: 'm5', escopo: 'rede', alvo: 'tiktok', metrica: 'posts', periodo: mes, valor: 16 },
    { id: 'm6', escopo: 'funcao', alvo: 'Editor de vídeo', metrica: 'videos_postados', periodo: mes, valor: 30 },
    { id: 'm7', escopo: 'funcao', alvo: 'Designer', metrica: 'imagens_postadas', periodo: mes, valor: 24 },
    { id: 'm8', escopo: 'pessoa', alvo: 'bruno@exemplo.com', metrica: 'videos_feitos', periodo: mes, valor: 16 }
  ];

  return { usuarios: usuarios, contas: contas, posts: posts, snapshots: snapshots, metas: metas,
    atualizadoEm: new Date().toISOString(), demo: true };
})();
