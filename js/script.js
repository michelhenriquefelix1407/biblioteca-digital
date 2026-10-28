// Guarda referências aos elementos principais e às chaves do armazenamento local.
const secaoCategorias = document.querySelector(".catagorias");
const formularioAdicionar = document.querySelector("#form-adicionar-categoria");
const chaveCategorias = "bdp-categorias-v1";      // mantida só para migração futura (Fase 5)
const chaveLivros = "bdp-livros-v1";              // mantida só para migração futura (Fase 5)
const chaveLivrosIniciaisImportados = "bdp-livros-iniciais-importados-v1"; // mantida só para migração

// === NOVO: estado Drive (Fase 3) ===
let drivePronto = false;              // true após DriveAPI.init() + carregarDoDrive()
let bibliotecaDrive = { livros: [], categorias: [] };  // cache em memória do biblioteca.json
// ====================================
const idCategoriaSemCategoria = "sem-categoria";
const nomeCategoriaSemCategoria = "Sem categoria";
let temporizadorMensagemOperacao;
const formularioLivro = document.querySelector("#form-sugestao");
const estante = document.querySelector("#estante");
const gradeLivros = document.querySelector(".video-grid");

// Exibe o retorno temporariamente e reinicia o prazo quando surge outra mensagem.
function exibirMensagemOperacao(texto) {
  const mensagem = document.querySelector("#mensagem-operacao-biblioteca");
  window.clearTimeout(temporizadorMensagemOperacao);
  mensagem.textContent = texto;
  mensagem.hidden = false;
  temporizadorMensagemOperacao = window.setTimeout(() => {
    mensagem.hidden = true;
    mensagem.textContent = "";
  }, 5000);
}

// Controla o aumento e a redução do tamanho da fonte pelos botões de acessibilidade.
const botaoAumentar = document.querySelector("#btn-aumentar");
const botaoDiminuir = document.querySelector("#btn-diminuir");
let tamanhoFonte = 16;

botaoAumentar.addEventListener("click", function () {
  if (tamanhoFonte < 22) {
    tamanhoFonte += 2;
    document.body.style.fontSize = tamanhoFonte + "px";
  }
});

botaoDiminuir.addEventListener("click", function () {
  if (tamanhoFonte > 12) {
    tamanhoFonte -= 2;
    document.body.style.fontSize = tamanhoFonte + "px";
  }
});

// Recupera categorias do Drive (bibliotecaDrive) ou fallback para botões do HTML.
async function carregarCategorias() {
  if (!drivePronto) {
    // Fallback temporário: categorias do HTML (antes do Drive carregar)
    return [...secaoCategorias.querySelectorAll('.categoria-item:not([data-categoria="todos"])')]
      .map((botao) => ({
        id: botao.dataset.categoria,
        nome: botao.textContent.replace(/\s+/g, " ").trim()
      }))
      .filter((categoria) => categoria.id && categoria.nome);
  }
  // Categorias já vêm normalizadas do biblioteca.json (incluindo "sem-categoria")
  return bibliotecaDrive.categorias || [];
}

let categorias = [];          // será preenchido assincronamente em inicializarApp()
// Mantém o filtro aplicado independente da escolha ainda não confirmada no seletor.
let categoriaAplicada = "todos";

// Cola o conteúdo da área de transferência no campo de link e informa se houver falha.
document.querySelector("#colar-link").addEventListener("click", async () => {
  const campoLink = document.querySelector("#link-livro");

  try {
    const textoCopiado = await navigator.clipboard.readText();
    campoLink.value = textoCopiado.trim();
    campoLink.focus();
  } catch {
    window.alert("Não foi possível acessar a área de transferência.");
  }
});

// Ordena as categorias, recria os botões e atualiza os seletores da página.

function ordenarCategorias() {
  const semCategoria = categorias.find(
    (categoria) => categoria.id === idCategoriaSemCategoria
  );

  categorias = categorias
    .filter((categoria) => categoria.id !== idCategoriaSemCategoria)
    .sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );

  if (semCategoria) {
    categorias.push(semCategoria);
  }

  const todos = secaoCategorias.querySelector('[data-categoria="todos"]');
  const favoritos = secaoCategorias.querySelector(".favoritos");

  secaoCategorias
    .querySelectorAll('.categoria-item:not([data-categoria="todos"])')
    .forEach((botao) => botao.remove());

  todos.after(favoritos);

  let referencia = favoritos;
  categorias
    .filter((categoria) => categoria.id !== "todos")
    .forEach((categoria) => {
      const botao = document.createElement("button");
      botao.className = "categoria-item";
      botao.dataset.categoria = categoria.id;
      botao.type = "button";
      botao.textContent = categoria.nome;
      referencia.after(botao);
      referencia = botao;
    });

  atualizarSeletoresCategorias();
  atualizarSeletorExclusaoCategoria();
}

