// js/drive.js
(function () {
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const DEBOUNCE_MS = 1500;

  let pastaLivrosId = null;
  let jsonFileId = null;
  let debounceTimer = null;
  let statusCallback = null;
  let salvando = false;
  let dadosPendentes = null; // última versão que ainda precisa ser gravada
  let naoSalvo = false;

  // ---------- Helpers ----------
  function setStatusCallback(fn) {
    statusCallback = fn;
  }

  function atualizarStatus(texto, tipo = 'info') {
    if (statusCallback) statusCallback(texto, tipo);
  }

  async function headers() {
    const token = await window.obterTokenValido(); // do auth.js
    return { Authorization: 'Bearer ' + token };
  }

  // Toda chamada ao Drive passa por aqui. Se a resposta não for OK, LANÇA erro
  // (assim ninguém confunde falha com "biblioteca vazia").
  async function chamar(url, opcoes = {}) {
    const h = await headers();
    const resp = await fetch(url, {
      ...opcoes,
      headers: { ...h, ...(opcoes.headers || {}) }
    });
    if (!resp.ok) throw new Error('Drive respondeu ' + resp.status);
    return resp;
  }

  // ---------- Pasta "Biblioteca Digital" ----------
  async function obterOuCriarPastaLivros() {
    if (pastaLivrosId) return pastaLivrosId;

    const q = encodeURIComponent(
      "name='Biblioteca Digital' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    );
    const lista = await (await chamar(API + '/files?q=' + q + '&fields=files(id,name)')).json();
    if (lista.files && lista.files.length) {
      pastaLivrosId = lista.files[0].id;
      return pastaLivrosId;
    }

    const criada = await (await chamar(API + '/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Biblioteca Digital',
        mimeType: 'application/vnd.google-apps.folder'
      })
    })).json();
    pastaLivrosId = criada.id;
    return pastaLivrosId;
  }

  // ---------- appDataFolder: biblioteca.json ----------
  async function acharJson() {
    const q = encodeURIComponent("name='biblioteca.json' and trashed=false");
    const r = await (await chamar(
      API + '/files?spaces=appDataFolder&q=' + q + '&fields=files(id,modifiedTime)'
    )).json();
    return (r.files && r.files[0]) || null;
  }

  async function lerBibliotecaJson() {
    const arquivo = await acharJson();
    if (!arquivo) {
      jsonFileId = null;
      return { livros: [], categorias: [], versao: 1 }; // primeiro uso
    }
    jsonFileId = arquivo.id;
    return await (await chamar(API + '/files/' + arquivo.id + '?alt=media')).json();
  }

  function montarMultipart(metadata, conteudo) {
    const limite = 'biblioteca_' + Date.now();
    const corpo =
      '--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n--' + limite + '\r\nContent-Type: application/json\r\n\r\n' +
      conteudo +
      '\r\n--' + limite + '--';
    return { corpo, tipo: 'multipart/related; boundary=' + limite };
  }

  async function gravarBibliotecaJson(dados) {
    const conteudo = JSON.stringify({ ...dados, atualizadoEm: new Date().toISOString() });

    if (!jsonFileId) {
      const existente = await acharJson();
      if (existente) jsonFileId = existente.id;
    }

    if (jsonFileId) {
      // Atualizar: o endereço de upload é /upload/drive/v3/...
      await chamar(UPLOAD + '/files/' + jsonFileId + '?uploadType=media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: conteudo
      });
    } else {
      // Criar DENTRO da appDataFolder
      const { corpo, tipo } = montarMultipart(
        { name: 'biblioteca.json', parents: ['appDataFolder'] },
        conteudo
      );
      const criado = await (await chamar(UPLOAD + '/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { 'Content-Type': tipo },
        body: corpo
      })).json();
      jsonFileId = criado.id;
    }
  }

  // ---------- Salvamento com debounce ----------
  async function salvarAgora() {
    clearTimeout(debounceTimer);
    if (!dadosPendentes || salvando) return;

    salvando = true;
    const dados = dadosPendentes;
    dadosPendentes = null;
    atualizarStatus('Salvando…', 'saving');
    try {
      await gravarBibliotecaJson(dados);
      atualizarStatus('Salvo', 'saved');
      naoSalvo = Boolean(dadosPendentes);
    } catch (e) {
      console.error('Erro ao salvar no Drive:', e);
      if (!dadosPendentes) dadosPendentes = dados; // mantém para tentar de novo
      naoSalvo = true;
      atualizarStatus('Erro ao salvar', 'error');
      salvando = false;
      return;
    }
    salvando = false;
    if (dadosPendentes) salvarAgora(); // houve alteração durante o salvamento
  }

  // imediato = true (use depois de um upload): grava sem esperar o debounce
  function agendarSalvamento(dados, imediato = false) {
    dadosPendentes = dados;
    naoSalvo = true;
    atualizarStatus('Salvando…', 'saving');
    clearTimeout(debounceTimer);
    if (imediato) {
      salvarAgora();
    } else {
      debounceTimer = setTimeout(salvarAgora, DEBOUNCE_MS);
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (naoSalvo || salvando) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ---------- Upload de arquivo para a pasta ----------
  async function enviarArquivoParaDrive(arquivo, onProgress) {
    const pastaId = await obterOuCriarPastaLivros();
    const h = await headers();

    const metadata = { name: arquivo.name, parents: [pastaId] };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', arquivo);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', UPLOAD + '/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size');
      xhr.setRequestHeader('Authorization', h.Authorization);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload falhou: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Erro de rede no upload'));
      xhr.send(formData);
    });
  }

  // ---------- API pública ----------
  window.DriveAPI = {
    init: async () => {
      await obterOuCriarPastaLivros();
    },
    lerBiblioteca: lerBibliotecaJson,
    salvarBiblioteca: agendarSalvamento,
    salvarAgora,
    setStatusCallback,
    uploadArquivo: enviarArquivoParaDrive,
    getPastaId: () => pastaLivrosId
  };
})();