# Estudo de funcionalidades — o ecossistema de referência e o Enfesto CAD

Pedido do usuário (2026-10-24): "um estudo completo para adicionar todas as funcionalidades, de forma completa,
do [ecossistema de referência] e implementá-las aqui". Este documento é o estudo: o que cada módulo da referência
faz (pelas páginas oficiais atuais e pelo manual de modelagem da versão 10), como está o Enfesto CAD em cada ponto,
o que dá para fazer **aqui de verdade** e em que ordem. O nome do produto de referência não é escrito no repositório
(regra do projeto); os módulos são chamados pela função.

## Como ler

Para cada função:

- **Situação no Enfesto CAD:** ✅ tem · 🟡 tem em parte · ⬜ não tem.
- **Viabilidade aqui:** **L** = dá para fazer completo neste programa (local, no computador) · **P** = dá para
  fazer, mas com um limite que fica dito (ex.: simulação aproximada) · **S** = depende de serviço, conta ou chave de
  terceiros (só com a autorização e os dados do usuário) · **H** = é equipamento (máquina, plotter, quadro): o
  programa só pode gerar os arquivos para ele.

Fontes: as páginas oficiais de cada solução (gestão de coleção, desenho técnico, modelagem, encaixe, servidor de
encaixe, digitalização, 3D, criação 3D, IA de criação, sala de corte, planos, equipamentos), o manual digital de
modelagem da versão 10 e as páginas públicas das soluções de venda. O material é de divulgação: ele diz **o que**
cada produto faz, não **como** (algoritmos, formatos, precisões); onde a referência não diz, este estudo não
inventa.

## 1. Gestão de coleção (PLM)

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Coleções (estação, ano, datas), vários projetos dentro de uma estrutura | ✅ (ADR 0108) | — |
| Mix de produtos num quadro (cores, formas, tecidos, categorias) | ✅ (cartões com o croqui, resumo e filtros, ADR 0108) | — |
| Fluxo por etapas (criação → modelagem → piloto → aprovação → produção), responsáveis e prazos por modelo | ✅ (com o quadro das etapas, ADR 0108; o cartão arrastado entre as colunas pelas regras do fluxo, ADR 0118) | — |
| Tarefas e pendências por pessoa; avisos de prazo | ✅ (avisos dentro do programa, na barra de status, ADR 0108) | S (e-mail/celular) |
| Aprovação da peça-piloto (aprovar / pedir alteração), comentários e revisões com histórico | ✅ (ADR 0108; e a aprovação da ficha, ADR 0105) | — |
| Painéis de andamento e atrasos; linha do tempo do lançamento | ✅ (ADR 0108) | — |
| Ligação da coleção com o desenho, o molde e o encaixe | ✅ (o modelo liga ao projeto: molde, encaixe, ficha e croqui, ADR 0108) | — |
| 100% na nuvem, colaboração simultânea entre pessoas | 🟡 (a biblioteca numa pasta da rede, com a trava de quem está editando, ADR 0142) | S (a edição ao mesmo tempo e a nuvem exigem servidor) |

