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
| Coleções (estação, ano, datas), vários projetos dentro de uma estrutura | ⬜ (só a Biblioteca de projetos) | L |
| Mix de produtos num quadro (cores, formas, tecidos, categorias) | ⬜ | L |
| Fluxo por etapas (criação → modelagem → piloto → aprovação → produção), responsáveis e prazos por modelo | ⬜ (projeto só "em edição/arquivado") | L |
| Tarefas e pendências por pessoa; avisos de prazo | ⬜ | L (avisos dentro do programa; e-mail/celular: S) |
| Aprovação da peça-piloto (aprovar / pedir alteração), comentários e revisões com histórico | 🟡 (histórico de versões do projeto) | L |
| Painéis de andamento e atrasos; linha do tempo do lançamento | ⬜ | L |
| Ligação da coleção com o desenho, o molde e o encaixe | 🟡 (o projeto já liga molde, encaixe e corte) | L |
| 100% na nuvem, colaboração simultânea entre pessoas | ⬜ | S (exige servidor; o programa é local) |

## 2. Desenho técnico, ficha técnica e pré-custo

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Desenho técnico vetorial (croqui frente e costas) | ⬜ | L |
| Espelhamento automático (desenha um lado, o outro sai) | ⬜ | L |
| Biblioteca de formas (golas, punhos, bolsos) e de bases técnicas; manequins técnicos | ⬜ | L |
| Linhas de costura e acabamento no desenho (pespontos, instruções) | ⬜ | L |
| Estampas aplicadas no desenho (posição, escala, rotação) | ⬜ | L |
| Ficha técnica ligada ao desenho e aos materiais (muda junto) | ⬜ | L |
| Cadastro de materiais e aviamentos reutilizável entre coleções | 🟡 (cadastro de malhas e rolos, para o corte) | L |
| Tabela de medidas com tolerâncias por tamanho | 🟡 (a graduação tem as medidas dos moldes) | L |
| Sequência operacional (operações, máquina, tempo) | ⬜ | L |
| Consumo de tecido estimado pelo desenho | 🟡 (consumo pelo encaixe e pelo plano de corte, mais preciso) | L |
| Pré-custo (tecido + aviamentos + mão de obra + indiretos → custo e preço) e simulador de meta de custo | 🟡 (só o custo do tecido, ADR 0092) | L |
| Atualizar vários produtos do mix de uma vez | ⬜ | L |
| Exportar a ficha (PDF) | ⬜ | L |

## 3. Modelagem e graduação

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Modelagem do zero: pontos, retas, curvas, pences, pregas, costura, piques, fio, textos | ✅ (ADR 0013–0082) | — |
| Extrair peças de áreas fechadas do desenho | ✅ (Extrair molde) | — |
| Tabela de graduação, regras, tamanho-base, graduar curva, piques graduados | ✅ | — |
| Conferir perímetros, distâncias e curvas | ✅ (aba Conferência) | — |
| DXF de entrada e de saída | ✅ (ADR 0090, 0096) | — |
| Forro, entretela e vista gerados a partir da peça principal | 🟡 (Elemento paralelo, Bainha, Dobrar; não um comando "gerar forro") | L |
| Biblioteca de bases aprovadas para virar modelos novos | 🟡 (Duplicar projeto; Variantes) | L |
| Mudança no molde atualiza o encaixe ligado | 🟡 (as peças na mesa são as do projeto; o plano avisa que o molde mudou) | L |