// Atualiza as opções de exclusão, preservando a categoria protegida.
function atualizarSeletorExclusaoCategoria() {
  const seletor = document.querySelector("#categoria-para-excluir");
  const valorAtual = seletor.value;
  seletor.replaceChildren(new Option("Selecione uma categoria", ""));

  categorias
    .filter((categoria) => categoria.id !== idCategoriaSemCategoria)
    .forEach((categoria) => {
      const opcao = new Option(categoria.nome, categoria.id);
      seletor.append(opcao);
    });

  if (categorias.some((categoria) => categoria.id === valorAtual)) {
    seletor.value = valorAtual;
  }
}

// Atualiza o filtro e o formulário com as categorias disponíveis para cada uso.
function atualizarSeletoresCategorias() {
  const seletores = [
    document.querySelector("#categorias"),
    document.querySelector("#tema")
  ].filter(Boolean);

  seletores.forEach((seletor) => {
    const valorAtual = seletor.value;
    const opcaoInicial = seletor.options[0]?.cloneNode(true);
    seletor.replaceChildren();
    if (opcaoInicial) seletor.append(opcaoInicial);

    const categoriasReais = categorias.filter(
      (categoria) => categoria.id !== "todos"
    );

    const opcoes = seletor.id === "categorias"
      ? [{ id: "favoritos", nome: "Meus favoritos" }, ...categoriasReais]
      : categoriasReais;

    opcoes.forEach((categoria) => {
      const opcao = document.createElement("option");
      opcao.value = categoria.id;
      opcao.textContent = categoria.nome;
      seletor.append(opcao);
    });

    if (
      opcoes.some((categoria) => categoria.id === valorAtual) ||
      (seletor.id === "categorias" && valorAtual === "todos")
    ) {
      seletor.value = valorAtual;
    }
  });
}

// Salva categorias no Drive (via biblioteca.json com debounce).
function salvarCategorias() {
  if (!drivePronto) return;
  bibliotecaDrive.categorias = categorias;
  DriveAPI.salvarBiblioteca(bibliotecaDrive);
}

// Carrega os livros e migra associações antigas para o identificador reservado de "Sem categoria".
let livros = [];   // será preenchido assincronamente em inicializarApp()

// Gera um identificador estável e compatível com URLs a partir do nome da categoria.
function criarIdCategoria(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `categoria-${Date.now()}`;
}

// Converte os cards iniciais do HTML em registros de livro.
function criarLivrosIniciais() {
  return [...gradeLivros.querySelectorAll(":scope > article.video-card")]
    .map((card, indice) => ({
      id: card.dataset.id || `livro-inicial-${indice + 1}`,
      titulo: card.dataset.titulo,
      autor: card.dataset.autor,
      categoriaId: card.dataset.categoriaId,
      formato: card.dataset.formato,
      url: card.dataset.url,
      favorito: false
    }));
}

// Recupera os livros do Drive (bibliotecaDrive) ou fallback para cards iniciais do HTML.
async function carregarLivros() {
  if (!drivePronto) {
    return criarLivrosIniciais();
  }
  const livrosDrive = bibliotecaDrive.livros || [];
  return livrosDrive;  // sem migração de IDs legados
}

// Salva livros no Drive (via biblioteca.json com debounce).
function salvarLivros(livrosParaSalvar = livros) {
  if (!drivePronto) return true;
  bibliotecaDrive.livros = livrosParaSalvar;
  DriveAPI.salvarBiblioteca(bibliotecaDrive);
  return true;
}

