import { useLayoutEffect, useRef, useState } from 'react';
import type { ModoDeDesenho } from './AreaDeDesenho';
import { ajustarCompactacao } from './compactacaoDaFita';
import type { FerramentaDeMolde } from './ferramentasDeMolde';
import type { FerramentaDePence } from './ferramentasDePence';
import type { FerramentaDeGraduacao } from './ferramentasDeGraduacao';
import type { FerramentaDeElemento } from './ferramentasDeElemento';

/** Cor, textos, linha de simetria, código de pique, autor e conferência de costuras. */
export type FerramentaDeAnotacao =
  | 'cor'
  | 'inserir-texto'
  | 'editar-texto'
  | 'linha-de-simetria'
  | 'relacionar-piques'
  | 'autor'
  | 'conferir';
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
  readonly onEntrarModoCompararDistancias: () => void;
  readonly onEntrarModoCotaDistancia: () => void;
  readonly onEntrarModoCotaHorizontalVertical: () => void;
  readonly onEntrarModoCotaAngulo: () => void;
  readonly onEntrarModoCotaPerimetro: () => void;
  readonly onConverterEmContorno: () => void;
  readonly onAbrirVariantes: () => void;
  readonly onEntrarModoCurva: () => void;
  readonly onEntrarModoArco2Pontos: () => void;
  readonly onEntrarModoArco3Pontos: () => void;
  readonly onEntrarModoArcoTangente: () => void;
  /** Os arcos que dependem de reconhecer arcos no contorno: tangente a um elemento, a arco e reta, e a 2 arcos. */
  readonly onUsarFerramentaDeArco: (ferramenta: 'arco-tangente-a-elemento' | 'arco-tangente-arco-reta' | 'arco-tangente-2-arcos') => void;
  readonly onEntrarModoCotaRaio: () => void;
  readonly onEntrarModoEditarPontosDeCurva: () => void;
  readonly onEntrarModoCadastrarCurva: () => void;
  readonly onAbrirCurvaPredefinida: () => void;
  readonly onAbrirEspiral: () => void;
  readonly onEntrarModoCirculo: () => void;
  /** Cortar, unir, dobrar, bainha, pences e pregas (aba Produção), na peça selecionada. */
  readonly onUsarFerramentaDeMolde: (ferramenta: FerramentaDeMolde | FerramentaDePence) => void;
  /** Há pelo menos duas peças no projeto (Unir precisa de outra além da selecionada). */
  readonly temOutraPeca: boolean;
  /** Retas e pontos de construção, que aqui são as linhas internas e as marcas da peça selecionada. */
  readonly onUsarFerramentaDeElemento: (ferramenta: FerramentaDeElemento) => void;
  readonly onUsarFerramentaDeAnotacao: (ferramenta: FerramentaDeAnotacao) => void;
  /** Atalhos para outros programas (aba Início). Só há como abri-los no programa instalado, não no navegador. */
  readonly onAbrirProgramas: () => void;
  readonly podeAbrirProgramas: boolean;
  /** Abre as imagens do modelo: pelo "Imagens", ou pelo "Digitalizar" (com os passos para copiar um molde de papel). */
  readonly onAbrirImagens: (como: 'imagens' | 'digitalizar') => void;
  /** As ferramentas da aba Graduação, na peça selecionada. */
  readonly onUsarFerramentaDeGraduacao: (ferramenta: FerramentaDeGraduacao) => void;
  /** A peça selecionada já tem tamanhos definidos (é graduada). */
  readonly temGraduacao: boolean;
  /** Além da peça selecionada, há outras marcadas na lista (para "Unir" os tamanhos). */
  readonly temOutrasMarcadas: boolean;
}


