# Biblioteca Digital Pessoal

Uma biblioteca digital pessoal para organizar livros e artigos em uma estante no navegador. O projeto usa HTML, CSS e JavaScript puro e não precisa de instalação de dependências ou etapa de build.

## Funcionalidades

- Pesquisar livros por título ou autor e filtrar por categoria.
- Navegar pelas categorias e ver os livros favoritos.
- Adicionar livros com um link ou selecionar um arquivo PDF, EPUB ou MOBI.
- Criar e excluir categorias e mover livros entre elas.
- Favoritar e remover livros da estante.
- Ajustar o tamanho da fonte e ativar o controle de acessibilidade.

## Estrutura do projeto

```text
.
├── css/
│   └── estilos.css
├── imagens/
│   ├── capa.jpg
│   └── ...imagens e ícones usados pela página
├── js/
│   ├── drive.js
│   └── script.js
├── auth.js
├── config.js
├── index.html
└── README.md
```

## Como executar

Não é necessário instalar dependências nem executar uma etapa de build. Como o projeto usa a autenticação do Google, abra-o por um servidor local ou pela publicação no GitHub Pages; abrir `index.html` diretamente como arquivo pode impedir o funcionamento do login.

1. Baixe ou clone este repositório.
2. Inicie um servidor local na pasta do projeto, por exemplo, com a extensão Live Server do VS Code.
3. Abra no navegador o endereço local fornecido pelo servidor e clique em **Conectar com Google**.

O endereço usado precisa estar autorizado como origem JavaScript nas configurações do cliente OAuth do Google. Para publicar no GitHub Pages, inclua também o endereço publicado nessa configuração.

Também é possível publicar o projeto como site estático pelo GitHub Pages. No repositório, acesse **Settings → Pages**, escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/(root)`. O GitHub exibirá o endereço quando a publicação estiver pronta.

## Armazenamento dos dados

Livros e categorias são armazenados e sincronizados na conta Google conectada. Os dados da biblioteca ficam no arquivo `biblioteca.json`, na área de dados do aplicativo do Google Drive (`appDataFolder`). Ao conectar pela primeira vez e não encontrar uma biblioteca salva, o projeto usa os livros iniciais definidos no HTML.

Quando um arquivo PDF, EPUB ou MOBI é selecionado no formulário, ele é enviado para uma pasta chamada **Biblioteca Digital** no Google Drive, e o link do arquivo é associado ao livro. Também é possível cadastrar um link externo. A sincronização e o envio de arquivos dependem de conexão à internet e da autorização da conta Google.

Se o Google Drive não puder ser inicializado, o aplicativo registra o erro no console do navegador e tenta usar um modo alternativo. No código atual, esse caminho alternativo não garante a exibição dos livros iniciais do HTML.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)
- Google Identity Services e Google Drive API

## Atualizar o projeto pelo terminal

Abra o terminal na pasta do projeto. No terminal integrado do VS Code, use **Terminal → New Terminal**. Se o terminal abrir em outra pasta, navegue até o projeto:

```powershell
cd "C:\Users\Cliente\Documents\BPD_-_20_10_Finalizado_-26-10"
```

Confira quais arquivos foram alterados:

```powershell
git status
```

Adicione as alterações, crie um commit e envie para o GitHub:

```powershell
git add .
git commit -m "Descreva suas alterações"
git push origin main
```

Substitua a mensagem do commit por uma descrição curta do que mudou, por exemplo, `Atualiza estilos da biblioteca`. Se o Git solicitar autenticação, entre na sua conta do GitHub pelo fluxo indicado no terminal ou no navegador. Nunca coloque sua senha ou token diretamente nos comandos ou neste arquivo.