// Preenche o seletor de destino com as categorias disponíveis.
function preencherDestinos(select) {
  const opcaoInicial = document.createElement("option");
  opcaoInicial.value = "";
  opcaoInicial.textContent = "Escolha uma categoria";
  opcaoInicial.disabled = true;
  opcaoInicial.selected = true;
  select.replaceChildren(opcaoInicial);

  categorias
    .filter((categoria) => categoria.id !== "todos")
    .forEach((categoria) => {
      const opcao = document.createElement("option");
      opcao.value = categoria.id;
      opcao.textContent = categoria.nome;
      select.append(opcao);
    });
}

// Monta o card visível de um livro, incluindo informações e comandos disponíveis.
function criarCardLivro(livro) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.dataset.livroId = livro.id;

  // Cria a área visual da capa do livro.
  const capa = document.createElement("div");
  capa.className = "video-card__thumbnail";

  const conteudo = document.createElement("div");
  conteudo.className = "video-card__content";

  // Organiza o título e os detalhes sobre a área visual da capa.
  const informacoes = document.createElement("div");
  informacoes.className = "livro-informacoes";

  const titulo = document.createElement("h3");
  titulo.textContent = livro.titulo;

  const categoriaAtual = categorias.find(
    (categoria) => categoria.id === livro.categoriaId
  );
  const detalhes = document.createElement("p");
  detalhes.className = "livro-detalhes";
  const autor = document.createElement("span");
  autor.className = "livro-autor";
  autor.textContent = livro.autor || "Autor não informado";
  const categoria = document.createElement("span");
  categoria.className = "livro-categoria";
  categoria.textContent = categoriaAtual?.nome || "Categoria não definida";
  const formato = document.createElement("span");
  formato.className = "livro-formato";
  formato.textContent = livro.formato || "Formato não informado";
  detalhes.append(autor, categoria, formato);

  informacoes.append(titulo, detalhes);
  capa.append(informacoes);

  const acoes = document.createElement("div");
  acoes.className = "livro-acoes";

  // Exibe o link cadastrado ou informa que o livro não tem link disponível.
  if (livro.url) {
    const link = document.createElement("a");
    link.className = "livro-link";
    link.href = livro.url;
    link.textContent = "Acessar livro";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    conteudo.append(link);
  } else {
    const linkIndisponivel = document.createElement("span");
    linkIndisponivel.className = "livro-link-indisponivel";
    linkIndisponivel.textContent = "Link não cadastrado";
    conteudo.append(linkIndisponivel);
  }

  // Cria o botão de favorito e expõe seu estado às tecnologias assistivas.
  const favoritoAtivo = Boolean(livro.favorito);
  const botaoFavorito = document.createElement("button");
  botaoFavorito.type = "button";
  botaoFavorito.className = "botao-favorito";
  botaoFavorito.dataset.acaoLivro = "alternar-favorito";
  botaoFavorito.textContent = favoritoAtivo ? "★" : "☆";
  botaoFavorito.title = favoritoAtivo ? "Remover dos favoritos" : "Favoritar";
  botaoFavorito.setAttribute(
    "aria-label",
    favoritoAtivo ? "Remover dos favoritos" : "Favoritar"
  );
  botaoFavorito.setAttribute("aria-pressed", String(favoritoAtivo));



  // Agrupa as ações para mover ou remover o livro.
  const menu = document.createElement("details");
  menu.className = "menu-acoes-livro";

  const abrirMenu = document.createElement("summary");
  abrirMenu.className = "botao-menu-acoes";
  abrirMenu.textContent = "⋮";
  abrirMenu.setAttribute("aria-label", `Ações para ${livro.titulo}`);

  const opcoesMenu = document.createElement("div");
  opcoesMenu.className = "opcoes-menu-acoes";

  const botaoMover = document.createElement("button");
  botaoMover.type = "button";
  botaoMover.dataset.acaoLivro = "abrir-mover";
  botaoMover.textContent = "Mover livro";

  const botaoExcluir = document.createElement("button");
  botaoExcluir.type = "button";
  botaoExcluir.dataset.acaoLivro = "excluir";
  botaoExcluir.textContent = "Remover livro";

  // Mantém ocultos os controles de destino até a escolha da ação de movimentação.
  const controlesMover = document.createElement("div");
  controlesMover.className = "controles-mover-livro";
  controlesMover.hidden = true;

  const destino = document.createElement("select");
  destino.setAttribute("aria-label", "Categoria de destino");
  preencherDestinos(destino);

  const confirmarMover = document.createElement("button");
  confirmarMover.type = "button";
  confirmarMover.dataset.acaoLivro = "confirmar-mover";
  confirmarMover.textContent = "Mover para categoria";

  const mensagemMover = document.createElement("p");
  mensagemMover.className = "mensagem-mover-livro";
  mensagemMover.setAttribute("role", "status");
  mensagemMover.setAttribute("aria-live", "polite");

  controlesMover.append(destino, confirmarMover, mensagemMover);
  opcoesMenu.append(botaoMover, botaoExcluir, controlesMover);
  menu.append(abrirMenu, opcoesMenu);
  acoes.append(botaoFavorito, menu);
  conteudo.append(acoes);
  card.append(capa, conteudo);

  return card;
}

