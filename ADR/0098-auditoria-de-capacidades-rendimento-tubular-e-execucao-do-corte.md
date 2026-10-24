# ADR 0098 — Auditoria das capacidades, o rendimento da malha tubular e a execução do corte

## Contexto

Pedido do usuário: um roteiro longo para auditar o programa tomando como referência um ecossistema comercial de
programas de moda (gestão de coleção, desenho técnico e ficha técnica, modelagem e graduação, digitalização de
moldes, 3D, encaixe e consumo, sala de corte, equipamentos, e-commerce, IA e ERP). O roteiro pede: mapear o que
existe com evidência, corrigir o que estiver comprovadamente errado, implementar o que for relevante e estiver
ausente, sem quebrar o que funciona, e dizer o que ficou completo, parcial ou bloqueado. Ele mesmo diz que não é
para copiar o catálogo inteiro num programa que não tem esse objetivo, nem fazer telas que só aparentam funcionar.

O Enfesto CAD é um CAD de enfesto, encaixe e preparação de corte (ADR 0001): a auditoria foi feita para esse
objetivo. Áreas de outro tipo de programa (coleções, ficha técnica, 3D, e-commerce) ficaram registradas como fora
dele, com o motivo — no ADR 0011 o usuário já tinha recusado a ficha técnica aqui.

## Linha de base (antes de mudar)

- Repositório limpo, igual ao do GitHub (`bb0793a`).
- `npx vitest run`: 132 arquivos, 2626 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa. Nenhuma falha anterior.

## Inventário

| Área | Situação | Evidência |
|---|---|---|
| Produtos e coleções | Parcial — fora do objetivo | Projetos na Biblioteca (em edição/arquivado, duplicar, renomear, histórico com versões que se restauram), variantes, informações dos moldes, autor, tecidos; ordens de produção com produto, cor, prazo e quantidades (`domain/projeto.ts`, `domain/cadastroDeProducao.ts`, `ui/PainelDeBiblioteca.tsx`, `ui/PainelDeVariantes.tsx`, com testes). Não há coleção, fluxo de aprovação nem PLM. |
| Desenho de moda e ficha técnica | Ausente — fora do objetivo | Nenhum editor de croqui ou ficha técnica. O pré-custo existente é só o do tecido (ADR 0092), com entradas, fórmulas e premissas na tela; mão de obra, margem e preço não existem e não foram inventados. |
| Modelagem e graduação | Funcional | Abas Construção, Produção, Marcações, Graduação, Manipulação e Conferência (ADR 0013–0082): pontos, retas, curvas, arcos, pences, pregas, costura, piques, fio, simetria, cortar e unir; validação de contornos (`domain/validacao.ts`); graduação por tamanho-base, tabela e regras (`domain/graduacao.ts`, `domain/tamanhosGraduados.ts`). Peças reais passadas pela tela (ADR 0053, 0057, 0090). |
| Digitalização e intercâmbio | Funcional; digitalização de papel parcial | DXF de entrada (entidades, unidades pelo `$INSUNITS`, blocos; dois arquivos reais, ADR 0090) e de saída (R12, lido de volta, ADR 0096); PDF 1:1 com o registro da peça (ADR 0076, 0078); PDF de outro programa pelos contornos fechados (no tamanho do papel). Molde de papel: a foto entra no desenho e é calibrada por dois pontos (`calibrarImagem`), e o contorno é traçado à mão. **Ausente:** reconhecer sozinho o contorno, os piques e o fio numa foto, e corrigir a perspectiva. **Bloqueado:** dispositivo de captura (não há). |
| Visualização e simulação 3D | Ausente — fora do objetivo | Nenhum motor 3D aqui. |
| Encaixe, consumo e corte | Funcional; sala de corte era parcial | Encaixe automático heurístico (busca em grade ou pontos de canto), em segundo plano, cancelável, com limite de tempo e meta de aproveitamento, sem prometer o ótimo (R-3); fio e sentido único respeitados; planejamento de corte (riscos, composição, enfestos, rolos, defeitos, emendas, encolhimento, casamento por um ponto), relatório em PDF e Excel, custo do tecido. **Defeito comprovado:** o rendimento da malha tubular (abaixo). **Parcial:** havia reserva e baixa de estoque com o consumo *planejado*; não havia a execução do corte (situação, consumo real, tempos, retalhos) — implementada (abaixo). |
| Fila de encaixes entre estações | Parcial — fila multiestação bloqueada | O cálculo roda em segundo plano na própria janela (worker), um por vez, com cancelar. Uma fila que sobreviva a fechar o programa e atenda várias estações exige servidor: o programa é local. |
| Equipamentos e plotagem | Parcial | Saídas testadas: PDF 1:1 em folhas (com a régua de 100 mm para conferir a escala) e DXF R12. Nenhuma ligação com enfestadeira, faca ou plotter, e nenhuma exportação PLT/HPGL: sem equipamento nem documentação do fabricante para validar, não foi feita (o roteiro pede limitar-se às exportações testadas). |
| IA | Ausente — bloqueada | Exigiria conta, chave e serviço externo autorizados pelo usuário; nenhum botão de IA foi criado. |
| E-commerce (tamanho, provador, busca visual, imagens) | Não se aplica | O programa não vende nada. |
| Integrações e colaboração | Parcial | Ordens por CSV (testado), relatório em PDF e Excel, atalhos para programas externos (Programas). ERP: nenhum — a tela diz o que falta para ligar um (`ERP_NAO_CONFIGURADO`). Login, permissões e servidor: não há (programa local de um usuário); por isso as permissões "no servidor" do roteiro não se aplicam. Gravação sem arquivo pela metade, versão anterior guardada e cópia de segurança na troca de formato; duas janelas no mesmo projeto não são impedidas (R-7). |
| Interface | Funcional | ADR 0093 e 0097: azul para navegação e informação, verde para sucesso, âmbar para atenção, vermelho para erro, sempre com ícone e texto junto da cor; vírgula decimal (ADR 0094); foco visível; estados de vazio, salvo e falha. |