## 2. Desenho técnico, ficha técnica e pré-custo

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Desenho técnico vetorial (croqui frente e costas) | ✅ (ADR 0107; exporta SVG e vai no PDF da ficha; zoom, grade e ímã, ADR 0116; cotas com a letra do ponto de medida da tabela, ADR 0117) | — |
| Espelhamento automático (desenha um lado, o outro sai) | ✅ (ADR 0107) | — |
| Biblioteca de formas (golas, punhos, bolsos) e de bases técnicas; manequins técnicos | ✅ (13 formas, 6 bases, 2 manequins, ADR 0107) | — |
| Linhas de costura e acabamento no desenho (pespontos, instruções) | ✅ (estilos costura e pesponto, e textos, ADR 0107) | — |
| Estampas aplicadas no desenho (posição, escala, rotação) | ✅ (as imagens do projeto, ADR 0107) | — |
| Ficha técnica ligada ao desenho e aos materiais (muda junto) | ✅ (o desenho mora na ficha e trava com ela; materiais, encaixe e custo, ADR 0105 e 0107) | — |
| Cadastro de materiais e aviamentos reutilizável entre coleções | ✅ (biblioteca de materiais, ADR 0104; importar de uma planilha colada ou de um CSV, ADR 0115) | — |
| Tabela de medidas com tolerâncias por tamanho | ✅ (ficha técnica, com a colagem da planilha, ADR 0105) | — |
| Sequência operacional (operações, máquina, tempo) | ✅ (ficha técnica, ADR 0105) | — |
| Consumo de tecido estimado pelo desenho | ✅ ADR 0127 (pelas áreas do croqui na escala das cotas) | L |
| Pré-custo (tecido + aviamentos + mão de obra + indiretos → custo e preço) e simulador de meta de custo | ✅ (ADR 0106; o custo de cada tamanho pela graduação, na tela e no PDF da ficha, ADR 0115) | — |
| Atualizar vários produtos do mix de uma vez | ✅ (o preço na biblioteca muda o custo de todos; aba Custos dos modelos, ADR 0106) | — |
| Exportar a ficha (PDF) | ✅ (ADR 0105) | — |

## 3. Modelagem e graduação

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Modelagem do zero: pontos, retas, curvas, pences, pregas, costura, piques, fio, textos | ✅ (ADR 0013–0082) | — |
| Extrair peças de áreas fechadas do desenho | ✅ (Extrair molde) | — |
| Tabela de graduação, regras, tamanho-base, graduar curva, piques graduados | ✅ | — |
| Conferir perímetros, distâncias e curvas | ✅ (aba Conferência) | — |
| DXF de entrada e de saída | ✅ (ADR 0090, 0096) | — |
| Forro, entretela e vista gerados a partir da peça principal | ✅ (Produção › Forro, entretela e vista: a vista pelo trecho, o forro sem ele, a entretela recuada, nos grupos do encaixe, ADR 0124) | — |
| Biblioteca de bases aprovadas para virar modelos novos | ✅ ADR 0126 (aprovar como base, modelo novo da base, as peças da base no aberto) | L |
| Mudança no molde atualiza o encaixe ligado | ✅ ADR 0125 (o encaixe da fila entra com as peças de agora; o plano de corte guardado fica com os valores de então, e avisa) | L |

## 4. Encaixe e servidor de encaixe

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Encaixe automático com muitas combinações e relatório | ✅ heurístico (R-3: sem garantia de ótimo) | — |
| Margens de segurança, restrição do fio, rotação por brilho/estampa, simetria | ✅ | — |
| Grupos de peças que ficam juntas no encaixe (ex.: as que vão à entretela) | ✅ (um trecho do comprimento por grupo, nos dois métodos e no planejamento, ADR 0103; a divisa e o nome dos trechos no PDF, no DXF e no PLT, ADR 0115) | — |
| Desviar de furos e manchas do tecido | ✅ (defeitos com posição, no plano) | — |
| Listras e xadrez casados | ✅ ADR 0089, 0129, 0130 (por mais de um ponto; a ferramenta Ponto de casamento) | L |
| Combinação de tamanhos e o melhor tipo de enfesto sugeridos | ✅ (composição dos riscos no plano) | — |
| Parâmetros de enfesto fixados como padrão | ✅ (configuração do plano) | — |
| Consumo, eficiência e perda antes do corte; relatórios para o financeiro | ✅ (plano, relatório, custo) | — |
| Prioridade das ordens a calcular | ✅ (na fila de encaixes, ADR 0102) | — |
| Fila de encaixes em segundo plano: várias, com prioridade, pausar, reordenar, relatório de eficiência | ✅ (nesta estação, com o programa aberto, ADR 0102) | — |
| Servidor dedicado recebendo de várias estações, 24 h | ✅ (a fila na rede, ADR 0143; o modo servidor de encaixes: uma máquina só para calcular, que abre ao entrar no Windows, ADR 0147) | S (um serviço que calcula sem ninguém entrar no Windows) |
| Encaixe de estampa para impressão digital (molde preenchido com a imagem) | ✅ (Encaixe › Impressão › Estampa no encaixe: corrida ou localizada, de pé no fio de cada peça, com sangria; o PDF 1:1, ADR 0113) | H (a impressora: não testado numa) |