// Padroniza o texto para ignorar acentos, espaços externos e diferenças entre maiúsculas e minúsculas.
function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

// Filtra por título ou autor e pela categoria aplicada, inclusive a lista de favoritos.
function renderizarLivros() {
  gradeLivros.querySelectorAll(":scope > article").forEach((card) => card.remove());

  const campoBusca = document.querySelector("#livro");
  const mensagemBusca = document.querySelector("#mensagem-busca");
  const termosBusca = normalizarTexto(campoBusca.value)
    .split(/\s+/)
    .filter(Boolean);
  const categoriaSelecionada = categoriaAplicada;

  const livrosFiltrados = livros.filter((livro) => {
    const textoLivro = normalizarTexto(
      `${livro.titulo || ""} ${livro.autor || ""}`
    );

    const correspondeBusca = termosBusca.every((termo) =>
      textoLivro.includes(termo)
    );
    const correspondeCategoria =
      categoriaSelecionada === "todos" ||
      (categoriaSelecionada === "favoritos" && Boolean(livro.favorito)) ||
      livro.categoriaId === categoriaSelecionada;

    return correspondeBusca && correspondeCategoria;
  });

  livrosFiltrados.forEach((livro) => {
    gradeLivros.append(criarCardLivro(livro));
  });

  mensagemBusca.hidden = livrosFiltrados.length > 0;
  mensagemBusca.textContent =
    livrosFiltrados.length > 0 ? "" : "Nenhum livro encontrado.";
}

// Atualiza o filtro aplicado e o destaque da navegação sem mudar a escolha pendente no seletor.
function sincronizarCategoriaAtiva(idCategoria) {
  categoriaAplicada = idCategoria;

  secaoCategorias.querySelectorAll("button[data-categoria]").forEach((botao) => {
    botao.classList.toggle("ativo", botao.dataset.categoria === idCategoria);
  });
}

// Aplica o texto e a categoria selecionada ao confirmar a busca.
function aplicarBusca() {
  const categoriaSelecionada = document.querySelector("#categorias").value;
  sincronizarCategoriaAtiva(categoriaSelecionada);
  renderizarLivros();
}

// Aplica os filtros selecionados ao acionar o botão de pesquisa.
document.querySelector("#pesquisar").addEventListener("click", aplicarBusca);

// Permite confirmar a busca pressionando Enter no campo de texto.
document.querySelector("#livro").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    aplicarBusca();
  }
})

const campoBusca = document.querySelector("#livro");

// Limpa o texto da busca, mantém a categoria aplicada e atualiza a estante.
document.querySelector("#limpar-busca").addEventListener("click", () => {
  campoBusca.value = "";
  campoBusca.focus();
  renderizarLivros();
});

// Cadastra uma categoria, rejeita nomes repetidos e atualiza os seletores.
document.querySelector("#form-adicionar-categoria").addEventListener("submit", (evento) => {
  evento.preventDefault();

  const campo = document.querySelector("#nova-categoria");
  const mensagem = document.querySelector("#mensagem-form-categoria");
  const nome = campo.value.trim();

  if (!nome) {
    mensagem.textContent = "Informe o nome da categoria.";
    return;
  }

  if (categorias.some((categoria) =>
    normalizarTexto(categoria.nome) === normalizarTexto(nome)
  )) {
    mensagem.textContent = "Essa categoria já existe.";
    return;
  }

  const idBase = criarIdCategoria(nome);
  let id = idBase;
  let sufixo = 2;
  while (categorias.some((categoria) => categoria.id === id)) {
    id = `${idBase}-${sufixo}`;
    sufixo += 1;
  }

  categorias.push({ id, nome });
  salvarCategorias();
  ordenarCategorias();
  formularioAdicionar.reset();
  mensagem.textContent = "Categoria adicionada.";
});

