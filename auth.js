(function () {
  const botaoAutenticacao = document.querySelector("#google-auth-button");
  const statusAutenticacao = document.querySelector("#google-auth-status");
  const mensagemErroPadrao = "Não foi possível conectar. Tente novamente.";

  let tokenAtual = null;
  let tokenExpiraEm = 0;
  let estadoAutenticacao = "disconnected";
  let clienteToken = null;
  let requisicaoTokenPendente = null;
  let promessaConexao = null;
  let emailConta = "";

  function renderizarEstado(mensagem) {
    if (estadoAutenticacao === "connecting") {
      botaoAutenticacao.textContent = "Conectando…";
      botaoAutenticacao.disabled = true;
      statusAutenticacao.textContent = "";
    } else if (estadoAutenticacao === "connected") {
      botaoAutenticacao.textContent = "Desconectar";
      botaoAutenticacao.disabled = false;
      statusAutenticacao.textContent = emailConta
        ? `Conectado · ${emailConta}`
        : "Conectado";
    } else {
      botaoAutenticacao.textContent = "Conectar com Google";
      botaoAutenticacao.disabled = false;
      statusAutenticacao.textContent = mensagem || "";
    }

    statusAutenticacao.classList.toggle(
      "google-auth-status--error",
      estadoAutenticacao === "error"
    );
  }

  function definirEstado(novoEstado, mensagem) {
    if (estadoAutenticacao === novoEstado) {
      renderizarEstado(mensagem);
      return;
    }

    estadoAutenticacao = novoEstado;
    renderizarEstado(mensagem);
    document.dispatchEvent(
      new CustomEvent("google-auth-changed", {
        detail: { conectado: novoEstado === "connected" }
      })
    );
  }

  function mensagemDoErro(erro) {
    const tipo = erro && (erro.type || erro.error);

    if (tipo === "popup_closed_by_user") {
      return "Login cancelado. Tente conectar novamente.";
    }
    if (tipo === "popup_failed_to_load") {
      return "Janela de login bloqueada. Permita pop-ups e tente novamente.";
    }
    if (erro && erro.message === "google-script-load-failed") {
      return "Não foi possível carregar o login Google. Verifique a conexão.";
    }
    return mensagemErroPadrao;
  }

  function inicializarClienteToken() {
    if (clienteToken) {
      return true;
    }

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      return false;
    }

    clienteToken = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (resposta) => {
        const requisicao = requisicaoTokenPendente;
        requisicaoTokenPendente = null;

        if (!requisicao) {
          return;
        }
        if (resposta.error) {
          requisicao.reject(resposta);
          return;
        }

        const validadeSegundos = Number(resposta.expires_in);
        if (
          typeof resposta.access_token !== "string" ||
          !Number.isFinite(validadeSegundos) ||
          validadeSegundos <= 0
        ) {
          requisicao.reject(new Error("Resposta de autenticação inválida."));
          return;
        }

        tokenAtual = resposta.access_token;
        tokenExpiraEm = Date.now() + validadeSegundos * 1000;
        requisicao.resolve(tokenAtual);
      },
      error_callback: (erro) => {
        const requisicao = requisicaoTokenPendente;
        requisicaoTokenPendente = null;
        if (requisicao) {
          requisicao.reject(erro);
        }
      }
    });

    return true;
  }

  function solicitarToken(opcoes) {
    if (requisicaoTokenPendente) {
      return requisicaoTokenPendente.promise;
    }

    if (!clienteToken) {
      return Promise.reject(new Error("google-script-load-failed"));
    }

    let resolver;
    let rejeitar;
    const promise = new Promise((resolve, reject) => {
      resolver = resolve;
      rejeitar = reject;
    });
    requisicaoTokenPendente = {
      resolve: resolver,
      reject: rejeitar,
      promise
    };

    try {
      if (opcoes) {
        clienteToken.requestAccessToken(opcoes);
      } else {
        clienteToken.requestAccessToken();
      }
    } catch (erro) {
      requisicaoTokenPendente = null;
      rejeitar(erro);
    }

    return promise;
  }

  async function validarContaGoogle(token) {
    try {
      const resposta = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resposta.ok) {
        throw new Error(`Drive API respondeu com status ${resposta.status}.`);
      }

      const dados = await resposta.json();
      if (tokenAtual === token && estadoAutenticacao === "connected") {
        emailConta =
          typeof dados.user?.emailAddress === "string"
            ? dados.user.emailAddress
            : "";
        renderizarEstado();
      }
    } catch (erro) {
      console.warn("Falha ao validar a conta Google no Drive.", erro);
    }
  }

  function conectarGoogle() {
    if (estadoAutenticacao === "connected") {
      return Promise.resolve(tokenAtual);
    }
    if (promessaConexao) {
      return promessaConexao;
    }
    if (!clienteToken) {
      definirEstado(
        "error",
        "O login Google ainda está carregando. Tente novamente em instantes."
      );
      return Promise.resolve(null);
    }

    emailConta = "";
    definirEstado("connecting");
    promessaConexao = solicitarToken()
      .then((token) => {
        definirEstado("connected");
        validarContaGoogle(token);
        return token;
      })
      .catch((erro) => {
        tokenAtual = null;
        tokenExpiraEm = 0;
        definirEstado("error", mensagemDoErro(erro));
        return null;
      })
      .finally(() => {
        promessaConexao = null;
      });

    return promessaConexao;
  }

  function desconectarGoogle() {
    const tokenRevogado = tokenAtual;
    tokenAtual = null;
    tokenExpiraEm = 0;
    emailConta = "";
    definirEstado("disconnected");

    if (!tokenRevogado || !window.google?.accounts?.oauth2) {
      return;
    }

    try {
      window.google.accounts.oauth2.revoke(tokenRevogado, (resposta) => {
        if (resposta?.error) {
          console.warn("Falha ao revogar o acesso Google.");
          definirEstado(
            "error",
            "Sessão encerrada, mas não foi possível revogar o acesso no Google."
          );
        }
      });
    } catch (erro) {
      console.warn("Falha ao revogar o acesso Google.", erro);
      definirEstado(
        "error",
        "Sessão encerrada, mas não foi possível revogar o acesso no Google."
      );
    }
  }

  function obterTokenValido() {
    if (estadoAutenticacao !== "connected" || !tokenAtual) {
      return Promise.reject(
        new Error("Conecte-se ao Google antes de solicitar um token.")
      );
    }
    if (tokenExpiraEm - Date.now() > 60000) {
      return Promise.resolve(tokenAtual);
    }

    return solicitarToken({ prompt: "" }).catch((erro) => {
      tokenAtual = null;
      tokenExpiraEm = 0;
      emailConta = "";
      definirEstado("error", mensagemDoErro(erro));
      throw erro;
    });
  }

  function estaConectado() {
    return estadoAutenticacao === "connected";
  }

  const scriptGoogle = document.querySelector("#google-identity-services");
  let clienteInicializado = false;
  try {
    clienteInicializado = inicializarClienteToken();
  } catch (erro) {
    definirEstado("error", mensagemDoErro(erro));
  }

  if (!clienteInicializado) {
    scriptGoogle.addEventListener(
      "load",
      () => {
        try {
          if (!inicializarClienteToken()) {
            throw new Error("google-script-load-failed");
          }
        } catch (erro) {
          definirEstado("error", mensagemDoErro(erro));
        }
      },
      { once: true }
    );
    scriptGoogle.addEventListener(
      "error",
      () => {
        definirEstado(
          "error",
          "Não foi possível carregar o login Google. Verifique a conexão."
        );
      },
      { once: true }
    );
  }

  botaoAutenticacao.addEventListener("click", () => {
    if (estadoAutenticacao === "connected") {
      desconectarGoogle();
    } else {
      conectarGoogle();
    }
  });

  renderizarEstado();

  window.conectarGoogle = conectarGoogle;
  window.desconectarGoogle = desconectarGoogle;
  window.obterTokenValido = obterTokenValido;
  window.estaConectado = estaConectado;
})();
