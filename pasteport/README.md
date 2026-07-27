# PastePort

PastePort é uma extensão Manifest V3 para navegadores Chromium que permite colar imagens diretamente em campos de upload. A imagem vem do evento `paste`, é convertida em `File`, atribuída ao input original com `DataTransfer` e entregue ao site por eventos `input` e `change`.

Não há backend, telemetria, dependências ou código remoto.

## Recursos

- Interceptação conservadora de inputs de imagem, labels, dropzones e botões associados.
- Modal responsivo em Shadow DOM aberto, exibido como um balão junto ao ponto do clique e isolado do CSS da página.
- Galeria com as 10 imagens mais recentes da área de transferência.
- Captura de imagens com a permissão `clipboardRead` e documento offscreen.
- Pré-visualização local da imagem colada dentro da área de transferência do modal.
- Drag-and-drop de uma ou várias imagens.
- Validação de `accept`, `multiple` e limite configurável.
- Seletor nativo disponível no próprio modal, sem loop de interceptação.
- Inputs adicionados dinamicamente monitorados com `MutationObserver`.
- Suporte a inputs em Shadow DOM aberto e em frames onde o content script pode executar.
- Tema automático, claro e escuro.
- Lista de domínios ignorados e sites que devem preferir o seletor nativo.
- Processamento inteiramente local.

## Instalação local

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `pasteport` que contém o `manifest.json`.
5. Recarregue páginas que já estavam abertas antes da instalação.

O navegador exibirá o aviso da permissão para ler dados copiados e colados. Ela é necessária para montar a galeria local de imagens recentes.

Para aplicar mudanças durante o desenvolvimento, use o botão de recarregar no cartão da extensão e recarregue a página testada.

## Uso

1. Copie uma imagem.
2. Clique em um campo, label, botão ou área de upload de imagem.
3. O balão PastePort aparece junto ao ponto clicado.
4. Escolha uma imagem da galeria recente ou pressione `Ctrl+V` para usar uma nova.
5. O site recebe um `File` como se ele tivesse sido selecionado normalmente.

O botão **Selecionar do computador** fecha o modal e abre o seletor nativo. `Escape`, o botão de fechar e um clique no overlay também fecham o modal.

## Como funciona

Os content scripts são executados em `document_idle` e em todos os frames HTTP/HTTPS permitidos. Um listener de clique em capture phase procura um input correspondente antes do comportamento padrão. A detecção considera:

- o próprio `input[type="file"]`;
- `label.control`, atributo `for` e inputs aninhados;
- `aria-controls`, `aria-owns`, `data-target` e `data-for`;
- inputs próximos dentro de controles e containers com sinais de upload;
- o formulário, somente quando existe um único candidato compatível;
- inputs ocultos acionados por `input.click()`;
- inputs criados dinamicamente;
- raízes Shadow DOM abertas.

Quando não existe uma associação segura — por exemplo, há vários candidatos possíveis — o clique original é preservado.

Um documento offscreen lê periodicamente somente itens com MIME `image/*`. As imagens são deduplicadas por SHA-256 e as 10 mais recentes ficam no IndexedDB local da extensão. Textos e outros tipos de arquivo são ignorados. A galeria permite selecionar ou remover uma imagem e limpar todo o histórico.

Na colagem direta, o PastePort também lê `event.clipboardData.items`. Itens de imagem são transformados em novos objetos `File` com nomes como:

```text
pasteport-2026-07-27-14-35-21.png
```

São reconhecidos PNG, JPEG, WebP, GIF, BMP, SVG e AVIF. Para MIME types desconhecidos, os bytes iniciais são verificados; o arquivo só recebe uma extensão quando o formato pode ser identificado com segurança.

## Configurações

Clique no ícone do PastePort ou abra **Detalhes > Opções da extensão** no gerenciador de extensões. A página permite:

- ativar ou desativar o PastePort;
- restringir a uploads de imagem;
- ativar drag-and-drop;
- fechar o modal após a inserção;
- combinar arquivos existentes em inputs `multiple`;
- definir o limite de arquivos;
- alterar o prefixo do nome gerado;
- selecionar tema automático, claro ou escuro;
- ignorar domínios;
- preferir o seletor nativo em determinados domínios;
- ativar logs de depuração.
- limpar o histórico local de imagens.

As configurações usam `chrome.storage.sync`. Se ele não estiver disponível, a extensão usa `chrome.storage.local`.

Domínios são informados um por linha. Uma entrada como `example.com` também cobre `www.example.com`; uma entrada mais específica como `admin.example.com` limita a regra àquele subdomínio e seus descendentes.

## Privacidade e segurança