## 5. Digitalização de moldes de papel

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Foto do molde no desenho, com escala calibrada por dois pontos | ✅ (Imagens/Digitalizar) | — |
| Correção de perspectiva e da lente | ✅ (a perspectiva pelos 4 cantos da referência, ADR 0109; a lente por um ponto em cada lado da referência, ADR 0122) | — |
| Reconhecer sozinho o contorno e virar vetor editável | ✅ (o clique dentro do molde, com o limiar ajustável, ADR 0109) | — |
| Reconhecer piques, furos e a linha do fio | ✅ (os piques em V, os furos redondos, o traço do fio; o fio também à mão, ADR 0109; os outros traços de caneta — a pence, a marca do bolso — viram linhas internas, ADR 0121) | — |
| Vários moldes numa foto, cada um uma peça | ✅ (um clique por molde, ADR 0109) | — |
| Quadro de captura | ✅ (a mesa digitalizadora pela porta serial, ou o registro dela colado: canto, curva, pique, fio, fechar, desfazer, ADR 0144) | H (não testado numa mesa física) |

## 6. 3D

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Manequim 3D com medidas ajustáveis (público-alvo, tabela de medidas) | ✅ (Conferência › Provador 3D: público, 10 medidas, o tamanho da ficha, ADR 0111) | — |
| Costura virtual: escolher os pontos do molde 2D a unir e montar no manequim | ✅ (as laterais e os ombros sugeridos; as outras clicando nos pontos; montagem aproximada, ADR 0111; o bolso e a aplicação costurados sobre outra peça, ADR 0123) | — |
| Simulação de caimento pelo peso, densidade e elasticidade; vincos e pontos de tensão | 🟡 (física simplificada: peso, elasticidade no fio, na trama e no viés (ADR 0120), rigidez, atrito; o mapa de tensão; o tecido sobre o próprio tecido, ponto a ponto (ADR 0146); vincos só na escala da malha, ADR 0111) | P (a colisão exata de triângulos e os vincos finos — não substitui a peça-piloto) |
| Editor das propriedades do tecido | ✅ (seis prontos e o personalizado, ADR 0111) | — |
| Cores, estampas (inclusive localizada), texturas, aviamentos no 3D | ✅ (a cor por peça; a estampa corrida ou localizada pelas imagens do modelo; os furos como botões; a textura é uma imagem corrida, ADR 0111) | — |
| Mudança no molde 2D refletida no 3D | ✅ (o provador monta pelas peças de agora; a costura avisa quando o molde mudou, ADR 0111) | — |
| Imagens renderizadas para catálogo e aprovação | ✅ (PNG de uma vista, ou frente, lado e costas, ADR 0111) | — |

## 7. Sala de corte

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Ordem de corte a partir do encaixe e do planejamento | ✅ (plano confirmado) | — |
| Situação de cada ordem, consumo planejado × executado, sugestão de correção | ✅ (ADR 0098, painel da sala de corte no ADR 0100) | — |
| Indicadores: tempo de corte, metros, aproveitamento, por operador | ✅ (ADR 0100) | — |
| Gestão de retalhos (estoque de retalhos) | ✅ (ADR 0098, 0100) | — |
| Relatórios para compras e histórico para auditoria | ✅ (CSV, ADR 0100) | — |
| Ligação com máquina de corte, enfestadeira, mesa | 🟡 (o arquivo ISO/G-code para a mesa de corte, com faca, piqueteador, furador e caneta, ADR 0140) | H (a mesa física: não testado numa; sem ligação direta) |
| Plotter de papel (risco 1:1) | ✅ (arquivo PLT/HPGL, de uma caneta ou de duas — corte e risco —, ADR 0101 e 0115; PDF 1:1 em folhas; DXF) | H (o plotter físico: não testado num) |

