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
│   └── script.js
├── index.html
└── README.md
```

## Como executar

Não é necessário instalar nada:

1. Baixe ou clone este repositório.
2. Abra o arquivo `index.html` em um navegador.

Também é possível publicar o projeto como site estático pelo GitHub Pages. No repositório, acesse **Settings → Pages**, escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/(root)`. O GitHub exibirá o endereço quando a publicação estiver pronta.

## Armazenamento dos dados

Livros e categorias cadastrados são salvos no `localStorage` do navegador. Esses dados ficam no navegador e no dispositivo usados para acessar a página; eles não são sincronizados automaticamente entre pessoas, dispositivos ou navegadores.

Os arquivos selecionados no formulário não são enviados para um servidor. Para que um livro continue acessível em outros dispositivos, use um link acessível pela internet. Links criados a partir de um arquivo selecionado no computador são temporários e podem deixar de funcionar depois de recarregar a página.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)

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