## 4. Encaixe e servidor de encaixe

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Encaixe automático com muitas combinações e relatório | ✅ heurístico (R-3: sem garantia de ótimo) | — |
| Margens de segurança, restrição do fio, rotação por brilho/estampa, simetria | ✅ | — |
| Grupos de peças que ficam juntas no encaixe (ex.: as que vão à entretela) | ⬜ (há os pares) | L |
| Desviar de furos e manchas do tecido | ✅ (defeitos com posição, no plano) | — |
| Listras e xadrez casados | 🟡 (casamento por um ponto por peça) | L (mais pontos) |
| Combinação de tamanhos e o melhor tipo de enfesto sugeridos | ✅ (composição dos riscos no plano) | — |
| Parâmetros de enfesto fixados como padrão | ✅ (configuração do plano) | — |
| Consumo, eficiência e perda antes do corte; relatórios para o financeiro | ✅ (plano, relatório, custo) | — |
| Prioridade das ordens a calcular | ✅ (na fila de encaixes, ADR 0102) | — |
| Fila de encaixes em segundo plano: várias, com prioridade, pausar, reordenar, relatório de eficiência | ✅ (nesta estação, com o programa aberto, ADR 0102) | — |
| Servidor dedicado recebendo de várias estações, 24 h | ⬜ | S (exige servidor na rede) |
| Encaixe de estampa para impressão digital (molde preenchido com a imagem) | ⬜ | L (o arquivo); a impressora é H |

## 5. Digitalização de moldes de papel

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Foto do molde no desenho, com escala calibrada por dois pontos | ✅ (Imagens/Digitalizar) | — |
| Correção de perspectiva e da lente | ⬜ | P (perspectiva pelas 4 marcas de um quadro; a lente, aproximada) |
| Reconhecer sozinho o contorno e virar vetor editável | ⬜ | P (depende do contraste da foto) |
| Reconhecer piques, furos e a linha do fio | ⬜ | P |
| Vários moldes numa foto, cada um uma peça | ⬜ | P |
| Quadro de captura | ⬜ | H |

## 6. 3D

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Manequim 3D com medidas ajustáveis (público-alvo, tabela de medidas) | ⬜ | L |
| Costura virtual: escolher os pontos do molde 2D a unir e montar no manequim | ⬜ | P (montagem e caimento aproximados) |
| Simulação de caimento pelo peso, densidade e elasticidade; vincos e pontos de tensão | ⬜ | P (física simplificada — não substitui a peça-piloto) |
| Editor das propriedades do tecido | ⬜ | L |
| Cores, estampas (inclusive localizada), texturas, aviamentos no 3D | ⬜ | L |
| Mudança no molde 2D refletida no 3D | ⬜ | P |
| Imagens renderizadas para catálogo e aprovação | ⬜ | L (renderização simples) |

## 7. Sala de corte

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Ordem de corte a partir do encaixe e do planejamento | ✅ (plano confirmado) | — |
| Situação de cada ordem, consumo planejado × executado, sugestão de correção | ✅ (ADR 0098, painel da sala de corte no ADR 0100) | — |
| Indicadores: tempo de corte, metros, aproveitamento, por operador | ✅ (ADR 0100) | — |
| Gestão de retalhos (estoque de retalhos) | ✅ (ADR 0098, 0100) | — |
| Relatórios para compras e histórico para auditoria | ✅ (CSV, ADR 0100) | — |
| Ligação com máquina de corte, enfestadeira, mesa | ⬜ | H (sem protocolo nem equipamento) |
| Plotter de papel (risco 1:1) | ✅ (arquivo PLT/HPGL, ADR 0101; PDF 1:1 em folhas; DXF) | H (o plotter físico: não testado num) |

## 8. IA de criação

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Painel de inspiração (imagens de modelagem, tecido, cor, aviamento, estampa) | ⬜ | L (o painel) |
| Gerar a imagem de uma peça a partir das inspirações; variações | ⬜ | S (serviço de geração de imagem + conta e chave do usuário) |
| Croqui preliminar frente e costas gerado | ⬜ | S |
| Variações a partir de um desenho | ⬜ | S |
| Fotos comerciais da peça num modelo virtual | ⬜ | S |

## 9. Vendas

| Função | Enfesto CAD | Viab. |
|---|---|---|
| Recomendação de tamanho pelas medidas do corpo e a tabela de medidas, com a explicação | ⬜ | L (calculadora local); a loja virtual é S |
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
