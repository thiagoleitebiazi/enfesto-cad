import { useLayoutEffect, useRef, useState } from 'react';
import type { ModoDeDesenho } from './AreaDeDesenho';
import { ajustarCompactacao } from './compactacaoDaFita';
import { Icone, type NomeDoIcone } from './Icone';
import { MenuSuspenso } from './MenuSuspenso';
import type { UnidadeDeRegua } from './transformacaoDeTela';

interface BarraDeFerramentasProps {
  readonly modo: ModoDeDesenho;
  readonly podeDesfazer: boolean;
  readonly podeRefazer: boolean;
  readonly temSelecao: boolean;
  readonly temSelecaoUnica: boolean;
  readonly onNovoProjeto: () => void;
  readonly onDesfazer: () => void;
  readonly onRefazer: () => void;
  readonly onDuplicar: () => void;
  readonly onExcluir: () => void;
  readonly onSelecionarTudo: () => void;
  readonly podeSelecionarTudo: boolean;
  readonly onCopiar: () => void;
  readonly onRecortar: () => void;
  readonly onColar: () => void;
  readonly podeColar: boolean;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onAjustarTela: () => void;
  readonly onVistaAnterior: () => void;
  readonly onProximaVista: () => void;
  readonly podeVistaAnterior: boolean;
  readonly podeProximaVista: boolean;
  readonly mostrarGrade: boolean;
  readonly onAlternarGrade: () => void;
  readonly imaAtivo: boolean;
  readonly onAlternarIma: () => void;
  readonly unidadeDaRegua: UnidadeDeRegua;
  readonly onDefinirUnidadeDaRegua: (unidade: UnidadeDeRegua) => void;
  readonly onAbrirAtalhos: () => void;
  readonly onAbrirSobre: () => void;
  readonly mostrarListaDePecas: boolean;
  readonly onAlternarListaDePecas: () => void;
  readonly mostrarBarraDeVisualizacao: boolean;
  readonly onAlternarBarraDeVisualizacao: () => void;
  readonly mostrarValidacao: boolean;
  readonly onAlternarValidacao: () => void;
  readonly onAbrirPropriedadesDaPeca: () => void;
  readonly temCerca: boolean;
  /** Sem cerca: entra/sai do modo de definir cerca. Com cerca: remove a cerca. */
  readonly onAlternarDefinirCerca: () => void;
  readonly onMoverCerca: () => void;
  readonly onEntrarModoSelecionar: () => void;
  readonly onEntrarModoNovoMolde: () => void;
  readonly onEntrarModoNovoFuro: () => void;
  readonly onEntrarModoPique: () => void;
  readonly onEntrarModoMarca: () => void;
  readonly onImportarDxf: () => void;
  readonly onImportarPdf: () => void;
  readonly onAbrirTecido: () => void;
  readonly onAbrirEnfesto: () => void;
  readonly onSugerirPosicao: () => void;
  readonly podeSugerirPosicao: boolean;
  readonly onNestingAutomatico: () => void;
  readonly podeExecutarNesting: boolean;
  readonly onEntrarModoMoverPonto: () => void;
  readonly onEntrarModoModificar: () => void;
  readonly onEntrarModoRedefinirPerimetro: () => void;
  readonly onEntrarModoInserirPonto: () => void;
  readonly onEntrarModoExcluirPonto: () => void;
  readonly onEntrarModoArredondarOuChanfrar: () => void;
  readonly onAbrirDimensionar: () => void;
  readonly onEspelharManual: () => void;
  readonly onGirarLivre: () => void;
  readonly onElementoParalelo: () => void;
  readonly onConverterEmCostura: () => void;
  readonly onAlinhar: () => void;
  readonly podeAlinhar: boolean;
  readonly onAbrirExportacaoPdf: () => void;
  readonly podeExportarPdf: boolean;
  readonly onSalvar: () => void;
  readonly onSalvarComo: () => void;
  readonly onAbrirBiblioteca: () => void;
  readonly onAbrirHistorico: () => void;
  readonly onAbrirRelatorio: () => void;
  readonly onInverterSelecao: () => void;
  readonly onCriarPontoDeRestauracao: () => void;
  readonly onRestaurar: () => void;
  /** A peça selecionada tem um ponto de restauração guardado. */
  readonly temPontoDeRestauracao: boolean;
  readonly onEntrarModoRetangulo: () => void;
  readonly onEntrarModoSentidoDoFio: () => void;
  readonly onAbrirCostura: () => void;
  readonly onRemoverCostura: () => void;
  /** Alguma das peças selecionadas tem margem de costura para remover. */
  readonly podeRemoverCostura: boolean;
  readonly onEntrarModoMedirDistancia: () => void;
  readonly onEntrarModoMedirPerimetro: () => void;
  readonly onEntrarModoCompararPerimetros: () => void;
  readonly onAbrirInformacoesDosMoldes: () => void;
}

const NAO_IMPLEMENTADO_CURVA = 'Ainda não implementado — contornos com curvas Bézier (apenas segmentos retos por enquanto)';
const SO_PARA_ELEMENTOS =
  'indisponível neste programa: trabalha sobre elementos de modelagem (linhas soltas), e aqui só existem peças fechadas';

const SEM_CURVAS = 'indisponível neste programa: os contornos são feitos só de segmentos retos, sem curvas nem arcos';
const SEM_GRADUACAO =
  'indisponível neste programa: não há graduação — cada tamanho entra como uma peça própria, já graduada';
const SEM_COTAS =
  'indisponível neste programa: é uma cota fixa no desenho, que aqui não existe. Para medir, use Distância ou Perímetro';
const SO_NA_MODELAGEM =
  'indisponível neste programa: pences, pregas, bainhas e dobras são feitas na modelagem; aqui os moldes chegam prontos para o encaixe';
const CORTAR_E_UNIR_SAO_DA_MODELAGEM =
  'indisponível neste programa: cortar e unir moldes são operações de modelagem; aqui os moldes chegam prontos para o encaixe';
