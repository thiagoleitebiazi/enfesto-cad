# ADR 0112 — O painel de inspiração e a criação com IA

## Contexto

Fase 8 do estudo de funcionalidades (ADR 0099). A referência tem uma parte de criação:
- o painel de inspiração (imagens de modelagem, tecido, cor, aviamento e estampa);
- e, por IA:
  - a imagem da peça a partir das inspirações;
  - o croqui de frente e costas;
  - variações de um desenho;
  - fotos comerciais num modelo virtual.

O estudo marcou o painel como **L** (local) e a geração como **S**: precisa de um serviço de geração de imagem, com a
conta e a chave de quem usa. A regra combinada:
- a IA só funciona com o serviço e a chave da pessoa;
- a chave fica guardada fora do código;
- o resultado é marcado como rascunho;
- sem chave, a janela diz que não está configurada.

## Decisão

**Modelo › Criação** tem dois botões que abrem a mesma janela, "Inspiração e IA" (`ui/PainelDeInspiracao.tsx`), na aba
pedida:
- **Inspiração**;
- **Criar com IA**.

### O painel de inspiração (local; `domain/inspiracao.ts`)

- **O conceito** do modelo em texto (o público, a ocasião, o clima).
- **As imagens:** "Trazer imagens…", até 16.
  - Cada uma é reduzida a 640 px, em JPEG, para o projeto não engordar.
  - As **cores principais** saem da imagem, pelo agrupamento em 5 cores (k-médias, começando pelas mais distantes, para
    sair sempre o mesmo). As quase iguais viram uma só, e o transparente não conta.
  - Cada imagem tem a **categoria** (modelagem, tecido, cor, aviamento, estampa ou outro), o **nome** e a **nota** (o
    que interessa nela).
- **A paleta do modelo:** até 8 cores, escolhidas clicando nas cores das imagens.
- **O filtro** por categoria.
- **Na tela:** os cartões com a cor da categoria no alto. A imagem feita pela IA leva o selo vermelho "Rascunho da
  IA".
- **Fica no projeto** (`Projeto.inspiracao`) e é lido conferido: a imagem que não é `data:image/…` fica de fora.

### A criação com IA

- **O serviço:** o de imagens da OpenAI.
  - Os modelos aceitos em outubro de 2026: `gpt-image-2.5-flare` (o padrão, para o dia a dia), `gpt-image-2.5-sunburst`
    (mais fiel às referências), `gpt-image-2`, `gpt-image-1.5` e `gpt-image-1-mini`. Outro nome pode ser digitado.
  - O `gpt-image-1` foi desligado em 23/10/2026, segundo a documentação.
  - Sem referência, o pedido vai para `POST /v1/images/generations` em JSON. Com referências, vai para
    `POST /v1/images/edits` num formulário em partes, com uma `image[]` por imagem.
  - A resposta vem em `data[].b64_json`.
  - Conferido na documentação oficial (developers.openai.com) em 24/10/2026.
- **A chave** (`electron/chaveDaIa.ts`, no processo principal):
  - fica cifrada pelo **cofre do sistema** (`safeStorage`: no Windows, o DPAPI da conta; no Mac, o Keychain), em
    `<userData>/servico-de-ia.json`;
  - nunca fica em texto aberto: sem o cofre funcionando, a chave **não é guardada**, e a janela diz por quê;
  - a tela só sabe se há chave (o estado), **nunca qual é**: o campo é de senha e se esvazia ao guardar;
  - a chamada sai do processo principal, por `net.fetch` (que segue o proxy do sistema), com tempo limite de 180 s;
  - o diagnóstico registra que houve um pedido e como acabou, nunca a chave nem o texto;
  - "Esquecer a chave" apaga o arquivo.
  - A chave que não abre (outra conta, outro computador) é dita, e é preciso pôr de novo.
- **Sem chave**, o cartão do serviço diz "IA não configurada", o Gerar fica desligado e **nada sai do computador**.
  Fora do programa instalado (no navegador), a janela diz que a IA só funciona nele.
- **O que criar** (`pedidoParaIa`; o pedido em português aparece inteiro e pode ser mudado antes de mandar):
  - a peça pelas inspirações;
  - o croqui frente e costas, em traço preto;
  - variações de um desenho, que exigem ao menos uma referência;
  - a foto comercial num modelo virtual.

  O pedido leva o nome do modelo, a descrição da ficha, o conceito, o tecido, a paleta (pelo nome das cores, em
  português) e as notas das imagens.