## 8. IA de criação

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Painel de inspiração (imagens de modelagem, tecido, cor, aviamento, estampa) | ✅ (Modelo › Criação › Inspiração: as imagens por categoria, as notas, as cores tiradas de cada uma, o conceito e a paleta, ADR 0112) | — |
| Gerar a imagem de uma peça a partir das inspirações; variações | 🟡 (pronto para o serviço de imagens da OpenAI com a conta e a chave do usuário (cifrada pelo cofre do sistema), o resultado marcado como rascunho; sem chave, "não configurada"; testado por um serviço de mentira — falta a chave para o de verdade, ADR 0112) | S (a chave do usuário) |
| Croqui preliminar frente e costas gerado | 🟡 (o mesmo serviço; o pedido do croqui em traço preto, ADR 0112) | S (a chave do usuário) |
| Variações a partir de um desenho | 🟡 (o mesmo serviço; o desenho técnico da ficha vai como referência, ADR 0112) | S (a chave do usuário) |
| Fotos comerciais da peça num modelo virtual | 🟡 (o mesmo serviço; o pedido da foto de catálogo, ADR 0112) | S (a chave do usuário) |

## 9. Vendas

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Recomendação de tamanho pelas medidas do corpo e a tabela de medidas, com a explicação | ✅ (Modelo › Loja: a folga de cada ponto, o "entre dois tamanhos", o guia de medidas em CSV e HTML, ADR 0110; o tecido que cede — malha, malha com elastano, ADR 0119) | a loja virtual é S |
| Provador virtual, busca visual, combinações de looks | 🟡 (os looks da coleção, com a prancha; a busca por imagem na biblioteca, pela forma e pelas cores, ADR 0145; o provador 3D e a recomendação de tamanho, ADR 0110–0111) | S (a loja virtual para o cliente) |

## 10. Integrações

| Função | Enfesto CAD | Viab. |
|---|---|---|
| ERP (ordens, produtos, estoque) | ✅ pela pasta de troca: as ordens entram, as ordens com a situação do corte, os rolos, os movimentos de estoque, os cortes e o consumo saem (ADR 0141) | S (a ligação direta pela rede: precisa do ERP, da credencial e do mapeamento) |
| Arquivos de troca (DXF, PDF, Excel, CSV) | ✅ | — |

## Plano por fases

A ordem vai do núcleo deste programa (encaixe e corte) para os módulos novos, e das dependências para o que depende
delas (a ficha técnica antes da coleção e da recomendação de tamanho; o manequim antes do 3D). Cada fase entra
testada, verificada no programa gerado e registrada num ADR; nada fica com cara de pronto sem estar.

1. **Encaixe e sala de corte:** fila de encaixes em segundo plano (prioridade, pausar, reordenar, relatório);
   grupos de peças no encaixe; painel geral da sala de corte (todas as ordens, indicadores, desvio planejado ×
   executado com a sugestão de correção, retalhos, relatório para compras, histórico); exportação para plotter (PLT).
2. **Ficha técnica e pré-custo:** biblioteca de materiais e aviamentos; ficha técnica do modelo (descrição,
   medidas com tolerâncias, materiais e aviamentos com o consumo, sequência operacional, instruções, versão e
   aprovação, PDF); pré-custo completo (tecido pelo encaixe, aviamentos, mão de obra pelo tempo das operações,
   indiretos, margem, preço) com o simulador de meta.
3. **Desenho técnico:** editor vetorial de croqui (frente e costas, espelhamento, formas e bases, pespontos,
   estampas), ligado à ficha.
4. **Gestão de coleção:** coleções, mix, etapas, responsáveis, prazos, tarefas, aprovações com histórico, painéis
   e linha do tempo (local, para uma pessoa ou um computador).
5. **Digitalização pela foto:** correção de perspectiva pelas marcas, contorno, piques, furos e fio reconhecidos,
   revisão e conferência das medidas.