const SEM_TEXTO =
  'indisponível neste programa: não há textos soltos no desenho; o nome da peça aparece sobre a linha de fio';
const NAO_CONFIRMADO = 'ainda não disponível: o comportamento exato desta ferramenta ainda não foi confirmado';
const SEM_PECA = 'selecione uma peça primeiro';
const SEM_PECAS = 'não há peças no projeto';

/**
 * Dica de um botão pequeno sem peça selecionada. Começa pelo nome da
 * ferramenta porque, com a fita compactada, o botão pequeno fica só com o
 * ícone e a dica é o que diz qual ferramenta ele é.
 */
const semPecaSelecionada = (ferramenta: string): string => `${ferramenta} — selecione uma peça primeiro`;

/**
 * Rótulo de botão grande: numa linha só; com a fita compactada (janela
 * estreita, ver compactacaoDaFita), quebra antes de `segunda`.
 */
function RotuloDeDuasLinhas(props: { readonly primeira: string; readonly segunda: string }): React.JSX.Element {
  return (
    <span>
      {props.primeira} <br className="quebra-de-rotulo" />
      {props.segunda}
    </span>
  );
}

interface FerramentaProps {
  readonly tamanho: 'grande' | 'pequeno';
  /** O nome da ferramenta; num botão grande, um par diz onde o rótulo quebra com a fita compactada. */
  readonly rotulo: string | readonly [string, string];
  readonly icone: NomeDoIcone;
  /** A dica com a ferramenta disponível. */
  readonly dica?: string;
  /** Motivo fixo de a ferramenta não existir neste programa: o botão fica sempre desligado, e a dica diz por quê. */
  readonly indisponivel?: string;
  /** O que falta agora para usar a ferramenta ("selecione uma peça primeiro"); `null` quando não falta nada. */
  readonly falta?: string | null;
  /** Ferramenta de modo: `true` enquanto é ela que está ligada. */
  readonly pressionado?: boolean;
  readonly onClick?: () => void;
}

/**
 * Botão da fita, grande (ícone em cima do rótulo) ou pequeno (ícone ao lado,
 * até três empilhados numa coluna). Desligado, a dica começa pelo nome da
 * ferramenta — com a fita compactada o botão pequeno fica só com o ícone — e
 * diz por que ela não está disponível.
 */
function Ferramenta(props: FerramentaProps): React.JSX.Element {
  const nome = typeof props.rotulo === 'string' ? props.rotulo : props.rotulo.join(' ');
  const motivo = props.indisponivel ?? props.falta ?? null;
  return (
    <button
      className={`botao-${props.tamanho}${props.pressionado ? ' item-selecionado' : ''}`}
      aria-pressed={props.pressionado}
      onClick={props.onClick}
      disabled={motivo !== null}
      title={motivo !== null ? `${nome} — ${motivo}` : props.dica}
    >
      <Icone nome={props.icone} />
      {typeof props.rotulo === 'string' ? (
        <span>{props.rotulo}</span>
      ) : (
        <RotuloDeDuasLinhas primeira={props.rotulo[0]} segunda={props.rotulo[1]} />
      )}
    </button>
  );
}

type Aba =
  | 'arquivo'
  | 'inicio'
  | 'construcao'
  | 'producao'
  | 'marcacoes'
  | 'graduacao'
  | 'manipulacao'
  | 'conferencia'
  | 'modelo'
  | 'encaixe';

const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: 'arquivo', rotulo: 'Arquivo' },
  { id: 'inicio', rotulo: 'Início' },
  { id: 'construcao', rotulo: 'Construção' },
  { id: 'producao', rotulo: 'Produção' },
  { id: 'marcacoes', rotulo: 'Marcações' },
  { id: 'graduacao', rotulo: 'Graduação' },
  { id: 'manipulacao', rotulo: 'Manipulação' },
  { id: 'conferencia', rotulo: 'Conferência' },
  { id: 'modelo', rotulo: 'Modelo' },
  { id: 'encaixe', rotulo: 'Encaixe' },
];

/**
 * Barra de ferramentas em abas (estilo ribbon) — reorganiza os mesmos
 * grupos/ações que já existiam em linha única numa barra com abas
 * clicáveis, para caber mais ferramentas sem exigir rolagem horizontal
 * numa tela comum. Os comandos de visualização não ocupam uma aba: ficam
 * nos menus Visão/Opções/Janelas/Ajuda, à direita das abas, e na barra de
 * visualização embaixo do desenho (BarraDeVisualizacao), sempre à mão.
 *
 * As abas e os grupos seguem a organização costumeira de um CAD de moldes
 * (Início, Construção, Produção, Marcações, Graduação, Manipulação,
 * Conferência e Modelo), mais a aba Encaixe, que é o trabalho próprio deste
 * programa. As ferramentas que dependem do que não existe aqui — elementos
 * soltos (linhas que ainda não formam peça), curvas, graduação, pences e
 * dobras, cotas fixas — aparecem no lugar de costume, mas desabilitadas e
 * com o motivo na dica; nenhuma é decorativa. Cada botão tem ícone + rótulo,
 * com ícones desenhados para este projeto — sem copiar o conjunto de ícones
 * de nenhum software de referência. Em janela estreita a fita se compacta em
 * vez de quebrar linha (compactacaoDaFita).
 */