// Exclui a categoria selecionada e transfere seus livros para "Sem categoria".
document.querySelector("#excluir-categoria").addEventListener("click", () => {
  const seletorExclusao = document.querySelector("#categoria-para-excluir");
  const idCategoria = seletorExclusao.value;
  const categoria = categorias.find((item) => item.id === idCategoria);
  const mensagem = document.querySelector("#mensagem-form-categoria");
  if (!categoria || idCategoria === idCategoriaSemCategoria) {
    mensagem.textContent = "Selecione uma categoria para excluir.";
    return;
  }

  const livrosAfetados = livros.filter(
    (livro) => livro.categoriaId === idCategoria
  );
  const detalhesLivros = livrosAfetados
    .map((livro) => {
      const titulo = livro.titulo || "Livro sem título";
      return livro.autor ? `"${titulo}" — ${livro.autor}` : `"${titulo}"`;
    })
    .join("\n• ");
  const confirmacao = livrosAfetados.length
    ? `A categoria "${categoria.nome}" contém ${livrosAfetados.length} livro(s):\n• ${detalhesLivros}\n\nDeseja excluir esta categoria e mover os livros para "${nomeCategoriaSemCategoria}"?`
    : `Deseja excluir a categoria "${categoria.nome}"?`;

  if (!window.confirm(confirmacao)) return;

  const livrosAtualizados = livros.map((livro) =>
    livro.categoriaId === idCategoria
      ? { ...livro, categoriaId: idCategoriaSemCategoria }
      : livro
  );
  const categoriasAtualizadas = categorias.filter(
    (item) => item.id !== idCategoria
  );
  let valoresAnteriores;
  let valoresAnterioresCapturados = false;
  const chavesGravadas = [];

  try {
    // Backup em memória para rollback (sem localStorage)
    valoresAnteriores = [
      [chaveLivros, JSON.stringify(livros)],
      [chaveCategorias, JSON.stringify(categorias)]
    ];
    valoresAnterioresCapturados = true;
    // Atualiza arrays locais e salva via DriveAPI
    livros = livrosAtualizados;
    categorias = categoriasAtualizadas;
    salvarLivros(livros);
    salvarCategorias();
    chavesGravadas.push(chaveLivros, chaveCategorias);
  } catch (erro) {
    console.error("Não foi possível salvar a exclusão da categoria.", erro);
    // Rollback em memória (restaura arrays locais)
    livros = JSON.parse(valoresAnteriores[0][1]);
    categorias = JSON.parse(valoresAnteriores[1][1]);
    ordenarCategorias();
    renderizarLivros();

    mensagem.textContent = "Não foi possível salvar a exclusão. As alterações foram desfeitas.";
    exibirMensagemOperacao(mensagem.textContent);
    return;
  }

  livros = livrosAtualizados;
  categorias = categoriasAtualizadas;
  ordenarCategorias();
  seletorExclusao.value = "";

  const seletorCategorias = document.querySelector("#categorias");
  if (
    categoriaAplicada === idCategoria ||
    seletorCategorias.value === idCategoria
  ) {
    seletorCategorias.value = "todos";
    sincronizarCategoriaAtiva("todos");
  }

  renderizarLivros();
  mensagem.textContent = "";
  exibirMensagemOperacao(livrosAfetados.length
    ? `Categoria "${categoria.nome}" excluída com sucesso. ${livrosAfetados.length === 1 ? "O livro" : "Os livros"} ${livrosAfetados.map((livro) => `"${livro.titulo || "Livro sem título"}"`).join(", ")} ${livrosAfetados.length === 1 ? "foi movido" : "foram movidos"} para "${nomeCategoriaSemCategoria}".`
    : `Categoria "${categoria.nome}" excluída com sucesso. Não havia livros para mover.`);
});