6. **Recomendação de tamanho:** pela tabela de medidas da ficha técnica.
7. **3D:** manequim com medidas, montagem pelas costuras, caimento aproximado, tecido, cores e estampas, imagem.
8. **IA:** quando o usuário escolher o serviço e der a conta e a chave (guardada fora do código), com o resultado
   marcado como rascunho.

O que é **equipamento** (máquina de corte, enfestadeiras, mesa, plotter, quadro de captura) não vira função de
programa: o Enfesto CAD gera os arquivos (PDF 1:1, DXF, PLT) e diz "não conectado". O que precisa de **servidor,
nuvem ou conta de terceiros** (colaboração simultânea, servidor de encaixe entre estações, IA, loja virtual, ERP)
fica para quando houver o serviço — e a parte local de cada um entra nas fases acima.

## Segunda rodada do estudo (2026-10-25)

O usuário pediu para estudar a referência a fundo e implementar o que ela tem. Os vídeos não podem ser assistidos
aqui; foram lidos:
- as páginas oficiais de cada módulo (modelagem, encaixe, desenho e ficha, gestão de coleção, 3D);
- o manual digital da versão 10, já usado ferramenta por ferramenta nas etapas anteriores;
- os títulos dos tutoriais em vídeo.

O "o que há de novo" da área de treinamento não abre fora do navegador (a página é montada por JavaScript).

O que essas fontes listam e o Enfesto CAD ainda não tinha, na ordem em que entra:

| Da referência | Situação |
|---|---|
| Forro, entretela e vista gerados da peça principal | ✅ ADR 0124 |
| A mudança no molde atualiza o encaixe ligado | ✅ ADR 0125 |
| Biblioteca de bases aprovadas para virar modelos novos | ✅ ADR 0126 |
| Consumo de tecido estimado pelas áreas do desenho técnico (antes do molde) | ✅ ADR 0127 |
| Extrair de uma vez todas as regiões fechadas do desenho ("vários modelos com um clique") | ✅ ADR 0128 |
| Listras e xadrez casados por mais de um ponto | ✅ ADR 0129 |
| Desenhar a roupa no manequim 3D e tirar os pré-moldes 2D | ✅ ADR 0134 |
| Zíper como aviamento no 3D; brilho e transparência; biblioteca de componentes (golas, mangas) | ✅ brilho e transparência: ADR 0131; zíper: ADR 0132; componentes: ADR 0133 |

Ficam de fora, como na primeira rodada:
- a colaboração na nuvem e os avisos por e-mail ou celular, que precisam de servidor;
- a ligação com as máquinas de corte, que precisa do equipamento.

## Terceira rodada do estudo (2026-10-26)

Fontes lidas: as páginas oficiais de todos os produtos da referência listados no site (o encaixe, o servidor de
encaixes, a modelagem, o 3D, o estúdio de criação, o desenho e a ficha, a criação por IA), comparadas com o que o
Enfesto CAD já faz e com as duas rodadas anteriores. Fica de fora o que depende de servidor, de máquina ou de serviço de
terceiros (já dito acima).

| Da referência | Situação |
|---|---|
| Ângulos no encaixe: a inclinação que o fio tolera, para a peça caber melhor | ✅ ADR 0135 |
| Variações de cor do modelo (a cartela), no desenho e no 3D | ✅ no desenho e na ficha: ADR 0136 (no 3D, não) |
| Poses do manequim para as imagens de catálogo | ✅ ADR 0138 |
| Imagem em alta resolução, com luz e sombra; o movimento (o giro em vídeo) | ✅ ADR 0139 |
| Mudar de uma vez todo o mix da coleção (trocar um material em todos os modelos) | ✅ ADR 0137 |

## Quarta rodada: o que dependia de máquina ou de servidor (2026-10-26)

O usuário pediu para implementar tudo, inclusive o que antes ficou de fora. Para cada item que precisa de equipamento,
servidor ou serviço de terceiros, entra o que o programa consegue fazer sozinho, e a tela diz o que falta.