const SEM_PECA = 'selecione uma peça primeiro';
const SEM_PECAS = 'não há peças no projeto';
const SEM_TAMANHOS = 'defina os tamanhos primeiro, em “Tabela”';

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
  /** `icone` é o botão pequeno sem rótulo à vista: o nome fica na dica e para leitores de tela. */
  readonly tamanho: 'grande' | 'pequeno' | 'icone';
  /** O nome da ferramenta; num botão grande, um par diz onde o rótulo quebra com a fita compactada. */
  readonly rotulo: string | readonly [string, string];
  readonly icone: NomeDoIcone;
  /** A dica com a ferramenta disponível. */
  readonly dica?: string;
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
  const motivo = props.falta ?? null;
  return (
    <button
      className={`${props.tamanho === 'icone' ? 'botao-pequeno botao-so-icone' : `botao-${props.tamanho}`}${props.pressionado ? ' item-selecionado' : ''}`}
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
  // O que falta para usar uma ferramenta de graduação: uma peça selecionada, com tamanhos definidos.
  const faltaParaGraduar = !props.temSelecaoUnica ? SEM_PECA : props.temGraduacao ? null : SEM_TAMANHOS;
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
                  dica="Cor: dá uma cor de fundo às peças selecionadas, para distingui-las no desenho (o contorno continua mostrando se a peça está selecionada ou com problema)"
                  falta={props.temSelecao ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeAnotacao('cor')}
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
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Inverter moldes"
                    icone="inverter-moldes"
                    dica="Inverter moldes: inverte a seleção de moldes — aqui todo objeto é um molde, então faz o mesmo que Inverter seleção"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onInverterSelecao}
                  />
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

              <div className="grupo-de-ferramentas" role="group" aria-label="Programas">
                <Ferramenta
                  tamanho="grande"
                  rotulo="Programas"
                  icone="programas"
                  dica="Programas: atalhos para os outros programas que você usa junto com este (plotter, máquina de corte, planilhas, sites) — é você quem escolhe quais"
                  falta={props.podeAbrirProgramas ? null : 'disponível só no programa instalado, não no navegador'}
                  onClick={props.onAbrirProgramas}
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
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Por ângulo"
                    icone="por-angulo"
                    pressionado={props.modo === 'reta-por-angulo'}
                    dica="Por ângulo: desenha uma reta (linha interna da peça selecionada) com o ângulo e o comprimento digitados, a partir do ponto clicado"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('reta-por-angulo')}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Estender reta"
                    icone="estender-reta"
                    pressionado={props.modo === 'estender-reta'}
                    dica="Estender reta: faz crescer uma linha interna pela medida digitada — clique perto da ponta que deve andar"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('estender-reta')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Estender até elemento"
                    icone="estender-ate-elemento"
                    pressionado={props.modo === 'estender-ate-elemento'}
                    dica="Estender até elemento: faz crescer uma linha interna até o contorno ou até outra linha — clique perto da ponta que deve andar"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('estender-ate-elemento')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Estender duas retas"
                    icone="estender-duas-retas"
                    pressionado={props.modo === 'estender-duas-retas'}
                    dica="Estender duas retas: leva as pontas de duas linhas internas ao ponto em que elas se encontram — clique perto da ponta de cada uma"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('estender-duas-retas')}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Curvas">
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Curva"
                    icone="curva"
                    pressionado={props.modo === 'curva'}
                    dica="Curva: troca um trecho do contorno por uma curva suave — clique no contorno, onde ela começa, nos pontos por onde deve passar e, por fim, no contorno, onde termina"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoCurva}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Dividir curva"
                    icone="dividir-curva"
                    pressionado={props.modo === 'inserir-ponto'}
                    dica="Dividir curva: marca um ponto novo no contorno, onde a curva passa a poder ser dividida ou presa (aqui a curva é uma sequência de pontos; é o Inserir ponto)"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoInserirPonto}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Pré-definida"
                    icone="curva-predefinida"
                    pressionado={props.modo === 'curva-predefinida'}
                    dica="Pré-definida: escolhe uma curva do cadastro e a põe entre dois pontos do contorno, esticada ou encolhida por igual"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onAbrirCurvaPredefinida}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Espiral e curvas"
                    icone="espiral"
                    pressionado={props.modo === 'espiral'}
                    dica="Espiral: cria um molde em espiral (o do babado), dadas a largura da tira e o perímetro da borda de dentro"
                    onClick={props.onAbrirEspiral}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Cadastrar curva"
                    icone="cadastrar-curva"
                    pressionado={props.modo === 'cadastrar-curva'}
                    dica="Cadastrar curva: guarda a forma de um trecho do contorno para usar de novo em Pré-definida — clique no começo e no fim do trecho"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoCadastrarCurva}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Editar pontos de curva"
                    icone="editar-pontos-de-curva"
                    pressionado={props.modo === 'editar-pontos-de-curva'}
                    dica="Editar pontos de curva: muda quantos pontos um trecho do contorno tem — clique no começo e no fim do trecho e digite o número. Na curva ou no arco feito por ferramenta, clique num ponto de passagem (os anéis) e, depois, onde ele deve ficar: a curva é refeita por ele"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoEditarPontosDeCurva}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Pontos">
                <Ferramenta
                    tamanho="grande"
                    rotulo={['Por', 'coordenada']}
                    icone="ponto-por-coordenada"
                    dica="Ponto por coordenada: cria um ponto (uma marca da peça selecionada) nas coordenadas X e Y digitadas"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('ponto-por-coordenada')}
                  />
                <Ferramenta
                    tamanho="grande"
                    rotulo={['Por', 'interseção']}
                    icone="ponto-por-intersecao"
                    pressionado={props.modo === 'ponto-por-intersecao'}
                    dica="Ponto por interseção: cria um ponto onde se encontram as retas de dois elementos — clique em duas arestas do contorno ou linhas internas"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('ponto-por-intersecao')}
                  />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="No centro do arco"
                    icone="ponto-no-centro"
                    pressionado={props.modo === 'ponto-no-centro-do-arco'}
                    dica="Ponto no centro do arco: clique sobre um arco do contorno — o ponto fica no centro dele"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('ponto-no-centro-do-arco')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="No perímetro"
                    icone="ponto-no-perimetro"
                    pressionado={props.modo === 'ponto-no-perimetro'}
                    dica="Ponto no perímetro: cria um ponto sobre o contorno, à distância digitada do ponto clicado"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('ponto-no-perimetro')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Por distância"
                    icone="ponto-por-distancia"
                    pressionado={props.modo === 'ponto-por-distancia'}
                    dica="Ponto por distância: cria um ponto à distância digitada do primeiro ponto clicado, na direção do segundo"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('ponto-por-distancia')}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Arcos">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Por', 'raio']}
                  icone="arco-por-raio"
                  pressionado={props.modo === 'circulo'}
                  dica="Por raio: cria um molde circular — clique no centro e depois na borda; a distância entre os dois é o raio"
                  onClick={props.onEntrarModoCirculo}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco por 2 pontos"
                    icone="arco-2-pontos"
                    pressionado={props.modo === 'arco-2-pontos'}
                    dica="Arco por 2 pontos: troca um trecho do contorno por um arco de círculo — clique nos dois pontos do contorno e depois por onde o arco deve passar"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoArco2Pontos}
                  />
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco por 3 pontos"
                    icone="arco-3-pontos"
                    pressionado={props.modo === 'arco-3-pontos'}
                    dica="Arco por 3 pontos: troca um trecho do contorno por um arco de círculo — clique no contorno, depois por onde o arco deve passar e, por fim, no contorno de novo"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoArco3Pontos}
                  />
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco tangente à reta ou arco"
                    icone="arco-tangente-reta"
                    pressionado={props.modo === 'arco-tangente-a-elemento'}
                    dica="Arco tangente à reta ou arco: troca um trecho do contorno por um arco que sai do primeiro ponto dando continuidade à reta ou ao arco vizinho — clique no contorno, onde o arco começa e onde termina"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeArco('arco-tangente-a-elemento')}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco tangente a 2 retas"
                    icone="arco-tangente-2-retas"
                    pressionado={props.modo === 'arco-tangente'}
                    dica="Arco tangente a 2 retas, dado o raio: clique num canto da peça selecionada e digite o raio — o canto vira um arco tangente às duas arestas"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={props.onEntrarModoArcoTangente}
                  />
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco tangente a arco e reta"
                    icone="arco-tangente-arco-reta"
                    pressionado={props.modo === 'arco-tangente-arco-reta'}
                    dica="Arco tangente a arco e reta, dado o raio: clique num canto em que um arco encontra uma reta e digite o raio — o canto vira um arco tangente aos dois"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeArco('arco-tangente-arco-reta')}
                  />
                  <Ferramenta
                    tamanho="icone"
                    rotulo="Arco tangente a 2 arcos"
                    icone="arco-tangente-2-arcos"
                    pressionado={props.modo === 'arco-tangente-2-arcos'}
                    dica="Arco tangente a 2 arcos, dado o raio: clique num canto em que dois arcos se encontram e digite o raio — o canto vira um arco tangente aos dois"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeArco('arco-tangente-2-arcos')}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Texto">
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Inserir texto"
                    icone="inserir-texto"
                    pressionado={props.modo === 'inserir-texto'}
                    dica="Inserir texto: escreve um texto sobre a peça selecionada — digite o texto e a altura das letras, e clique onde ele deve ficar"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeAnotacao('inserir-texto')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Editar texto"
                    icone="editar-texto"
                    pressionado={props.modo === 'editar-texto'}
                    dica="Editar texto: clique num texto da peça selecionada para mudar o que está escrito ou a altura — ou para apagá-lo, deixando o texto em branco"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeAnotacao('editar-texto')}
                  />
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
                    pressionado={props.modo === 'extrair-molde'}
                    dica="Extrair molde: cria uma peça nova com a região da peça selecionada delimitada pelas linhas internas — clique dentro da região"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeElemento('extrair-molde')}
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
                    pressionado={props.modo === 'calibrar-imagem'}
                    dica="Digitalizar: copia um molde de papel a partir de uma foto ou de um escaneado — a imagem entra por baixo do desenho, você calibra a escala com uma medida conhecida e contorna o molde"
                    onClick={() => props.onAbrirImagens('digitalizar')}
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
                  pressionado={props.modo === 'linha-de-simetria'}
                  dica="Linha de simetria: marca a aresta em que a peça é dobrada (a peça desenhada é meia peça) — clique na aresta; de novo, tira a marca. No encaixe automático, a peça pode entrar aberta"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeAnotacao('linha-de-simetria')}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Bainha"
                    icone="bainha"
                    pressionado={props.modo === 'bainha'}
                    dica="Bainha: acrescenta a sobra que se dobra para dentro num trecho do contorno — escolha o número de dobras e a largura, e indique no contorno onde a bainha começa e onde termina"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('bainha')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Dobrar"
                    icone="dobrar"
                    pressionado={props.modo === 'dobrar'}
                    dica="Dobrar: deixa só uma metade da peça, com a linha de dobra virando uma aresta — na horizontal, na vertical, numa linha interna ou por dois pontos do contorno. “Manter dobra do molde” guarda a outra metade como ela é, para a peça que não é simétrica"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('dobrar')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Desdobrar"
                    icone="desdobrar"
                    pressionado={props.modo === 'desdobrar'}
                    dica="Desdobrar: a peça volta a ser inteira — clique na aresta que é a linha de dobra. Entra a outra metade espelhada ou, se ela foi guardada com “Manter dobra do molde”, como era. A dobra fica como linha interna"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('desdobrar')}
                  />
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
                    dica="Converter em contorno: a linha de corte (o contorno com a costura) passa a ser o contorno da peça, e a costura volta a zero"
                    falta={!props.temSelecao ? SEM_PECA : props.podeRemoverCostura ? null : 'a seleção não tem costura para converter'}
                    onClick={props.onConverterEmContorno}
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
                <Ferramenta
                  tamanho="grande"
                  rotulo="Pregas"
                  icone="pregas"
                  pressionado={props.modo === 'pregas'}
                  dica="Pregas: abre a peça numa linha — dois pontos do contorno, ou uma linha interna reta —, com o tecido que a prega consome: simples ou dupla, uma ou várias, com as linhas de dobra desenhadas. Um clique dentro de uma prega já feita muda as larguras dela ou a tira"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeMolde('pregas')}
                />
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Pence no', 'contorno']}
                  icone="pence-no-contorno"
                  pressionado={props.modo === 'pence-no-contorno'}
                  dica="Pence no contorno: cria uma pence com a abertura e a profundidade pedidas — recortada (o contorno entra por ela), marcada (só desenhada) ou aberta em torno de um pivô, com acabamento ou não. Um clique numa pence que já está na peça muda as medidas dela"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeMolde('pence-no-contorno')}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Pence interna"
                    icone="pence-interna"
                    pressionado={props.modo === 'pence-interna'}
                    dica="Pence interna: desenha uma pence em losango dentro da peça, com duas alturas, a largura e o ângulo em relação à linha de fio"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('pence-interna')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Fechar pence"
                    icone="fechar-pence"
                    pressionado={props.modo === 'fechar-pence'}
                    dica="Fechar pence: fecha uma pence recortada — girando um lado da peça em torno de um pivô, ou só o recorte, deixando a pence marcada"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('fechar-pence')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Transferir pence"
                    icone="transferir-pence"
                    pressionado={props.modo === 'transferir-pence'}
                    dica="Transferir pence: leva uma pence recortada para outro lugar do contorno, com o mesmo vértice e o mesmo ângulo — clique no vértice da pence e depois na nova posição. A área da peça não muda"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('transferir-pence')}
                  />
                </div>
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Múltiplas', 'pences']}
                  icone="multiplas-pences"
                  pressionado={props.modo === 'multiplas-pences'}
                  dica="Múltiplas pences: cria várias pences iguais de uma vez, espaçadas ao longo do contorno (o manual da referência não descreve esta ferramenta; esta é a leitura natural)"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeMolde('multiplas-pences')}
                />
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Cortar e Unir">
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Cortar"
                    icone="cortar-molde"
                    pressionado={props.modo === 'cortar'}
                    dica="Cortar: divide a peça selecionada em duas por uma reta — dois pontos do contorno, ou uma linha interna reta dela —, com costura na borda do corte, se quiser. A parte maior continua sendo a peça; a outra vira uma peça nova"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('cortar')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Unir"
                    icone="unir-moldes"
                    pressionado={props.modo === 'unir'}
                    dica="Unir: junta outra peça à selecionada, aresta com aresta — clique na aresta da peça selecionada e depois na aresta da outra, que gira e encosta. Com “Apenas mover”, a outra só encosta, sem unir"
                    falta={!props.temSelecaoUnica ? SEM_PECA : props.temOutraPeca ? null : 'é preciso ter outra peça para unir a esta'}
                    onClick={() => props.onUsarFerramentaDeMolde('unir')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Remover região"
                    icone="remover-regiao"
                    pressionado={props.modo === 'remover-regiao'}
                    dica="Remover região: tira um pedaço da peça selecionada, de um lado de uma reta — ou a faixa entre duas retas, unindo as duas partes que sobram. A região tirada pode virar uma peça nova"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeMolde('remover-regiao')}
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
                <Ferramenta
                  tamanho="grande"
                  rotulo="Tabela"
                  icone="tabela-de-graduacao"
                  pressionado={props.modo === 'graduar-tabela'}
                  dica="Tabela: define os tamanhos da peça selecionada e, clicando num ponto do contorno, o quanto ele anda (DX e DY) em cada tamanho"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={() => props.onUsarFerramentaDeGraduacao('graduar-tabela')}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Automático"
                    icone="graduar-automatico"
                    pressionado={props.modo === 'graduar-automatico'}
                    dica="Automático: dá aos pontos clicados a mesma diferença de DX e de DY de um tamanho para o seguinte"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('graduar-automatico')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Mouse"
                    icone="graduar-mouse"
                    pressionado={props.modo === 'graduar-mouse'}
                    dica="Mouse: clique num ponto e depois onde ele deve ficar no tamanho da ponta — os outros tamanhos vão por passos iguais"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('graduar-mouse')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Tangente"
                    icone="graduar-tangente"
                    pressionado={props.modo === 'graduar-tangente'}
                    dica="Tangente: os pontos clicados andam uma distância por tamanho na direção da própria aresta"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('graduar-tangente')}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Regras"
                    icone="regras"
                    pressionado={props.modo === 'graduar-regras'}
                    dica="Regras: escolhe uma regra de graduação guardada e a aplica aos pontos clicados"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('graduar-regras')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Criar regra"
                    icone="criar-regra"
                    pressionado={props.modo === 'criar-regra'}
                    dica="Criar regra: guarda a graduação de um ponto, com um nome, para usar em outros pontos e em outras peças"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('criar-regra')}
                  />
                </div>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Manipular graduação">
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Remover', 'graduação']}
                  icone="remover-graduacao"
                  pressionado={props.modo === 'remover-graduacao'}
                  dica="Remover graduação: apaga o DX, o DY ou os dois dos pontos clicados — ou do molde inteiro, que volta a ser uma peça de um tamanho só"
                  falta={faltaParaGraduar}
                  onClick={() => props.onUsarFerramentaDeGraduacao('remover-graduacao')}
                />
                <Ferramenta
                  tamanho="grande"
                  rotulo="Separar"
                  icone="separar-graduacao"
                  pressionado={props.modo === 'separar-tamanhos'}
                  dica="Separar: cria uma peça própria para o tamanho clicado no desenho (ou para todos), onde for indicado com o mouse ou em fila depois das outras — é assim que os tamanhos vão para o encaixe"
                  falta={faltaParaGraduar}
                  onClick={() => props.onUsarFerramentaDeGraduacao('separar-tamanhos')}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Unir"
                    icone="unir-graduacao"
                    dica="Unir: junta peças de tamanhos diferentes numa peça graduada — a selecionada é o base, e as marcadas na lista viram os outros tamanhos (mesmos pontos, na mesma ordem, e um tamanho diferente em cada uma)"
                    falta={!props.temSelecaoUnica ? SEM_PECA : props.temOutrasMarcadas ? null : 'marque na lista as peças dos outros tamanhos'}
                    onClick={() => props.onUsarFerramentaDeGraduacao('unir-tamanhos')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Agrupar"
                    icone="agrupar-graduacao"
                    pressionado={props.modo === 'agrupar-graduacao'}
                    dica="Agrupar: organiza os tamanhos a partir de um ponto de referência — empilhados nele (agrupados) ou afastados uns dos outros pela distância que você der (desagrupados); a forma de cada tamanho não muda"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('agrupar-graduacao')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Deduzir"
                    icone="deduzir-graduacao"
                    pressionado={props.modo === 'deduzir-graduacao'}
                    dica="Deduzir: desconta de todos os pontos a graduação do ponto clicado — ele passa a ser o ponto fixo, onde os tamanhos ficam empilhados. É o mesmo que “Agrupar” com a distância zero (o manual da referência não descreve esta ferramenta; esta é a leitura natural)"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('deduzir-graduacao')}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Copiar graduação"
                    icone="copiar-graduacao"
                    pressionado={props.modo === 'copiar-graduacao'}
                    dica="Copiar graduação: leva a regra de um ponto para outros — o DX, o DY ou os dois, com o sinal invertido se pedido"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('copiar-graduacao')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Ajustar"
                    icone="ajustar-graduacao"
                    pressionado={props.modo === 'ajustar-graduacao'}
                    dica="Ajustar: ajusta a graduação de pontos em relação a outros dois — clique no ponto inicial, nos pontos a ajustar e no ponto final; os do meio passam a andar na proporção entre o inicial e o final (só DX, só DY ou os dois)"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('ajustar-graduacao')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Graduar curva"
                    icone="graduar-curva"
                    pressionado={props.modo === 'graduar-curva'}
                    dica="Graduar curva: torna graduado um ponto que andava na proporção dos vizinhos (um ponto de curva), ou devolve um ponto graduado à proporção (no manual da referência é “Adicionar ou remover ponto de curva graduado”)"
                    falta={faltaParaGraduar}
                    onClick={() => props.onUsarFerramentaDeGraduacao('graduar-curva')}
                  />
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
                  <button
                    aria-pressed={props.modo === 'mover-ponto-de-construcao'}
                    className={`botao-pequeno${props.modo === 'mover-ponto-de-construcao' ? ' item-selecionado' : ''}`}
                    onClick={() => props.onUsarFerramentaDeElemento('mover-ponto-de-construcao')}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Manipular pontos: move um ponto (marca) da peça selecionada — clique nele e depois onde ele deve ficar' : semPecaSelecionada('Manipular pontos')}
                  >
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
                  <button
                    aria-pressed={props.modo === 'manipulacao-rapida'}
                    className={`botao-pequeno${props.modo === 'manipulacao-rapida' ? ' item-selecionado' : ''}`}
                    onClick={() => props.onUsarFerramentaDeElemento('manipulacao-rapida')}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Manipulação rápida: move ou apaga uma linha interna ou um ponto (marca) — clique no elemento e depois onde ele deve ficar, ou tecle Delete' : semPecaSelecionada('Manipulação rápida')}
                  >
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
                  <button
                    aria-pressed={props.modo === 'dividir-linha'}
                    className={`botao-pequeno${props.modo === 'dividir-linha' ? ' item-selecionado' : ''}`}
                    onClick={() => props.onUsarFerramentaDeElemento('dividir-linha')}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Dividir elementos: divide uma linha interna em duas, no ponto clicado' : semPecaSelecionada('Dividir elementos')}
                  >
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
                <Ferramenta
                  tamanho="grande"
                  rotulo={['Definir', 'curva']}
                  icone="curva"
                  pressionado={props.modo === 'curva'}
                  dica="Definir curva: troca um trecho do contorno por uma curva suave (a mesma ferramenta de Construção > Curva)"
                  falta={props.temSelecaoUnica ? null : SEM_PECA}
                  onClick={props.onEntrarModoCurva}
                />
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
                  <button
                    aria-pressed={props.modo === 'transformar-em-elementos'}
                    className={`botao-pequeno${props.modo === 'transformar-em-elementos' ? ' item-selecionado' : ''}`}
                    onClick={() => props.onUsarFerramentaDeElemento('transformar-em-elementos')}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Transformar em elementos: o contorno de outra peça entra na peça selecionada como linha interna — clique na outra peça' : semPecaSelecionada('Transformar em elementos')}
                  >
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
                  <button
                    aria-pressed={props.modo === 'copiar-elemento'}
                    className={`botao-pequeno${props.modo === 'copiar-elemento' ? ' item-selecionado' : ''}`}
                    onClick={() => props.onUsarFerramentaDeElemento('copiar-elemento')}
                    disabled={!props.temSelecaoUnica}
                    title={props.temSelecaoUnica ? 'Copiar ou trocar elemento: traz para a peça selecionada uma linha interna ou um ponto (marca) de outra peça' : semPecaSelecionada('Copiar ou trocar elemento')}
                  >
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
                  pressionado={props.modo === 'conferir'}
                  dica="Conferir: confere duas costuras que vão ser unidas — indique uma em cada peça (o começo e o fim), e a segunda peça anda sobre a primeira, como na costura; a faixa diz se conferem ou quanto uma sobra, e um clique marca o ponto de encontro nas duas"
                  falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                  onClick={() => props.onUsarFerramentaDeAnotacao('conferir')}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Cota perímetro"
                    icone="cota-perimetro"
                    pressionado={props.modo === 'cota-perimetro'}
                    dica="Cota perímetro: clique dentro de uma peça para deixar o perímetro dela escrito no desenho — a cota anda com a peça e acompanha as mudanças dela"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCotaPerimetro}
                  />
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
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Cota distância"
                    icone="cota-distancia"
                    pressionado={props.modo === 'cota-distancia'}
                    dica="Cota distância: clique em dois pontos de uma peça e depois onde a linha de cota deve ficar — a cota fica presa à peça e anda com ela"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCotaDistancia}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Distância"
                    icone="distancia"
                    pressionado={props.modo === 'medir-distancia'}
                    dica="Distância: clique em dois pontos para ver a distância, a horizontal, a vertical e o ângulo entre eles — perto de um vértice, o clique cai exatamente nele"
                    onClick={props.onEntrarModoMedirDistancia}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Comparar distância"
                    icone="comparar-distancia"
                    pressionado={props.modo === 'comparar-distancias'}
                    dica="Comparar distância: meça duas distâncias (dois pontos cada) e veja a diferença entre elas"
                    onClick={props.onEntrarModoCompararDistancias}
                  />
                </div>
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Horizontal / Vertical"
                    icone="cota-horizontal-vertical"
                    pressionado={props.modo === 'cota-horizontal-vertical'}
                    dica="Horizontal / Vertical: cota da distância só na horizontal ou só na vertical entre dois pontos de uma peça — depois dos pontos, clique acima ou abaixo deles para a horizontal, ou ao lado para a vertical"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCotaHorizontalVertical}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Ângulo"
                    icone="angulo"
                    pressionado={props.modo === 'cota-angulo'}
                    dica="Ângulo: cota do ângulo entre dois lados — clique num ponto de um lado, no vértice, num ponto do outro lado e onde o arco deve ficar"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCotaAngulo}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Raio"
                    icone="raio"
                    pressionado={props.modo === 'cota-raio'}
                    dica="Raio: cota do raio de um arco do contorno — clique sobre o arco (vale para arcos, cantos arredondados e círculos)"
                    falta={props.podeSelecionarTudo ? null : SEM_PECAS}
                    onClick={props.onEntrarModoCotaRaio}
                  />
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
                    dica="Autor: guarda no projeto o nome de quem fez o modelo"
                    onClick={() => props.onUsarFerramentaDeAnotacao('autor')}
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
                <Ferramenta
                  tamanho="grande"
                  rotulo="Variantes"
                  icone="variantes"
                  dica="Variantes: cópias deste projeto para testar outra versão do mesmo trabalho (outras quantidades, outro tecido, outro encaixe), guardadas na Biblioteca"
                  onClick={props.onAbrirVariantes}
                />
                <div className="coluna-de-ferramenta">
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Relacionamento piques"
                    icone="relacionamento-piques"
                    pressionado={props.modo === 'relacionar-piques'}
                    dica="Relacionamento piques: dá um código a um pique da peça selecionada — piques de peças diferentes com o mesmo código são os que se encontram na costura"
                    falta={props.temSelecaoUnica ? null : SEM_PECA}
                    onClick={() => props.onUsarFerramentaDeAnotacao('relacionar-piques')}
                  />
                  <Ferramenta
                    tamanho="pequeno"
                    rotulo="Imagens"
                    icone="imagens"
                    dica="Imagens: guarda no projeto fotos e desenhos do modelo e mostra-os por baixo das peças, na opacidade que você escolher"
                    onClick={() => props.onAbrirImagens('imagens')}
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
            A peça desenhada é o tamanho base. &ldquo;Tabela&rdquo; define os tamanhos e a regra de cada ponto; o encaixe usa só o
            base, e &ldquo;Separar&rdquo; cria as peças dos outros tamanhos.
          </p>
        )}
      </div>
    </div>
  );
}