- **As referências:** o **desenho técnico** da ficha (o SVG passado para PNG) e as imagens do painel, marcadas uma a
  uma.
- **A quantidade e o formato:** de 1 a 4 imagens; retrato, quadrado ou paisagem.
- **O que volta é rascunho:** cada imagem leva o selo "Rascunho da IA", com o modelo e a hora.
  - "Pôr no painel" a guarda no painel marcada como rascunho, com o serviço, o modelo e o pedido.
  - "Salvar PNG" salva a imagem.
- **Os erros do serviço** são ditos em português, com o que o serviço disse: a chave recusada (401), sem acesso ao
  modelo (403), o modelo não achado (404), o limite ou os créditos (429), o pedido recusado (400), o serviço fora (5xx),
  sem internet ou bloqueio da rede, e a demora.

## O que não foi feito

- **O serviço de verdade não foi chamado:** não há chave (e não se usa chave que não seja a de quem usa o programa). O
  pedido foi conferido contra a documentação e por um serviço de mentira no teste de uso. A primeira geração de verdade
  será a da pessoa, com a chave dela.
- **Um serviço só:** outros (Google, Stability, um servidor da empresa) entram como outro "serviço", com o mesmo
  formato do pedido.
- O texto (as descrições da loja, a ficha) por IA não foi pedido no estudo, e não foi feito.

## Conferência

- `domain/inspiracao.test.ts` (9):
  - as cores de uma imagem (sem o transparente);
  - os nomes das cores;
  - pôr, mudar e tirar imagens (até 16); a paleta (até 8);
  - o pedido (o tipo, o conceito, as cores, as notas, as referências; o croqui sem cores);
  - a leitura;
  - a chave e o modelo com formato aceitável;
  - o pedido HTTP (a geração em JSON; a edição em partes, uma `image[]` por imagem, com o arquivo certo);
  - a resposta e cada erro em português.
- `electron/chaveDaIa.test.ts` (6):
  - sem chave, não configurado;
  - guardada, configurada, e **o arquivo não tem a chave** (nem em base64);
  - mudar o modelo; esquecer apaga;
  - sem o cofre não guarda; a chave e o modelo estranhos são recusados;
  - a chave que não abre;
  - sem configurar nada sai; configurado, manda com a chave só no cabeçalho;
  - o pedido estranho não sai; sem rede e a demora são ditas.
- `ui/PainelDeInspiracao.test.tsx` (6):
  - trazer, a categoria, a nota, a paleta, o filtro e a gravação;
  - o painel cheio;
  - fora do programa instalado;
  - sem chave, a chave recusada, a chave guardada escondida;
  - o croqui com uma referência: o rascunho vai ao painel e sai em PNG;
  - as variações exigem referência; o erro do serviço aparece.
- `ui/BarraDeFerramentas.test.tsx`: o grupo Criação da aba Modelo.
- `npx vitest run`: 162 arquivos, 2897 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro.
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows), com o `net.fetch` do processo principal trocado por um
  serviço de mentira que só responde ao endereço do serviço (nada sai do computador):
  - duas imagens desenhadas na hora entram pelo campo de arquivo, com as cores certas: azul-marinho e branco; vermelho
    e rosa-claro;
  - a categoria, a nota, o conceito e a paleta;
  - sem chave: "IA não configurada", e o Gerar desligado;
  - a chave de teste guardada: a IA configurada, e o arquivo não mostra a chave;
  - o croqui pedido ao serviço de mentira, com estas conferências:
    - foi a `…/images/edits`;
    - a chave foi só no cabeçalho;
    - a imagem de referência foi como `image[]`;
    - o modelo foi o padrão;
    - o resultado veio com o selo de rascunho;
  - o resultado no painel; esquecer a chave apaga o arquivo;
  - o painel no projeto: o conceito, a paleta, as imagens e o rascunho marcado, sem a chave em lugar nenhum;
  - em 1280 × 720 a aba Modelo, agora com o grupo Criação, ainda cabe (os rótulos em duas linhas);
  - 72 conferências, nenhuma falha.
  - Sem o cofre do sistema (uma máquina de testes sem chaveiro), o teste confere a recusa e diz que a geração não foi
    testada ali.