| Da referência | Situação |
|---|---|
| Mandar o encaixe para a mesa de corte automático | 🟡 o arquivo ISO (G-code): ADR 0140 (não testado numa mesa) |
| Trocar ordens, estoque e consumo com o ERP | ✅ pela pasta de troca, sem servidor: ADR 0141 |
| Os modelos da equipe num lugar só, sem duas pessoas mudando o mesmo | ✅ pela biblioteca numa pasta da rede, com a trava de edição: ADR 0142 |
| Servidor de encaixes recebendo os pedidos de várias estações | ✅ pela fila na rede (uma pasta; a estação que atende calcula): ADR 0143 |
| Copiar o molde de papel pelo quadro de captura (a mesa digitalizadora) | ✅ pela porta serial ou pelo registro colado: ADR 0144 (não testado numa mesa física) |
| Combinar os modelos em looks; achar o modelo parecido com uma foto | ✅ os looks da coleção e a busca por imagem: ADR 0145 (a loja virtual continua de fora) |
| O tecido colidindo consigo mesmo no caimento 3D | ✅ ponto a ponto, fora das costuras: ADR 0146 |
| Uma máquina só para calcular os encaixes das outras | ✅ o modo servidor de encaixes (--servidor-de-encaixes): ADR 0147 |

## Quinta rodada: o que os ADRs deixaram em "não feito" (2026-10-31)

| Item | Situação |
|---|---|
| Faca tangencial (eixo C) no arquivo ISO | ✅ ADR 0148 (não testado numa mesa) |
| Furos, marcas e linhas internas tocados na mesa digitalizadora | ✅ ADR 0149 (não testado numa mesa) |
| O pedido da fila da rede esquecido por uma estação que fechou | ✅ ADR 0150 |
| A troca com o ERP de tempos em tempos | ✅ ADR 0151 (com a janela aberta) |
| As variantes de cor no provador 3D, com a cartela | ✅ ADR 0152 |
| Botões do cursor configuráveis; compensação da lâmina no ISO | ✅ ADR 0153 (não testado em equipamento) |
| A troca com o ERP para todos os moldes da biblioteca | ✅ ADR 0154 |
| O look vestido no manequim 3D | ✅ ADR 0155 (um tecido só; sem peça por dentro e por fora) |

## Sexta rodada: a apostila de treinamento da referência (2026-10-31)

Fonte: a apostila unificada de treinamento, comparada com o programa. As ferramentas de modelagem dela já estavam cobertas; as do encaixe manual e da plotagem, em parte não.

| Item | Situação |
|---|---|
| Importar e exportar o modelo em arquivo | ✅ ADR 0156 |
| Importar PLT | ✅ ADR 0157 |
| X inicial e faixas de plotagem | ✅ ADR 0158 (não testado num plotter) |
| Etiquetas dos feixes | ✅ ADR 0159 |
| Linhas de referência: enfesto em escada e áreas bloqueadas | ✅ ADR 0160 (no encaixe automático; a busca do planejamento ainda não) |
| Alinhar moldes no encaixe | ✅ ADR 0161 |
| A identificação do risco no papel | ✅ ADR 0162 |
| Calculadora | ✅ a conta nos campos de medida: ADR 0163 |
| Travar horizontal / vertical | ✅ com Shift no arrasto: ADR 0164 |
| Texto no risco | ✅ ADR 0165 (na mesa e no PLT) |
| Cortar o molde e sobreposição permitida | ✅ já cobertos: Cortar (Construção) e a tolerância da validação (ADR 0082) |
| Paleta do usuário | ✅ ADR 0171 |

## Sétima rodada: o manual inteiro, menu por menu (2026-10-31)

Fontes: o manual digital da referência, lido por inteiro; a página pública sobre as camadas do padrão ASTM. Os vídeos não podem ser assistidos: só títulos, descrições e transcrições públicas, e as páginas de aulas e o blog não trouxeram função nova.