// ===== FASE 3: Inicialização assíncrona do Drive =====
async function inicializarApp() {
  // Conectar callback de status do Drive (indicador "Salvando… / Salvo / Erro")
  DriveAPI.setStatusCallback((texto, tipo) => {
    const el = document.querySelector('#drive-sync-status');
    if (!el) return;
    el.textContent = texto;
    el.className = 'drive-sync-status ' + tipo;
    el.hidden = false;
    if (tipo === 'saved') {
      setTimeout(() => { el.hidden = true; }, 3000);
    }
  });

  // === RENDER IMEDIATO: mostra dados iniciais do HTML ANTES do login ===
  renderizarDadosIniciais();

  // Se já estiver logado, inicializa Drive direto
  if (window.estaConectado()) {
    await inicializarDriveEPronto();
    return;
  }

  // Senão, espera o evento de login (disparado por auth.js)
  document.addEventListener('google-auth-changed', async (e) => {
    if (e.detail.conectado) {
      await inicializarDriveEPronto();
    }
  }, { once: true });
}

// Nova função: renderiza dados iniciais do HTML imediatamente (sem depender do Drive)
function renderizarDadosIniciais() {
  // Carrega categorias dos botões do HTML
  categorias = [...secaoCategorias.querySelectorAll('.categoria-item:not([data-categoria="todos"])')]
    .map((botao) => ({
      id: botao.dataset.categoria,
      nome: botao.textContent.replace(/\s+/g, " ").trim()
    }))
    .filter((categoria) => categoria.id && categoria.nome);

  // Garante categoria "Sem categoria"
  const temSemCategoria = categorias.some(c => c.id === idCategoriaSemCategoria);
  if (!temSemCategoria) {
    categorias.push({ id: idCategoriaSemCategoria, nome: nomeCategoriaSemCategoria });
  }

  // Carrega livros dos cards iniciais do HTML
  livros = criarLivrosIniciais();

  // Renderiza tudo imediatamente
  ordenarCategorias();
  sincronizarCategoriaAtiva(document.querySelector("#categorias").value);
  renderizarLivros();
}

async function inicializarDriveEPronto() {
  try {
    await DriveAPI.init();              // carrega gapi + cria/busca pasta "Biblioteca Digital"
    await carregarDoDrive();            // lê biblioteca.json da appDataFolder
    drivePronto = true;

    // Recarrega arrays locais com dados do Drive
    categorias = await carregarCategorias();
    livros = await carregarLivros();

    // === FALLBACK: primeira execução → Drive vazio → usa cards iniciais do HTML ===
    if (livros.length === 0) {
      console.log('Primeira execução: Drive vazio → populando com livros iniciais do HTML');
      livros = criarLivrosIniciais();
      bibliotecaDrive.livros = livros;
      // Salva no Drive para próximas vezes
      DriveAPI.salvarBiblioteca(bibliotecaDrive);
    }
    // ========================================================================

    // Re-renderiza tudo
    ordenarCategorias();
    sincronizarCategoriaAtiva(document.querySelector("#categorias").value);
    renderizarLivros();
  } catch (e) {
    console.error('Falha ao inicializar Drive:', e);
    // Fallback: usa dados iniciais do HTML (não do Drive vazio)
    drivePronto = true;
    categorias = [...secaoCategorias.querySelectorAll('.categoria-item:not([data-categoria="todos"])')]
      .map((botao) => ({
        id: botao.dataset.categoria,
        nome: botao.textContent.replace(/\s+/g, " ").trim()
      }))
      .filter((categoria) => categoria.id && categoria.nome);
    // Garante "Sem categoria"
    if (!categorias.some(c => c.id === idCategoriaSemCategoria)) {
      categorias.push({ id: idCategoriaSemCategoria, nome: nomeCategoriaSemCategoria });
    }
    livros = criarLivrosIniciais();
    ordenarCategorias();
    sincronizarCategoriaAtiva(document.querySelector("#categorias").value);
    renderizarLivros();
  }
}

// Nova função: carrega biblioteca.json do Drive para bibliotecaDrive
async function carregarDoDrive() {
  try {
    bibliotecaDrive = await DriveAPI.lerBiblioteca();
    bibliotecaDrive.livros = bibliotecaDrive.livros || [];
    bibliotecaDrive.categorias = bibliotecaDrive.categorias || [];
  } catch (e) {
    console.error('Erro ao ler biblioteca.json do Drive:', e);
    bibliotecaDrive = { livros: [], categorias: [] };
  }
}

// Inicia a aplicação
inicializarApp();
// =====================================================

// Aplica o filtro da categoria selecionada no menu de navegação.
secaoCategorias.addEventListener("click", (evento) => {
  const botao = evento.target.closest("button[data-categoria]");
  if (!botao) return;

  sincronizarCategoriaAtiva(botao.dataset.categoria);
  renderizarLivros();
});

