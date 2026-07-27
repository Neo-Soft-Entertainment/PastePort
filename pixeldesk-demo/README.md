# PixelDesk Demo

Aplicação local para testar o PastePort e produzir screenshots promocionais em um contexto realista de gerenciamento de imagens.

O projeto usa somente HTML, CSS e JavaScript. Não há dependências, backend, fontes remotas, bibliotecas ou imagens externas.

## Abrir o site

Para visualizar a interface sem servidor:

1. Abra a pasta `pixeldesk-demo`.
2. Clique duas vezes em `index.html`.
3. O site será aberto diretamente no navegador.

Os parâmetros de URL também funcionam com o arquivo local. Exemplo:

```text
index.html?screenshot=true&state=uploaded
```

Para testar a extensão PastePort, abra o site por HTTP, pois o manifesto da extensão prioriza páginas HTTP e HTTPS:

```powershell
cd pixeldesk-demo
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Carregar a extensão PastePort

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `pasteport`.
5. Confirme que a extensão está ativada.
6. Atualize a aba do PixelDesk sempre que recarregar a extensão.

Todo o processamento é local. O site e a extensão não enviam imagens para servidores.

## Preparar os estados

Quando o site é aberto normalmente, um painel chamado **Preparar visual** aparece no canto inferior direito:

- **Estado inicial** restaura a área de upload vazia.
- **Imagem adicionada** gera `pasteport-demo.png` localmente e a insere no input usando `DataTransfer`.
- **Limpar** remove a imagem atual e restaura a interface.

A imagem demonstrativa é gerada com Canvas e convertida em `Blob` e `File`. Nenhum arquivo externo é utilizado.

## Abrir em 1280 × 800

No Chrome:

1. Abra as Ferramentas do desenvolvedor com `F12`.
2. Ative a barra de dispositivos com `Ctrl+Shift+M`.
3. Escolha o modo responsivo.
4. Defina a largura como `1280` e a altura como `800`.
5. Use zoom de `100%`.
6. Recarregue a página.

A interface principal foi dimensionada para mostrar o cabeçalho, o upload e as quatro imagens recentes dentro dessa área.

## Screenshot 1 — Modal PastePort

Abra:

```text
http://localhost:8080/?screenshot=true&state=initial
```

Depois:

1. Clique no botão **Adicionar imagem** ou na área **Envie uma nova imagem**.
2. O modal PastePort será aberto próximo ao local do clique.
3. Capture a tela mostrando a interface PixelDesk, a área de upload e as opções do modal.

## Screenshot 2 — Imagem adicionada

Abra:

```text
http://localhost:8080/?screenshot=true&state=uploaded
```

Esse estado gera e insere automaticamente o arquivo:

```text
pasteport-demo.png
```

A tela mostrará a prévia, os metadados, o indicador de sucesso e o novo cartão no início das imagens recentes.

## Screenshot 3 — Fluxo completo

Abra:

```text
http://localhost:8080/?screenshot=true&state=initial&guide=true
```

A faixa superior exibirá:

```text
Copie uma imagem
Clique em Adicionar imagem
Pressione Ctrl + V
```

Clique na área de upload para abrir o PastePort antes de capturar a tela.

## Ocultar o painel de demonstração

Adicione à URL:

```text
?screenshot=true
```

Se já houver parâmetros, use:

```text
&screenshot=true
```

O modo screenshot também desativa transições e animações para garantir capturas consistentes.

## Testar upload nativo

1. Clique em **Adicionar imagem** ou **Selecionar imagem**.
2. No modal PastePort, clique em **Selecionar do computador**.
3. Escolha uma imagem PNG, JPEG, WebP ou GIF de até 10 MB.
4. Confirme que a prévia e os metadados aparecem.
5. Confirme que o arquivo foi adicionado no início de **Imagens recentes**.

Sem a extensão, os dois controles abrem diretamente o seletor nativo.

## Testar colagem pelo PastePort

1. Copie uma imagem.
2. Clique em **Adicionar imagem** ou na área de upload.
3. No PastePort, pressione `Ctrl+V`.
4. Confirme que a imagem aparece na área de upload.
5. Confirme que `input` e `change` atualizaram a interface e a lista de recentes.

## Testar drag-and-drop

1. Arraste uma imagem PNG, JPEG, WebP ou GIF para a área de upload.
2. Confirme que a borda fica destacada.
3. Confirme que o texto muda para **Solte a imagem aqui**.
4. Solte o arquivo.
5. Confirme a prévia, os metadados e o novo cartão.

Arquivos acima de 10 MB ou formatos incompatíveis exibem uma mensagem de validação.

## Estrutura

```text
pixeldesk-demo/
├── index.html
├── styles.css
├── script.js
└── README.md
```