| Item | Situação |
|---|---|
| Exportar ASTM D6673 | ✅ ADR 0166 e 0207 (com o .RUL; não testado em outro sistema) |
| Plotar os moldes: tamanhos separados, desdobrar, girar, selecionados, reorganizar; organizar todos os moldes | ✅ ADR 0167 |
| Tamanho intermediário | ✅ ADR 0168 |
| Senha do modelo | ✅ ADR 0169 (no arquivo exportado) |
| Molde a molde; lembrar molde original | ✅ ADR 0170 |
| Paleta do usuário | ✅ ADR 0171 |
| Importar de outros sistemas (arquivos proprietários do manual) | ⬜ formatos fechados, sem especificação pública |
| Molde dobrado na dobra do tecido | ✅ ADR 0172 |
| Pontos CAM (completo e semi-corte); furador M43 e M44 | ✅ ADR 0173 (não testado numa mesa) |
| Ferramentas do plotter por elemento | ✅ ADR 0174 |
| Teclas de atalho | ✅ ADR 0175 (nas ferramentas dos Favoritos) |
| Perfil: salvar, carregar, restaurar | ✅ ADR 0176 |
| Esquemas de cores | ✅ ADR 0177 (quatro prontos; não configuráveis) |
| Unidade de medida | 🟡 polegadas na régua e nas coordenadas: ADR 0178 |
| Sob medida | ✅ ADR 0179 |

## Oitava rodada: a auditoria item por item

Cada nome do manual e da apostila foi conferido contra o código. Vários itens da lista inicial já existiam com outro nome ("Graduar molde automático" é o "Automático" da aba Graduação; "Marcar pique" é o campo "marcar" do Conferir) e saíram dela.

| Item | Situação |
| --- | --- |
| Teclas do encaixe (F2 a F8, F12, Ctrl+F, Ctrl+setas, Alt+clique) | ✅ ADR 0180 |
| Giro livre, giro inicial, refletido horizontal e vertical | ✅ ADR 0180 |
| Dobra vertical; ½ camada; sobreposição de moldes | ✅ ADR 0180 |
| Modificar: Discreto, Proporcional, linha auxiliar | ✅ ADR 0181 (o como é leitura minha) |
| Zoom de um elemento; ponto não graduado | ✅ ADR 0181 |
| Medida do pique padrão; estilo da linha de costura; cor por tamanho | ✅ ADR 0182 |
| Converter primitivas em linhas auxiliares | ✅ já existia em duas etapas: "Extrair molde" e depois "Inserir ou remover" das linhas auxiliares |
| Tabela completa de teclas (F9, F10, F11, Ctrl+R, G, U, W, T, K, P, L, Ctrl+Shift+T) | ✅ ADR 0183 (Ctrl+A, O, D, E seguem como eram no programa) |
| Mover com referência | ✅ ADR 0183 |
| Texto como linha; plotar direto; retângulo de organização | ✅ ADR 0184 (direto = pasta vigiada, não a porta da máquina) |
| Imprimir: proporção, fatores de escala, em cores, prévia | ✅ ADR 0185 |
| Grade de corte; aplicar para modelo | ✅ ADR 0186 (um tecido por projeto) |
| Alterar risco | ✅ já existia: é a janela do Enfesto |
| Mostra padronagem, padrão; cor do tecido | ✅ ADR 0187 |
| Pontos de emenda | ✅ ADR 0188 (a explicação vem da prática, a referência não diz) |
| Unidades de área e de peso | ✅ ADR 0189 (na tela; as exportações seguem em kg e m²) |
| Giro faixa; par; espelhar; peça pronta; dobra; margens; listras | ✅ já existiam |
| Criar molde por intersecção: detectar graduações, piques, linhas; compor contornos; quebrar linhas | ✅ ADR 0190 |
| Definir sentido do fio: posicionar, usar ângulo, por seleção | ✅ ADR 0190 |
| Inverter costura; manter diferença | ✅ ADR 0190 |
| Relacionamento piques | ✅ ADR 0191 e 0204 (o como é leitura minha) |
| Auto ajuste de texto; estilos de linha no plotter; calculadora; cor, estilo e peso da linha | ✅ ADR 0192 |
| Mostrar conforme definição das ferramentas; ponto de pique | ✅ ADR 0193 (só o contorno; ponto de cor fixa) |
| Níveis de impressão | ✅ ADR 0210, sem comando próprio do Mutoh, e sem plotter de verdade |
| Itens institucionais (licença, clube, dados do autor, teclado virtual, sobre, janela em cascata) | não se aplicam |
| Importar e exportar Lectra, Gerber, Investrônica, MDL, VET, IBA, ALF, metafile | não feito: formatos fechados |

