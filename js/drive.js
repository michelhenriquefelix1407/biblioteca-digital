// js/drive.js
(function () {
  let gapiCarregado = false;
  let pastaLivrosId = null;
  let debounceTimer = null;
  const DEBOUNCE_MS = 1500;
  let statusCallback = null;

  // ---------- Helpers ----------
  function carregarGapi() {
    return new Promise((resolve, reject) => {
      if (window.gapi?.client?.drive) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
            gapiCarregado = true;
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      };
      script.onerror = () => reject(new Error('Falha ao carregar gapi'));
      document.head.appendChild(script);
    });
  }

  function obterToken() {
    return window.obterTokenValido(); // do auth.js
  }

  function headers() {
    return obterToken().then(token => ({ Authorization: `Bearer ${token}` }));
  }

  function setStatusCallback(fn) {
    statusCallback = fn;
  }

  function atualizarStatus(texto, tipo = 'info') {
    if (statusCallback) statusCallback(texto, tipo);
  }

  // ---------- Pasta "Biblioteca Digital" ----------
  async function obterOuCriarPastaLivros() {
    if (pastaLivrosId) return pastaLivrosId;

    await carregarGapi();
    const h = await headers();

    // Buscar pasta existente
    const respBusca = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%22Biblioteca+Digital%22+and+mimeType%3D%22application%2Fvnd.google-apps.folder%22+and+trashed%3Dfalse&fields=files(id,name)', { headers: h });
    const dataBusca = await respBusca.json();
    if (dataBusca.files?.length) {
      pastaLivrosId = dataBusca.files[0].id;
      return pastaLivrosId;
    }

    // Criar pasta
    const respCriar = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Biblioteca Digital',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const dataCriar = await respCriar.json();
    pastaLivrosId = dataCriar.id;
    return pastaLivrosId;
  }

  // ---------- appDataFolder: biblioteca.json ----------
  async function lerBibliotecaJson() {
    await carregarGapi();
    const h = await headers();

    const resp = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%22biblioteca.json%22+and+trashed%3Dfalse&spaces=appDataFolder&fields=files(id,name)', { headers: h });
    const data = await resp.json();

    if (!data.files?.length) {
      return { livros: [], categorias: [], versao: 1 };
    }

    const fileId = data.files[0].id;
    const respConteudo = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: h });
    if (!respConteudo.ok) {
      throw new Error('Falha ao ler biblioteca.json');
    }
    return await respConteudo.json();
  }

  async function gravarBibliotecaJson(dados) {
    await carregarGapi();
    const h = await headers();

    // Buscar arquivo existente
    const respBusca = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%22biblioteca.json%22+and+trashed%3Dfalse&spaces=appDataFolder&fields=files(id)', { headers: h });
    const dataBusca = await respBusca.json();

    const body = JSON.stringify({ ...dados, versao: (dados.versao || 0) + 1, atualizadoEm: new Date().toISOString() });
    const metadata = { name: 'biblioteca.json', mimeType: 'application/json' };

    let resp;
    if (dataBusca.files?.length) {
      // Atualizar
      const fileId = dataBusca.files[0].id;
      resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: h,
        body: criarMultipart(metadata, body)
      });
    } else {
      // Criar
      resp = await fetch('https://www.googleapis.com/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: h,
        body: criarMultipart(metadata, body)
      });
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Falha ao gravar biblioteca.json');
    }
  }

  function criarMultipart(metadata, fileContent) {
    const boundary = '----biblioteca_delimitador' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const close = `\r\n--${boundary}--\r\n`;

    const parts = [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      fileContent,
      close
    ];

    return parts.join('');
  }

  // ---------- Salvamento com debounce ----------
  function agendarSalvamento(dados) {
    atualizarStatus('Salvando…', 'saving');
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        await gravarBibliotecaJson(dados);
        atualizarStatus('Salvo', 'saved');
      } catch (e) {
        console.error('Erro ao salvar no Drive:', e);
        atualizarStatus('Erro ao salvar', 'error');
      }
    }, DEBOUNCE_MS);
  }

  // ---------- Upload de arquivo para a pasta ----------
  async function enviarArquivoParaDrive(arquivo, onProgress) {
    const pastaId = await obterOuCriarPastaLivros();
    const h = await headers();

    const metadata = {
      name: arquivo.name,
      parents: [pastaId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', arquivo);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink');
      xhr.setRequestHeader('Authorization', `Bearer ${h.Authorization.split(' ')[1]}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload falhou: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Erro de rede no upload'));
      xhr.send(formData);
    });
  }

  // ---------- API pública ----------
  window.DriveAPI = {
    init: async () => {
      await carregarGapi();
      await obterOuCriarPastaLivros();
    },
    lerBiblioteca: lerBibliotecaJson,
    salvarBiblioteca: agendarSalvamento,
    setStatusCallback,
    uploadArquivo: enviarArquivoParaDrive,
    getPastaId: () => pastaLivrosId
  };
})();