export function BarraDeFerramentas(props: BarraDeFerramentasProps): React.JSX.Element {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('inicio');
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  // Mede antes da pintura: ao trocar de aba (outros botões) e sempre que a
  // largura da fita muda. Os atributos de compactação ficam só no DOM — o
  // React não os renderiza, então não há conflito com ele.
  useLayoutEffect(() => {
    const conteudo = conteudoRef.current;
    if (!conteudo) return;
    const ajustar = (): void => {
      const grupos = [...conteudo.querySelectorAll<HTMLElement>('.grupo-de-ferramentas')];
      ajustarCompactacao(conteudo, grupos, () => conteudo.scrollWidth <= conteudo.clientWidth);
    };
    ajustar();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(ajustar);
    observador.observe(conteudo);
    return () => observador.disconnect();
  }, [abaAtiva]);

  return (
    <div className="barra-de-ferramentas-ribbon" role="toolbar" aria-label="Barra de ferramentas principal">
      <div className="barra-de-acesso-rapido" role="group" aria-label="Acesso rápido">
        <button onClick={props.onNovoProjeto} title="Novo projeto (Ctrl+N)">
          <Icone nome="novo" />
        </button>
        <button onClick={props.onAbrirBiblioteca} title="Abrir (Ctrl+O)">
          <Icone nome="abrir" />
        </button>
        <button onClick={props.onSalvar} title="Salvar (Ctrl+S)">
          <Icone nome="salvar" />
        </button>
        <button onClick={props.onAbrirExportacaoPdf} disabled={!props.podeExportarPdf} title="Exportar PDF (Ctrl+E)">
          <Icone nome="exportar" />
        </button>
        <span className="separador-de-acesso-rapido" />
        <button onClick={props.onDesfazer} disabled={!props.podeDesfazer} title="Desfazer (Ctrl+Z)">
          <Icone nome="desfazer" />
        </button>
        <button onClick={props.onRefazer} disabled={!props.podeRefazer} title="Refazer (Ctrl+Y)">
          <Icone nome="refazer" />
        </button>
        <span className="separador-de-acesso-rapido" />
        <button onClick={props.onRecortar} disabled={!props.temSelecaoUnica} title="Recortar (Ctrl+X)">
          <Icone nome="recortar" />
        </button>
        <button onClick={props.onCopiar} disabled={!props.temSelecaoUnica} title="Copiar (Ctrl+C)">
          <Icone nome="copiar" />
        </button>
        <button onClick={props.onColar} disabled={!props.podeColar} title="Colar (Ctrl+V)">
          <Icone nome="colar" />
        </button>
        <button onClick={props.onExcluir} disabled={!props.temSelecao} title="Excluir (Delete)">
          <Icone nome="excluir" />
        </button>
      </div>
      <div className="ribbon-cabecalho">
        <div className="ribbon-abas" role="tablist" aria-label="Categorias de ferramentas">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              role="tab"
              aria-selected={abaAtiva === aba.id}
              className={[
                'ribbon-aba',
                abaAtiva === aba.id ? 'ribbon-aba-ativa' : '',
                aba.id === 'arquivo' ? 'ribbon-aba-arquivo' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>
        <div className="ribbon-menus">
          <MenuSuspenso
            rotulo="Visão"
            itens={[
              { tipo: 'acao', rotulo: 'Aumentar zoom', atalho: '+', onEscolher: props.onZoomIn },
              { tipo: 'acao', rotulo: 'Diminuir zoom', atalho: '-', onEscolher: props.onZoomOut },
              { tipo: 'acao', rotulo: 'Ajustar à tela', atalho: 'Ctrl+0', onEscolher: props.onAjustarTela },
              { tipo: 'separador' },
              {
                tipo: 'acao',
                rotulo: 'Vista anterior',
                desabilitado: !props.podeVistaAnterior,
                titulo: props.podeVistaAnterior ? 'Volta ao enquadramento de antes' : 'Nenhuma vista guardada ainda',
                onEscolher: props.onVistaAnterior,
              },
              {
                tipo: 'acao',
                rotulo: 'Próxima vista',
                desabilitado: !props.podeProximaVista,
                titulo: props.podeProximaVista ? 'Refaz o enquadramento desfeito por Vista anterior' : 'Nada para refazer',
                onEscolher: props.onProximaVista,
              },
              { tipo: 'separador' },
              { tipo: 'alternar', rotulo: 'Grade', marcado: props.mostrarGrade, onEscolher: props.onAlternarGrade },
            ]}
          />
          <MenuSuspenso
            rotulo="Opções"
            itens={[
              {
                tipo: 'alternar',
                rotulo: 'Ímã',
                marcado: props.imaAtivo,
                titulo:
                  'Prende no vértice mais próximo ou, com a grade visível, no ponto da grade: ao clicar para criar pontos e ao arrastar um vértice (Mover ponto)',
                onEscolher: props.onAlternarIma,
              },
              { tipo: 'separador' },
              {
                tipo: 'opcao',
                rotulo: 'Régua em centímetros',
                marcado: props.unidadeDaRegua === 'cm',
                onEscolher: () => props.onDefinirUnidadeDaRegua('cm'),
              },
              {
                tipo: 'opcao',
                rotulo: 'Régua em milímetros',
                marcado: props.unidadeDaRegua === 'mm',
                onEscolher: () => props.onDefinirUnidadeDaRegua('mm'),
              },
            ]}
          />
          <MenuSuspenso
            rotulo="Janelas"
            itens={[
              {
                tipo: 'alternar',
                rotulo: 'Lista de peças',
                marcado: props.mostrarListaDePecas,
                titulo: 'A lista à esquerda do desenho',
                onEscolher: props.onAlternarListaDePecas,
              },
              {
                tipo: 'alternar',
                rotulo: 'Barra de visualização',
                marcado: props.mostrarBarraDeVisualizacao,
                titulo: 'Mão, zoom, vistas, grade e ímã, embaixo do desenho',
                onEscolher: props.onAlternarBarraDeVisualizacao,
              },
              {
                tipo: 'alternar',
                rotulo: 'Validação do projeto',
                marcado: props.mostrarValidacao,
                titulo: 'A lista de problemas do projeto (também pelo botão Validação, na barra de status)',
                onEscolher: props.onAlternarValidacao,
              },
              { tipo: 'separador' },
              {
                tipo: 'acao',
                rotulo: 'Propriedades da peça',
                desabilitado: !props.temSelecaoUnica,
                titulo: props.temSelecaoUnica ? 'Também com duplo clique na peça' : 'Selecione uma peça primeiro',
                onEscolher: props.onAbrirPropriedadesDaPeca,
              },
            ]}
          />
          <MenuSuspenso
            rotulo="Ajuda"
            itens={[
              { tipo: 'acao', rotulo: 'Atalhos de teclado', atalho: 'F1', onEscolher: props.onAbrirAtalhos },
              { tipo: 'acao', rotulo: 'Sobre o Enfesto CAD', onEscolher: props.onAbrirSobre },
            ]}
          />
        </div>
      </div>

      <div className="ribbon-conteudo" ref={conteudoRef}>
        <div className="ribbon-conteudo-abas" role="tabpanel">
          {abaAtiva === 'arquivo' && (
            <div className="grupo-de-ferramentas" role="group" aria-label="Arquivo">
              <button onClick={props.onNovoProjeto} title="Novo projeto (Ctrl+N)">
                <Icone nome="novo" />
                <span>Novo</span>
              </button>
              <button onClick={props.onAbrirBiblioteca} title="Abrir um projeto da biblioteca (Ctrl+O)">
                <Icone nome="abrir" />
                <span>Abrir</span>
              </button>
              <button onClick={props.onSalvar} title="Salvar o projeto atual (Ctrl+S)">
                <Icone nome="salvar" />
                <span>Salvar</span>
              </button>
              <button onClick={props.onSalvarComo} title="Salvar como um novo projeto (Ctrl+Shift+S)">
                <Icone nome="salvar-como" />
                <span>Salvar como</span>
              </button>
              <button onClick={props.onAbrirBiblioteca} title="Biblioteca de trabalhos (Ctrl+O)">
                <Icone nome="biblioteca" />
                <span>Biblioteca</span>
              </button>
              <button onClick={props.onAbrirHistorico} title="Histórico e versões deste projeto (Ctrl+H)">
                <Icone nome="historico" />
                <span>Histórico</span>
              </button>
            </div>
          )}

          {abaAtiva === 'inicio' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Desenho">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Cor"
                  icone="cor"
                  indisponivel="indisponível neste programa: as peças não têm cor própria; a cor do contorno mostra o estado da peça (selecionada ou com problema)"
                />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Editar">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Colar"
                  icone="colar"
                  dica="Colar (Ctrl+V)"
                  falta={props.podeColar ? null : 'copie ou recorte uma peça primeiro'}
                  onClick={props.onColar}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Recortar"
                    icone="recortar"
                    dica="Recortar (Ctrl+X) — uma peça por vez"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onRecortar}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Copiar"
                    icone="copiar"
                    dica="Copiar (Ctrl+C) — uma peça por vez"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onCopiar}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Excluir"
                    icone="excluir"
                    dica="Excluir as peças selecionadas (Delete)"
                    falta={props.temSelecao ? null : SEM_PECA}
                    onClick={props.onExcluir}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Selecionar">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Selecionar"
                  icone="selecionar"
                  pressionado={props.modo === 'selecionar'}
                  dica="Selecionar ou mover peças: clique numa peça, ou arraste-a (Esc volta para cá de qualquer ferramenta)"
                  onClick={props.onEntrarModoSelecionar}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Inverter seleção"
                    icone="inverter-selecao"
                    dica="Inverter seleção: passam a estar selecionadas as peças que não estavam"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onInverterSelecao}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Selecionar tudo"
                    icone="selecionar-tudo"
                    dica="Selecionar tudo (Ctrl+A)"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onSelecionarTudo}
                  />
                  <Ferramenta tamanho="pequeno" rotulo="Inverter moldes" icone="inverter-moldes" indisponivel={NAO_CONFIRMADO} />
                </div>
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Selecionar', 'moldes']}
                  icone="selecionar-moldes"
                  dica="Selecionar moldes: seleciona todos os moldes do projeto — aqui todo objeto é um molde, então faz o mesmo que Selecionar tudo"
                  falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                  onClick={props.onSelecionarTudo}
                />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Restauração">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Ponto de', 'restauração']}
                  icone="ponto-de-restauracao"
                  dica={
                    props.temPontoDeRestauracao
                      ? 'Ponto de restauração: troca o ponto guardado desta peça pela forma que ela tem agora'
                      : 'Ponto de restauração: guarda a forma da peça selecionada como está agora, para voltar a ela com Restaurar'
                  }
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={props.onCriarPontoDeRestauracao}
                />
                <Ferramenta
                  tamanho="grande"
                  rotulo="Restaurar"
                  icone="restaurar"
                  dica="Restaurar: a peça selecionada volta à forma e ao lugar do ponto de restauração dela (Ctrl+Z desfaz)"
                  falta={
                    !props.temSelecaoUnica
                      ? SEM_PECA
                      : props.temPontoDeRestauracao
                        ? null
                        : 'crie antes um ponto de restauração para esta peça'
                  }
                  onClick={props.onRestaurar}
                />
              </div>
            </>
          )}

          {abaAtiva === 'construcao' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Retas">
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Reta"
                    icone="reta"
                    pressionado={props.modo === 'novo-molde'}
                    dica="Reta: desenha o contorno de um molde novo, reta a reta — clique os pontos e feche com Enter; depois, dois cliques marcam a linha de fio"
                    onClick={props.onEntrarModoNovoMolde}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Retângulo"
                    icone="retangulo"
                    pressionado={props.modo === 'retangulo'}
                    dica="Retângulo: cria um molde retangular — clique num canto e depois no canto oposto (as medidas aparecem no desenho); depois, dois cliques marcam a linha de fio"
                    onClick={props.onEntrarModoRetangulo}
                  />
                  <Ferramenta tamanho="pequeno" rotulo="Por ângulo" icone="por-angulo" indisponivel={SO_PARA_ELEMENTOS} />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Estender reta" icone="estender-reta" indisponivel={SO_PARA_ELEMENTOS} />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Estender até elemento"
                    icone="estender-ate-elemento"
                    indisponivel={SO_PARA_ELEMENTOS}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Estender duas retas"
                    icone="estender-duas-retas"
                    indisponivel={SO_PARA_ELEMENTOS}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Curvas">
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Curva" icone="curva" indisponivel={SEM_CURVAS} />
                  <Ferramenta tamanho="pequeno" rotulo="Dividir curva" icone="dividir-curva" indisponivel={SEM_CURVAS} />
                  <Ferramenta tamanho="pequeno" rotulo="Pré-definida" icone="curva-predefinida" indisponivel={SEM_CURVAS} />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Espiral e curvas" icone="espiral" indisponivel={SEM_CURVAS} />
                  <Ferramenta tamanho="pequeno" rotulo="Cadastrar curva" icone="cadastrar-curva" indisponivel={SEM_CURVAS} />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Editar pontos de curva"
                    icone="editar-pontos-de-curva"
                    indisponivel={SEM_CURVAS}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Pontos">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Por', 'coordenada']}
                  icone="ponto-por-coordenada"
                  indisponivel={SO_PARA_ELEMENTOS}
                />
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Por', 'interseção']}
                  icone="ponto-por-intersecao"
                  indisponivel={SO_PARA_ELEMENTOS}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="No centro do arco" icone="ponto-no-centro" indisponivel={SEM_CURVAS} />
                  <Ferramenta tamanho="pequeno" rotulo="No perímetro" icone="ponto-no-perimetro" indisponivel={SO_PARA_ELEMENTOS} />
                  <Ferramenta tamanho="pequeno" rotulo="Por distância" icone="ponto-por-distancia" indisponivel={SO_PARA_ELEMENTOS} />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Arcos">
                <Ferramenta tamanho="grande" rotulo={['Por', 'raio']} icone="arco-por-raio" indisponivel={SEM_CURVAS} />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Texto">
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Inserir texto" icone="inserir-texto" indisponivel={SEM_TEXTO} />
                  <Ferramenta tamanho="pequeno" rotulo="Editar texto" icone="editar-texto" indisponivel={SEM_TEXTO} />
                </div>
              </div>
            </>
          )}

          {abaAtiva === 'producao' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Definir moldes">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Extrair', 'molde']}
                  icone="extrair-molde"
                  indisponivel={SO_PARA_ELEMENTOS}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Criar molde"
                    icone="novo-molde"
                    pressionado={props.modo === 'novo-molde'}
                    dica="Criar molde: desenha o contorno de um molde novo — clique os pontos e feche com Enter (a mesma ferramenta de Construção > Reta)"
                    onClick={props.onEntrarModoNovoMolde}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Digitalizar"
                    icone="digitalizar"
                    indisponivel="indisponível neste programa: depende de uma mesa digitalizadora"
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Sentido do fio"
                    icone="sentido-do-fio"
                    pressionado={props.modo === 'sentido-do-fio'}
                    dica="Sentido do fio: redesenha a linha de fio da peça selecionada — clique no início e no fim da seta. A peça não gira"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoSentidoDoFio}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Complementar moldes">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Linha de', 'simetria']}
                  icone="linha-de-simetria"
                  indisponivel="indisponível neste programa: o encaixe não dobra moldes numa linha de simetria"
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Bainha" icone="bainha" indisponivel={SO_NA_MODELAGEM} />
                  <Ferramenta tamanho="pequeno" rotulo="Dobrar" icone="dobrar" indisponivel={SO_NA_MODELAGEM} />
                  <Ferramenta tamanho="pequeno" rotulo="Desdobrar" icone="desdobrar" indisponivel={SO_NA_MODELAGEM} />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Costura">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Costura"
                  icone="costura"
                  dica="Costura: define a margem de costura das peças selecionadas — a linha de corte fica afastada do contorno por essa medida"
                  falta={props.temSelecao ? null : SEM_PECA}
                  onClick={props.onAbrirCostura}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Remover costura"
                    icone="remover-costura"
                    dica="Remover costura: zera a margem de costura das peças selecionadas (a linha de corte volta a ser o contorno)"
                    falta={!props.temSelecao ? SEM_PECA : props.podeRemoverCostura ? null : 'a seleção não tem costura para remover'}
                    onClick={props.onRemoverCostura}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Converter em contorno"
                    icone="converter-contorno"
                    indisponivel={NAO_CONFIRMADO}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Converter em costura"
                    icone="converter-costura"
                    dica="Converter em costura: define a margem de costura da peça (o mesmo diálogo de Costura)"
                    falta={props.temSelecao ? null : SEM_PECA}
                    onClick={props.onAbrirCostura}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Pregas e Pences">
                <Ferramenta tamanho="grande" rotulo="Pregas" icone="pregas" indisponivel={SO_NA_MODELAGEM} />
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Pence no', 'contorno']}
                  icone="pence-no-contorno"
                  indisponivel={SO_NA_MODELAGEM}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Pence interna" icone="pence-interna" indisponivel={SO_NA_MODELAGEM} />
                  <Ferramenta tamanho="pequeno" rotulo="Fechar pence" icone="fechar-pence" indisponivel={SO_NA_MODELAGEM} />
                  <Ferramenta tamanho="pequeno" rotulo="Transferir pence" icone="transferir-pence" indisponivel={SO_NA_MODELAGEM} />
                </div>
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Múltiplas', 'pences']}
                  icone="multiplas-pences"
                  indisponivel={SO_NA_MODELAGEM}
                />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Cortar e Unir">
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Cortar" icone="cortar-molde" indisponivel={CORTAR_E_UNIR_SAO_DA_MODELAGEM} />
                  <Ferramenta tamanho="pequeno" rotulo="Unir" icone="unir-moldes" indisponivel={CORTAR_E_UNIR_SAO_DA_MODELAGEM} />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Remover região"
                    icone="remover-regiao"
                    indisponivel={CORTAR_E_UNIR_SAO_DA_MODELAGEM}
                  />
                </div>
              </div>
            </>
          )}

          {abaAtiva === 'marcacoes' && (
            <div className="grupo-de-ferramentas" role="group" aria-label="Marcações">
              <button
                aria-pressed={props.modo === 'pique'}
                className={props.modo === 'pique' ? 'item-selecionado' : ''}
                onClick={props.onEntrarModoPique}
                disabled={!props.temSelecao}
                title={props.temSelecao ? 'Adicionar pique: clique perto da borda da peça selecionada' : 'Selecione uma peça primeiro'}
              >
                <Icone nome="pique" />
                <span>Pique</span>
              </button>
              <button
                aria-pressed={props.modo === 'marca'}
                className={props.modo === 'marca' ? 'item-selecionado' : ''}
                onClick={props.onEntrarModoMarca}
                disabled={!props.temSelecao}
                title={props.temSelecao ? 'Adicionar marca de referência na peça selecionada' : 'Selecione uma peça primeiro'}
              >
                <Icone nome="marca" />
                <span>Marca</span>
              </button>
              <button
                aria-pressed={props.modo === 'novo-furo'}
                className={props.modo === 'novo-furo' ? 'item-selecionado' : ''}
                onClick={props.onEntrarModoNovoFuro}
                disabled={!props.temSelecao}
                title={props.temSelecao ? 'Novo furo na peça selecionada: clique os pontos, Enter para fechar' : 'Selecione uma peça primeiro'}
              >
                <Icone nome="furo" />
                <span>Furo</span>
              </button>
            </div>
          )}

          {abaAtiva === 'graduacao' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Graduar">
                <Ferramenta tamanho="grande" rotulo="Tabela" icone="tabela-de-graduacao" indisponivel={SEM_GRADUACAO} />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Automático" icone="graduar-automatico" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Mouse" icone="graduar-mouse" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Tangente" icone="graduar-tangente" indisponivel={SEM_GRADUACAO} />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Regras" icone="regras" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Criar regra" icone="criar-regra" indisponivel={SEM_GRADUACAO} />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Manipular graduação">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Remover', 'graduação']}
                  icone="remover-graduacao"
                  indisponivel={SEM_GRADUACAO}
                />
                <Ferramenta tamanho="grande" rotulo="Separar" icone="separar-graduacao" indisponivel={SEM_GRADUACAO} />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Unir" icone="unir-graduacao" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Agrupar" icone="agrupar-graduacao" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Deduzir" icone="deduzir-graduacao" indisponivel={SEM_GRADUACAO} />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Copiar graduação" icone="copiar-graduacao" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Ajustar" icone="ajustar-graduacao" indisponivel={SEM_GRADUACAO} />
                  <Ferramenta tamanho="pequeno" rotulo="Graduar curva" icone="graduar-curva" indisponivel={SEM_GRADUACAO} />
                </div>
              </div>
            </>
          )}

          {abaAtiva === 'manipulacao' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Redefinir">
                <button
                  aria-pressed={props.modo === 'modificar'}
                  className={`botao-grande${props.modo === 'modificar' ? ' item-selecionado' : ''}`}
                  onClick={props.onEntrarModoModificar}
                  disabled={!props.temSelecaoUnica}
                  title={
                    props.temSelecaoUnica
                      ? 'Modificar: clique num vértice da peça selecionada para deslocá-lo por uma medida exata, ou arraste-o — Shift+clique ou um retângulo indicam vários vértices de uma vez'
                      : semPecaSelecionada('Modificar')
                  }
                >
                  <Icone nome="modificar" />
                  <span>Modificar</span>
                </button>
                <div className="coluna-de-ferramenta">
                  <button className="botao-pequeno" disabled title={`Manipular pontos — ${SO_PARA_ELEMENTOS}`}>
                    <Icone nome="manipular-pontos" />
                    <span>Manipular pontos</span>
                  </button>
                  <button
                    aria-pressed={props.modo === 'selecionar'}
                    className={`botao-pequeno${props.modo === 'selecionar' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoSelecionar}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Mover: arraste a peça inteira (modo Selecionar)' : semPecaSelecionada('Mover')}
                  >
                    <Icone nome="selecionar" />
                    <span>Mover</span>
                  </button>
                  <button
                    aria-pressed={props.modo === 'mover-ponto'}
                    className={`botao-pequeno${props.modo === 'mover-ponto' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoMoverPonto}
                    disabled={!props.temSelecaoUnica}
                    title={
                      props.temSelecaoUnica
                        ? 'Mover ponto: arraste um vértice da peça selecionada — Shift+clique soma vértices à seleção, e arrastar num espaço vazio seleciona os vértices dentro do retângulo, para movê-los juntos'
                        : semPecaSelecionada('Mover ponto')
                    }
                  >
                    <Icone nome="mover-ponto" />
                    <span>Mover ponto</span>
                  </button>
                </div>
                <div className="coluna-de-ferramenta">
                  <button className="botao-pequeno" disabled title={`Manipulação rápida — ${SO_PARA_ELEMENTOS}`}>
                    <Icone nome="manipulacao-rapida" />
                    <span>Manipulação rápida</span>
                  </button>
                  <button
                    aria-pressed={props.modo === 'redefinir-perimetro'}
                    className={`botao-pequeno${props.modo === 'redefinir-perimetro' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoRedefinirPerimetro}
                    disabled={!props.temSelecaoUnica}
                    title={
                      props.temSelecaoUnica
                        ? 'Redefinir perímetro: clique numa aresta da peça selecionada e digite o novo comprimento dela'
                        : semPecaSelecionada('Redefinir perímetro')
                    }
                  >
                    <Icone nome="redefinir-perimetro" />
                    <span>Redefinir perímetro</span>
                  </button>
                  <button className="botao-pequeno" disabled title={`Dividir elementos — ${SO_PARA_ELEMENTOS}`}>
                    <Icone nome="dividir" />
                    <span>Dividir elementos</span>
                  </button>
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Indicar">
                <button
                  className="botao-grande"
                  onClick={props.onElementoParalelo}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Elemento paralelo: cria uma cópia com o contorno deslocado a uma distância uniforme' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="elemento-paralelo" />
                  <RotuloDeDuasLinhas primeira="Elemento" segunda="paralelo" />
                </button>
                <div className="coluna-de-ferramenta">
                  <button
                    className="botao-pequeno"
                    onClick={props.onGirarLivre}
                    disabled={!props.temSelecaoUnica}
                    title={
                      props.temSelecaoUnica
                        ? 'Girar em ângulo livre: redefine a orientação de referência da peça (diferente dos botões 90°/180°/270°, que respeitam o sentido do fio)'
                        : semPecaSelecionada('Girar')
                    }
                  >
                    <Icone nome="girar" />
                    <span>Girar</span>
                  </button>
                  <button
                    className="botao-pequeno"
                    onClick={props.onDuplicar}
                    disabled={!props.temSelecao}
                    title="Copiar: duplica a peça selecionada (Ctrl+D)"
                  >
                    <Icone nome="copiar" />
                    <span>Copiar</span>
                  </button>
                  <button
                    className="botao-pequeno"
                    onClick={props.onAbrirDimensionar}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Dimensionar: escala a peça por fatores X/Y independentes' : semPecaSelecionada('Dimensionar')}
                  >
                    <Icone nome="dimensionar" />
                    <span>Dimensionar</span>
                  </button>
                </div>
                <button
                  className="botao-grande"
                  onClick={props.onEspelharManual}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Espelhar: inverte a peça horizontalmente (ação manual, uma vez)' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="espelhar" />
                  <span>Espelhar</span>
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Cerca">
                <button
                  className="botao-grande"
                  aria-pressed={props.temCerca || props.modo === 'definir-cerca'}
                  onClick={props.onAlternarDefinirCerca}
                  title={
                    props.temCerca
                      ? 'Cerca definida — clique para removê-la'
                      : props.modo === 'definir-cerca'
                        ? 'Definindo a cerca: arraste de um canto ao outro sobre o desenho (clique de novo ou Esc para cancelar)'
                        : 'Definir cerca: arraste um retângulo sobre o desenho; depois, Mover cerca desloca por uma medida exata o que estiver dentro dele'
                  }
                >
                  <Icone nome="cerca" />
                  <RotuloDeDuasLinhas primeira="Definir" segunda="cerca" />
                </button>
                <button
                  className="botao-grande"
                  onClick={props.onMoverCerca}
                  disabled={!props.temCerca}
                  title={
                    props.temCerca
                      ? 'Mover cerca: desloca por uma medida exata os pontos dentro da cerca, nas peças selecionadas (ou em todas)'
                      : 'Defina uma cerca primeiro'
                  }
                >
                  <Icone nome="mover-cerca" />
                  <RotuloDeDuasLinhas primeira="Mover" segunda="cerca" />
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Manipular molde">
                <button className="botao-grande" disabled title={NAO_IMPLEMENTADO_CURVA}>
                  <Icone nome="curva" />
                  <RotuloDeDuasLinhas primeira="Definir" segunda="curva" />
                </button>
                <div className="coluna-de-ferramenta">
                  <button
                    aria-pressed={props.modo === 'inserir-ponto'}
                    className={`botao-pequeno${props.modo === 'inserir-ponto' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoInserirPonto}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Inserir ponto: clique numa aresta da peça selecionada' : semPecaSelecionada('Inserir ponto')}
                  >
                    <Icone nome="inserir-ponto" />
                    <span>Inserir ponto</span>
                  </button>
                  <button
                    aria-pressed={props.modo === 'excluir-ponto'}
                    className={`botao-pequeno${props.modo === 'excluir-ponto' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoExcluirPonto}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Excluir ponto: clique num vértice da peça selecionada' : semPecaSelecionada('Excluir ponto')}
                  >
                    <Icone nome="excluir-ponto" />
                    <span>Excluir ponto</span>
                  </button>
                  <button className="botao-pequeno" disabled title={`Transformar em elementos — ${SO_PARA_ELEMENTOS}`}>
                    <Icone nome="transformar-elementos" />
                    <span>Transformar em elementos</span>
                  </button>
                </div>
                <div className="coluna-de-ferramenta">
                  <button
                    className="botao-pequeno"
                    onClick={props.onAlinhar}
                    disabled={!props.podeAlinhar}
                    title={
                      props.podeAlinhar
                        ? 'Alinhar: alinha as peças selecionadas pela borda esquerda'
                        : 'Alinhar — selecione 2 ou mais peças (Ctrl+A ou clique múltiplo na lista)'
                    }
                  >
                    <Icone nome="alinhar" />
                    <span>Alinhar</span>
                  </button>
                  <button className="botao-pequeno" disabled title={`Copiar ou trocar elemento — ${SO_PARA_ELEMENTOS}`}>
                    <Icone nome="trocar-elemento" />
                    <span>Copiar ou trocar elemento</span>
                  </button>
                  <button
                    aria-pressed={props.modo === 'arredondar-ou-chanfrar'}
                    className={`botao-pequeno${props.modo === 'arredondar-ou-chanfrar' ? ' item-selecionado' : ''}`}
                    onClick={props.onEntrarModoArredondarOuChanfrar}
                    disabled={!props.temSelecaoUnica}
                    title={
                      props.temSelecaoUnica
                        ? 'Arredondar ou chanfrar: clique num vértice da peça selecionada e escolha'
                        : semPecaSelecionada('Arredondar ou chanfrar')
                    }
                  >
                    <Icone nome="arredondar" />
                    <span>Arredondar ou chanfrar</span>
                  </button>
                </div>
                <button
                  className="botao-grande"
                  onClick={props.onConverterEmCostura}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Converter em costura: define a margem de costura da peça (mesmo campo das Propriedades)' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="converter-costura" />
                  <RotuloDeDuasLinhas primeira="Converter" segunda="em costura" />
                </button>
              </div>
            </>
          )}

          {abaAtiva === 'conferencia' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Perímetro">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Conferir"
                  icone="conferir"
                  indisponivel="indisponível neste programa: conferir um molde deslizando sobre o outro é operação de modelagem. Para comparar duas medidas, use Comparar perímetros"
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Cota perímetro" icone="cota-perimetro" indisponivel={SEM_COTAS} />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Perímetro"
                    icone="perimetro"
                    pressionado={props.modo === 'medir-perimetro'}
                    dica="Perímetro: clique dentro de uma peça para ver o perímetro dela, ou em dois pontos do contorno para medir o trecho entre eles"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoMedirPerimetro}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Comparar perímetros"
                    icone="comparar-perimetros"
                    pressionado={props.modo === 'comparar-perimetros'}
                    dica="Comparar perímetros: faça duas medidas (uma peça inteira ou um trecho do contorno) e veja a diferença entre elas"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCompararPerimetros}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Distância">
                <div className="coluna-de-ferramenta">
                  <Ferramenta tamanho="pequeno" rotulo="Cota distância" icone="cota-distancia" indisponivel={SEM_COTAS} />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Distância"
                    icone="distancia"
                    pressionado={props.modo === 'medir-distancia'}
                    dica="Distância: clique em dois pontos para ver a distância, a horizontal, a vertical e o ângulo entre eles — perto de um vértice, o clique cai exatamente nele"
                    onClick={props.onEntrarModoMedirDistancia}
                  />
                  <Ferramenta tamanho="pequeno" rotulo="Comparar distância" icone="comparar-distancia" indisponivel={NAO_CONFIRMADO} />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Horizontal / Vertical"
                    icone="cota-horizontal-vertical"
                    indisponivel={SEM_COTAS}
                  />
                  <Ferramenta tamanho="pequeno" rotulo="Ângulo" icone="angulo" indisponivel={SEM_COTAS} />
                  <Ferramenta tamanho="pequeno" rotulo="Raio" icone="raio" indisponivel={SEM_CURVAS} />
                </div>
              </div>
            </>
          )}

          {abaAtiva === 'modelo' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Informações">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Propriedades"
                  icone="propriedades"
                  dica="Propriedades: nome, referência, tamanho, quantidade, costura e rotações da peça selecionada (também com duplo clique na peça)"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={props.onAbrirPropriedadesDaPeca}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Informações"
                    icone="informacoes"
                    dica="Informações: os dados do projeto — tecido, enfesto, aproveitamento e peças por tamanho (o Relatório de produção)"
                    onClick={props.onAbrirRelatorio}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Tecidos"
                    icone="tecido"
                    dica="Tecidos: o tecido do projeto — largura, gramatura e estoque, usados no encaixe"
                    onClick={props.onAbrirTecido}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Autor"
                    icone="autor"
                    indisponivel="indisponível neste programa: o projeto não guarda dados de autor"
                  />
                </div>
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Informações', 'dos moldes']}
                  icone="informacoes-dos-moldes"
                  dica="Informações dos moldes: tabela com as medidas de todas as peças do projeto"
                  onClick={props.onAbrirInformacoesDosMoldes}
                />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Operações">
                <Ferramenta tamanho="grande" rotulo="Variantes" icone="variantes" indisponivel={NAO_CONFIRMADO} />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Relacionamento piques"
                    icone="relacionamento-piques"
                    indisponivel="indisponível neste programa: os piques não têm código para relacionar um molde ao outro"
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Imagens"
                    icone="imagens"
                    indisponivel="indisponível neste programa: o projeto não guarda imagens"
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Localizar modelos"
                    icone="localizar-modelos"
                    dica="Localizar modelos: procura um projeto salvo pelo nome, código ou tecido (Biblioteca, Ctrl+O)"
                    onClick={props.onAbrirBiblioteca}
                  />
                </div>
              </div>
            </>
          )}

          {abaAtiva === 'encaixe' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Importação e exportação">
                <button onClick={props.onImportarDxf} title="Importar peças de um arquivo DXF (Ctrl+I)">
                  <Icone nome="importar" />
                  <span>Importar DXF</span>
                </button>
                <button onClick={props.onImportarPdf} title="Importar peças de um PDF exportado por este app (moldes individuais)">
                  <Icone nome="importar" />
                  <span>Importar PDF</span>
                </button>
                <button
                  onClick={props.onAbrirExportacaoPdf}
                  disabled={!props.podeExportarPdf}
                  title={
                    props.podeExportarPdf
                      ? 'Exportar PDF vetorial em escala 1:1 (Ctrl+E)'
                      : 'Adicione ao menos uma peça primeiro'
                  }
                >
                  <Icone nome="exportar" />
                  <span>Exportar PDF</span>
                </button>
                <button onClick={props.onAbrirRelatorio} title="Relatório de produção (PDF/Excel)">
                  <Icone nome="relatorio" />
                  <span>Relatórios</span>
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Configuração">
                <button onClick={props.onAbrirTecido} title="Configurar o tecido do projeto">
                  <Icone nome="tecido" />
                  <span>Tecido</span>
                </button>
                <button onClick={props.onAbrirEnfesto} title="Configurar o tipo e os parâmetros do enfesto">
                  <Icone nome="enfesto" />
                  <span>Enfesto</span>
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Encaixe">
                <button
                  onClick={props.onSugerirPosicao}
                  disabled={!props.podeSugerirPosicao}
                  title={
                    props.podeSugerirPosicao
                      ? 'Semiautomático: sugere uma posição sem sobreposição para a peça selecionada (ajuste depois arrastando)'
                      : 'Selecione uma peça e configure o enfesto primeiro'
                  }
                >
                  <Icone nome="sugerir-posicao" />
                  <span>Sugerir posição</span>
                </button>
                <button
                  onClick={props.onNestingAutomatico}
                  disabled={!props.podeExecutarNesting}
                  title={
                    props.podeExecutarNesting
                      ? 'Automático: calcula o encaixe de todas as peças (respeitando quantidade, rotação e sentido do fio)'
                      : 'Configure o enfesto e adicione ao menos uma peça primeiro'
                  }
                >
                  <Icone nome="nesting" />
                  <span>Nesting Automático</span>
                </button>
              </div>
            </>
          )}
        </div>
        {abaAtiva === 'graduacao' && (
          <p className="nota-da-fita">
            Este programa não faz graduação: cada tamanho entra como uma peça própria, já graduada (importada do DXF ou do
            PDF, na aba Encaixe). As ferramentas ficam aqui no lugar de costume, desligadas.
          </p>
        )}
      </div>
    </div>
  );
}