## Nona rodada: o manual do programa de encaixe (2026-10-31)

As fontes anteriores eram o manual de moldes e a apostila. O manual do encaixe, versão 10, e as páginas oficiais de cada módulo trouxeram o que faltava.

| Item | Situação |
| --- | --- |
| Tecido por molde; gerar encaixe para um tecido ou todos; grade por tecido | ✅ ADR 0194 |
| Manter peças encaixadas; usar somente peças encaixadas; espelhamento; dobra superior ou inferior; tolerância até 10° | ✅ ADR 0195 |
| Compactar | ✅ ADR 0195 |
| Linhas de referência; verificar dobrados; ½ camada sobreposta | ✅ ADR 0196 |
| Pontos de emenda automáticos, métodos 1 e 2 | ✅ ADR 0197 |
| Status do encaixe; perdas; rendimento | ✅ ADR 0198 |
| Moldes no encaixe; destacar pacotes; destacar relacionamento; barra de status; precisão; ângulo de giro; código dos pacotes | ✅ ADR 0199 |
| Molde, tamanho e todos na mesa ou fora; encaixa ao clicar; usar; verifica ao plotar; padrões do novo encaixe | ✅ ADR 0200 |
| Informações do arquivo; unir; SVG no lugar do metafile; XML; importar ISO; colar vários; colar incrementar grade; plotar com fatores, espelho e limites; imprimir ajustado | ✅ ADR 0201 |
| Fundir pique; margem por peça; usar distância; sentido por tamanho e por pacote; quantidade por tamanho; tamanho do texto; propriedades de encaixe; SNAP | ✅ ADR 0202 |
| Captura em lote; rastreabilidade; previsão de compra; catálogo; modelo virtual; recorte para a loja; miniatura; esquemas de cores próprios | ✅ ADR 0203 |
| Cores dos pacotes; manual e novidades; sugestão do método de enfesto | ✅ ADR 0204 |
| Réguas e barra de status; ordem crescente dos tamanhos | ✅ ADR 0205 |
| Substituir tamanho no encaixe | ✅ ADR 0206 |
| .aoc | ⬜ formato fechado, sem especificação pública |
| TrueType; janelas em cascata e lado a lado; teclado virtual | ✅ ADR 0211 |

## Décima rodada: o que tinha ficado de fora (2026-10-31)

| Item | Situação |
| --- | --- |
| Importar de outros sistemas | ✅ ADR 0207, pelo ASTM/AAMA que todos exportam; o arquivo fechado em si continua impossível |
| Arquivo de regras .RUL, importar e exportar | ✅ ADR 0207 |
| Envolvente contorno e retangular, de peça ou de grupo; margem por ponto; grupo rígido; blocos por tamanho, separação completa, horizontal e vertical; manter orientação dos pacotes | ✅ ADR 0208 |
| Tecido ativo: um encaixe e uma largura por tecido, nas telas e nas saídas | ✅ ADR 0209 |
| Porta de saída na rede, compartilhada, LPT e COM; gerenciador de impressão; DMPL | ✅ ADR 0210, sem plotter de verdade; o DMPL sem a especificação |
| Ordem de corte: criar arquivos de encaixe, um por risco | ✅ ADR 0212 |
| Loja virtual | 🟡 ADR 0213: vitrine em uma página, com looks, filtro e tamanho; sem carrinho nem pagamento |
| Nuvem: projeto compartilhado, várias pessoas, comentários, aprovação | 🟡 ADR 0214: servidor da própria empresa, sem a nuvem da referência |
| Validação com 34 arquivos ASTM/AAMA públicos e 2 DMPL de verdade; abertura correta das portas LPT e COM | ✅ ADR 0215 |
