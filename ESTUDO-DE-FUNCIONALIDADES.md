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
| 100% na nuvem, colaboração simultânea entre pessoas | ⬜ | S (exige servidor; o programa é local) |

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
| Consumo de tecido estimado pelo desenho | 🟡 (pelo encaixe da mesa na ficha, ADR 0105, e pelo plano de corte — mais preciso que pelo croqui) | L |
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
| Listras e xadrez casados | 🟡 (casamento por um ponto por peça) | L (mais pontos) |
| Combinação de tamanhos e o melhor tipo de enfesto sugeridos | ✅ (composição dos riscos no plano) | — |
| Parâmetros de enfesto fixados como padrão | ✅ (configuração do plano) | — |
| Consumo, eficiência e perda antes do corte; relatórios para o financeiro | ✅ (plano, relatório, custo) | — |
| Prioridade das ordens a calcular | ✅ (na fila de encaixes, ADR 0102) | — |
| Fila de encaixes em segundo plano: várias, com prioridade, pausar, reordenar, relatório de eficiência | ✅ (nesta estação, com o programa aberto, ADR 0102) | — |
| Servidor dedicado recebendo de várias estações, 24 h | ⬜ | S (exige servidor na rede) |
| Encaixe de estampa para impressão digital (molde preenchido com a imagem) | ✅ (Encaixe › Impressão › Estampa no encaixe: corrida ou localizada, de pé no fio de cada peça, com sangria; o PDF 1:1, ADR 0113) | H (a impressora: não testado numa) |

## 5. Digitalização de moldes de papel

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Foto do molde no desenho, com escala calibrada por dois pontos | ✅ (Imagens/Digitalizar) | — |
| Correção de perspectiva e da lente | ✅ (a perspectiva pelos 4 cantos da referência, ADR 0109; a lente por um ponto em cada lado da referência, ADR 0122) | — |
| Reconhecer sozinho o contorno e virar vetor editável | ✅ (o clique dentro do molde, com o limiar ajustável, ADR 0109) | — |
| Reconhecer piques, furos e a linha do fio | ✅ (os piques em V, os furos redondos, o traço do fio; o fio também à mão, ADR 0109; os outros traços de caneta — a pence, a marca do bolso — viram linhas internas, ADR 0121) | — |
| Vários moldes numa foto, cada um uma peça | ✅ (um clique por molde, ADR 0109) | — |
| Quadro de captura | ⬜ | H |

## 6. 3D

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Manequim 3D com medidas ajustáveis (público-alvo, tabela de medidas) | ✅ (Conferência › Provador 3D: público, 10 medidas, o tamanho da ficha, ADR 0111) | — |
| Costura virtual: escolher os pontos do molde 2D a unir e montar no manequim | ✅ (as laterais e os ombros sugeridos; as outras clicando nos pontos; montagem aproximada, ADR 0111; o bolso e a aplicação costurados sobre outra peça, ADR 0123) | — |
| Simulação de caimento pelo peso, densidade e elasticidade; vincos e pontos de tensão | 🟡 (física simplificada: peso, elasticidade no fio, na trama e no viés (ADR 0120), rigidez, atrito; o mapa de tensão; sem o tecido colidir consigo mesmo, vincos só na escala da malha, ADR 0111) | P (o resto da física — não substitui a peça-piloto) |
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
| Ligação com máquina de corte, enfestadeira, mesa | ⬜ | H (sem protocolo nem equipamento) |
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
| Provador virtual, busca visual, combinações de looks | ⬜ | S (loja virtual e serviços) |

## 10. Integrações

| Função | Enfesto CAD | Viab. |
|---|---|---|
| ERP (ordens, produtos, estoque) | 🟡 (ordens por CSV; o ERP não ligado é dito na tela) | S (precisa do ERP, da credencial e do mapeamento) |
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
| Desenhar a roupa no manequim 3D e tirar os pré-moldes 2D | ⬜ |
| Zíper como aviamento no 3D; brilho e transparência; biblioteca de componentes (golas, mangas) | ⬜ |

Ficam de fora, como na primeira rodada:
- a colaboração na nuvem e os avisos por e-mail ou celular, que precisam de servidor;
- a ligação com as máquinas de corte, que precisa do equipamento.