// Obtém as referências necessárias para selecionar e apresentar o arquivo do livro.
const campoArquivoLivro = document.querySelector("#arquivo-livro");
const campoTituloLivro = document.querySelector("#nome");
const areaUploadLivro = document.querySelector("#upload-area-livro");
const textoAreaUploadLivro = areaUploadLivro.querySelector(".upload-area-texto");
const painelArquivoSelecionado = document.querySelector("#arquivo-selecionado");
const mensagemUpload = document.querySelector("#mensagem-upload");
let tituloSugeridoPeloArquivo = "";

// Restaura a área de upload e limpa o título apenas se ele foi sugerido pelo arquivo.
function limparArquivoSelecionado() {
  campoArquivoLivro.value = "";
  painelArquivoSelecionado.hidden = true;
  painelArquivoSelecionado.querySelector(".arquivo-nome").textContent = "";
  painelArquivoSelecionado.querySelector(".arquivo-tamanho").textContent = "";
  areaUploadLivro.classList.remove("has-file");
  textoAreaUploadLivro.textContent =
    "Clique para selecionar ou arraste o arquivo aqui";
  mensagemUpload.hidden = true;
  mensagemUpload.textContent = "";

  if (campoTituloLivro.value === tituloSugeridoPeloArquivo) {
    campoTituloLivro.value = "";
  }
  tituloSugeridoPeloArquivo = "";
}

// Exibe o arquivo escolhido, sugere um título com base no nome e mostra o tamanho.
campoArquivoLivro.addEventListener("change", () => {
  const arquivo = campoArquivoLivro.files[0];
  if (!arquivo) {
    limparArquivoSelecionado();
    return;
  }

  const tituloArquivo = arquivo.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, campoTituloLivro.maxLength);

  tituloSugeridoPeloArquivo = tituloArquivo;
  campoTituloLivro.value = tituloArquivo;

  painelArquivoSelecionado.querySelector(".arquivo-nome").textContent = arquivo.name;
  painelArquivoSelecionado.querySelector(".arquivo-tamanho").textContent =
    `${(arquivo.size / 1024 / 1024).toFixed(2)} MB`;
  painelArquivoSelecionado.hidden = false;
  areaUploadLivro.classList.add("has-file");
  textoAreaUploadLivro.textContent = "Arquivo selecionado";

  mensagemUpload.textContent =
    "Arquivo selecionado. Complete os dados e clique em Adicionar livro.";
  mensagemUpload.hidden = false;
});

// Permite selecionar o arquivo por arraste, validando a extensão antes de carregá-lo.
areaUploadLivro.addEventListener("dragenter", (evento) => {
  evento.preventDefault();
  areaUploadLivro.classList.add("dragover");
});

areaUploadLivro.addEventListener("dragover", (evento) => {
  evento.preventDefault();
});

areaUploadLivro.addEventListener("dragleave", (evento) => {
  if (evento.relatedTarget && areaUploadLivro.contains(evento.relatedTarget)) {
    return;
  }
  areaUploadLivro.classList.remove("dragover");
});

areaUploadLivro.addEventListener("drop", (evento) => {
  evento.preventDefault();
  areaUploadLivro.classList.remove("dragover");

  const arquivo = evento.dataTransfer.files[0];
  if (!arquivo) return;

  const extensao = arquivo.name.split(".").pop().toLowerCase();
  if (!["pdf", "epub", "mobi"].includes(extensao)) {
    mensagemUpload.textContent = "Formato não permitido. Selecione um arquivo PDF, EPUB ou MOBI.";
    mensagemUpload.hidden = false;
    return;
  }

  const transferencia = new DataTransfer();
  transferencia.items.add(arquivo);
  campoArquivoLivro.files = transferencia.files;
  campoArquivoLivro.dispatchEvent(new Event("change", { bubbles: true }));
});

// Remove o arquivo selecionado e restaura a área de upload.
document.querySelector("#remover-arquivo").addEventListener("click", () => {
  limparArquivoSelecionado();
});