- Tudo é processado localmente no navegador.
- Nenhuma imagem é enviada a servidores.
- A extensão monitora periodicamente somente imagens da área de transferência para construir a galeria.
- O monitoramento é interrompido quando a opção **Ativar PastePort** é desmarcada.
- As 10 imagens mais recentes são armazenadas no IndexedDB local; não usam `storage.sync`.
- Textos, senhas e outros conteúdos não relacionados a imagens são ignorados.
- Imagens individuais podem ser removidas e todo o histórico pode ser apagado no modal ou nas opções.
- Não há telemetria ou coleta de dados.
- Não há scripts, estilos, fontes ou bibliotecas remotas.
- Não há `eval`.
- As miniaturas temporárias do modal são liberadas ao fechar; os itens da galeria permanecem apenas até serem removidos ou substituídos pelo limite.
- O modo de depuração registra apenas diagnósticos técnicos, nunca o conteúdo das imagens.

## Teste rápido local

A pasta `tests` contém uma página com inputs diretos, labels, dropzone, botão customizado, input dinâmico, `multiple`, iframe e Shadow DOM aberto.

Na raiz da extensão, inicie um servidor local:

```powershell
python -m http.server 8080 --directory tests
```

Abra `http://localhost:8080/manual-test.html`. O botão **Copiar imagem PNG de teste** gera uma imagem no próprio navegador e tenta copiá-la; também é possível copiar qualquer imagem normalmente.

## Roteiro de testes manuais

1. **Input simples:** clique no primeiro input sem `accept`, cole uma imagem e confirme o nome no resultado.
2. **Input oculto por label:** clique no label, cole a imagem e confirme que o input oculto recebe o arquivo.
3. **Dropzone:** clique na área destacada e teste tanto colagem quanto arraste de arquivo.
4. **React:** em uma aplicação React, confirme que o handler `onChange` recebe `event.target.files`.
5. **Vue:** em uma aplicação Vue, confirme que `@change` é executado.
6. **Angular:** em uma aplicação Angular, confirme que `(change)` é executado dentro da aplicação.
7. **`accept="image/png"`:** arraste ou cole JPEG/WebP e confira a mensagem de rejeição; PNG deve funcionar.
8. **`accept="image/*"`:** teste PNG, JPEG e WebP.
9. **Sem `accept`:** confirme que imagens são permitidas e outros arquivos arrastados são rejeitados.
10. **`multiple`:** arraste várias imagens e confirme todas até o limite configurado.
11. **Duas áreas:** use dois uploads na mesma página e confirme que cada modal entrega ao input clicado.
12. **Input dinâmico:** clique no botão da seção dinâmica e confirme a interceptação do input recém-criado.
13. **iframe:** clique no upload do iframe e confirme que o modal aparece dentro dele.
14. **Shadow DOM aberto:** clique no controle da seção Shadow DOM e confirme o resultado.
15. **Clipboard sem imagem:** copie texto, pressione `Ctrl+V` no modal e confira a mensagem específica.
16. **WebP:** confirme extensão `.webp`, MIME preservado e validação de `accept`.
17. **PNG:** confirme extensão `.png` e disparo dos eventos.
18. **JPEG:** confirme extensão `.jpg` e disparo dos eventos.
19. **Seletor nativo:** abra o modal, clique no botão nativo e confirme que ele abre uma vez.
20. **Domínio ignorado:** adicione `localhost` às opções, recarregue a página e confirme o comportamento totalmente nativo.

21. **Histórico:** copie imagens diferentes, aguarde a captura e confirme que o balão abre com a galeria em ordem recente.
22. **Seleção do histórico:** clique em uma miniatura e confirme que o arquivo é inserido sem `Ctrl+V`.
23. **Remoção:** remova um item e use a confirmação em duas etapas para limpar toda a galeria.

Também devem ser verificados `Escape`, clique no overlay, foco inicial, navegação com `Tab`, tema claro/escuro, input desabilitado e remoção do input enquanto o modal está aberto.

## Limitações conhecidas

- Shadow DOM fechado não expõe seus inputs; o PastePort preserva o comportamento do site.
- O Chrome não expõe o histórico nativo do sistema. O PastePort constrói sua própria lista a partir das imagens observadas depois da instalação e enquanto a extensão está ativa.
- Frames de origem restrita, páginas internas do navegador, Chrome Web Store e outros locais onde extensões não podem executar permanecem inalterados.
- Um site que chama `input.showPicker()` diretamente, sem gerar um clique observável e sem associação DOM identificável, pode abrir o seletor antes da extensão. O PastePort não substitui APIs globais da página.
- Se vários inputs forem igualmente prováveis para um botão customizado, a extensão não escolhe arbitrariamente e preserva o clique.
- Alguns sites recriam o input ou verificam eventos proprietários fora de `input`/`change`; esses fluxos podem exigir suporte específico.
- A abertura programática do seletor nativo depende de ativação do usuário e das políticas do navegador, especialmente em iframes cross-origin.
- Firefox não faz parte desta primeira versão.

## Estrutura

```text
pasteport/
├── manifest.json
├── content/
│   ├── content-script.js
│   ├── upload-detector.js
│   ├── file-injector.js
│   ├── modal.js
│   └── styles.css
├── background/
│   └── service-worker.js
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── assets/
│   ├── icon-source.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── tests/
│   └── manual-test.html
└── README.md
```