## Decisões

### Corrigido: o rendimento da malha tubular pela gramatura

A largura útil da malha tubular é a do tubo achatado, e um metro de tubo tem duas folhas dela. O rendimento
calculado pela gramatura (`rendimentoPelaGramatura`) usava uma folha só: um quilo de malha tubular rendia o dobro
dos metros — no plano de corte, no plano de enfesto e no comprimento do rolo pelo peso (`rendimentoDaMalha`). Com
200 kg de tubo de 0,9 m a 310 g/m², o plano contava 717 m de malha onde há 358 m.

Agora: `1000 / (largura em m × gramatura × folhas)`, com 2 folhas na malha tubular. A estimativa de custo por quilo
deixou de recusar esse caso (a recusa só existia por causa do defeito). Os planos já confirmados não mudam — são
guardados como foram feitos —, e o guia diz para conferir os que usaram malha tubular sem o rendimento informado.

### Implementado: a execução do corte

`domain/execucaoDoCorte.ts` e a seção "Execução do corte" do plano confirmado (`ui/ExecucaoDoPlano.tsx`, em
Planos deste projeto):

- **Situação:** liberada → em corte → concluída, ou cancelada antes de concluir (com o motivo; o plano pode ser
  liberado de novo). Uma execução que vale por plano. O título do plano mostra a situação.
- **Quem e quando:** quem liberou, quem cortou e quem concluiu (informados — sem login) e as horas.
- **Concluir:** as camadas enfestadas e o consumo real de cada rolo (ou o total, no plano por peso). A baixa do
  estoque passa a ser a do real: a baixa planejada já dada é estornada com o motivo e a do real entra; a reserva de
  um rolo não usado é estornada. Tudo ou nada.
- **Retalho:** a sobra de um rolo pode ficar marcada como retalho (o rolo continua no estoque, com o saldo dele, e
  aparece como "(retalho)" na escolha dos rolos).
- **Planejado × executado:** camadas, consumo (diferença em metros e em %), consumo por camada, tempo do corte e a
  tabela por rolo.
- **Formato:** o cadastro de produção vai à versão 3 (`execucoes`, e `retalho` no rolo). O arquivo da versão 2 abre
  sem execuções e ganha uma cópia em `copias-de-seguranca` antes da primeira gravação na 3 (o mecanismo que já
  existia para a troca de formato). Uma execução com dados que não conferem fica de fora, com o motivo, e o arquivo
  como estava vai para as cópias.

### Não implementado, e por quê

- **PLT/HPGL e ligação com máquinas:** sem plotter, faca ou enfestadeira e sem a documentação de cada um, um
  arquivo para eles não teria como ser validado; ficam as saídas testadas (PDF 1:1 e DXF R12).
- **Reconhecimento automático do molde numa foto:** sem um quadro de captura e sem correção de perspectiva, a
  precisão não teria como ser garantida; fica a imagem calibrada com o traçado à mão.
- **Fila entre estações, IA, ERP, 3D, ficha técnica, coleções e e-commerce:** precisam de servidor, de serviço e
  conta externos, ou são de outro tipo de programa (ver o inventário).

## Conferência

- `npx vitest run`: 134 arquivos, 2644 testes passando (antes: 132 e 2626); `npx eslint .` e `npx tsc -b --noEmit`
  sem erro; `npm run build` gera o programa.
- Testes novos: o rendimento tubular (`planoDeCorte`, `planoDeEnfesto` — o cálculo que a tela usa —,
  `cadastroDeProducao` e `custoDoTecido`, todos com a conta que dava o dobro); a execução no domínio (liberar, começar, cancelar, concluir com e sem rolos, a baixa planejada
  trocada pela real, a reserva do rolo não usado, o retalho, o tudo ou nada, o comparativo, o arquivo da versão 2 e
  a volta do disco, o registro inválido de fora) e na tela (o fluxo inteiro, o erro sem mudar nada, cancelar e
  liberar de novo, o plano por peso).
- O programa gerado, numa pasta de dados descartável: o molde de teste importado, um plano confirmado, liberado,
  começado e concluído; a tela com o planejado × executado; o `cadastro-de-producao.json` gravado na versão 3 com a
  execução concluída e o consumo real; sem erro na página (8 conferências, nenhuma falha).
- O teste de uso do repositório, no Windows: 17 conferências, nenhuma falha.