// Cadastra o livro, salva a coleção e atualiza a estante.
formularioLivro.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const titulo = document.querySelector("#nome").value.trim();
  const autor = document.querySelector("#autor").value.trim();
  const categoriaId = document.querySelector("#tema").value;
  const formato = document.querySelector("#formato").selectedOptions[0].textContent.trim();
  const arquivo = campoArquivoLivro.files[0];
  const linkInformado = document.querySelector("#link-livro").value.trim();

  if (!arquivo && !linkInformado) {
    document.querySelector("#mensagem-form").textContent =
      "Selecione um arquivo ou informe um link.";
    return;
  }

  let url = linkInformado;
  if (arquivo) {
    // Upload para o Drive (pasta "Biblioteca Digital")
    const mensagemForm = document.querySelector("#mensagem-form");
    mensagemForm.textContent = "Enviando arquivo para o Drive…";
    try {
      const resultado = await DriveAPI.uploadArquivo(arquivo, (progresso) => {
        mensagemForm.textContent = `Enviando… ${Math.round(progresso)}%`;
      });
      url = resultado.webViewLink || `https://drive.google.com/file/d/${resultado.id}/view`;
      mensagemForm.textContent = "Arquivo enviado! Salvando livro…";
    } catch (e) {
      console.error('Erro no upload:', e);
      mensagemForm.textContent = "Erro ao enviar arquivo para o Drive.";
      return;
    }
  }
  livros.push({
    id: `livro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    titulo,
    autor,
    categoriaId,
    formato,
    url,
    favorito: false

  });

  salvarLivros();
  renderizarLivros();
  formularioLivro.reset();
  limparArquivoSelecionado();
  document.querySelector("#mensagem-form").textContent = "Livro adicionado.";
});

// Direciona as ações do card: favoritar, mover ou remover o livro.
gradeLivros.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-acao-livro]");
  if (!botao || !gradeLivros.contains(botao)) return;

  const card = botao.closest(".video-card");
  const livro = livros.find((item) => item.id === card?.dataset.livroId);
  if (!livro) return;

  // Alterna o favorito, salva a alteração e atualiza a estante.
  if (botao.dataset.acaoLivro === "alternar-favorito") {
    livro.favorito = !Boolean(livro.favorito);
    salvarLivros();
    renderizarLivros();
    return;
  }

  // Abre o seletor de destino sem alterar a categoria do livro.
  if (botao.dataset.acaoLivro === "abrir-mover") {
    const controles = card.querySelector(".controles-mover-livro");
    const destino = controles.querySelector("select");
    preencherDestinos(destino);
    controles.hidden = false;
    destino.focus();
    return;
  }

  // Valida e salva a nova categoria escolhida para o livro.
  if (botao.dataset.acaoLivro === "confirmar-mover") {
    const controles = card.querySelector(".controles-mover-livro");
    const destino = controles.querySelector("select").value;
    const mensagem = controles.querySelector(".mensagem-mover-livro");

    if (!destino) {
      mensagem.textContent = "Escolha uma categoria de destino.";
      return;
    }

    if (destino === livro.categoriaId) {
      mensagem.textContent = "Este livro já está nessa categoria.";
      return;
    }

    const categoriaDestino = categorias.find(
      (categoria) => categoria.id === destino
    );
    const livrosAtualizados = livros.map((item) =>
      item.id === livro.id ? { ...item, categoriaId: destino } : item
    );

    if (!salvarLivros(livrosAtualizados)) {
      mensagem.textContent = "Não foi possível salvar a mudança de categoria.";
      exibirMensagemOperacao(mensagem.textContent);
      return;
    }

    livros = livrosAtualizados;
    renderizarLivros();
    exibirMensagemOperacao(
      `Livro "${livro.titulo}" movido para a categoria "${categoriaDestino.nome}" com sucesso.`
    );
    return;
  }

  // Remove o livro somente após a confirmação da pessoa.
  if (botao.dataset.acaoLivro === "excluir") {
    const confirmacao = window.confirm(`Excluir o livro "${livro.titulo}"?`);
    if (!confirmacao) return;

    livros = livros.filter((item) => item.id !== livro.id);
    salvarLivros();
    renderizarLivros();
  }
});

// Fecha os menus de ações quando a pessoa clica fora deles.
document.addEventListener("click", (evento) => {
  document.querySelectorAll(".menu-acoes-livro[open]").forEach((menu) => {
    if (!menu.contains(evento.target)) {
      menu.open = false;
    }
  });
});