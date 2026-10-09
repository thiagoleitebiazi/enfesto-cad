import { useLayoutEffect, useRef, useState } from 'react';
import type { ModoDeDesenho } from './AreaDeDesenho';
import { ajustarCompactacao } from './compactacaoDaFita';
import { Icone } from './Icone';
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
}

const NAO_IMPLEMENTADO_CURVA = 'Ainda não implementado — contornos com curvas Bézier (apenas segmentos retos por enquanto)';
const SO_PARA_ELEMENTOS =
  'indisponível neste programa: trabalha sobre elementos de modelagem (linhas soltas), e aqui só existem peças fechadas';
const NAO_CONFIRMADO = 'ainda não disponível: o comportamento exato desta ferramenta ainda não foi confirmado';

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

type Aba = 'arquivo' | 'edicao' | 'desenho' | 'marcacoes' | 'manipulacao' | 'encaixe';

const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: 'arquivo', rotulo: 'Arquivo' },
  { id: 'edicao', rotulo: 'Edição' },
  { id: 'desenho', rotulo: 'Construção' },
  { id: 'marcacoes', rotulo: 'Marcações' },
  { id: 'manipulacao', rotulo: 'Manipulação' },
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
 * Na aba Manipulação, as ferramentas de programas de modelagem que agem
 * sobre elementos soltos (linhas que ainda não formam peça) aparecem no
 * lugar de costume, mas desabilitadas e com a explicação na dica — aqui só
 * existem peças fechadas. Cada botão tem ícone + rótulo, com ícones
 * desenhados para este projeto — sem copiar o conjunto de ícones de nenhum
 * software de referência. Em janela estreita a fita se compacta em vez de
 * quebrar linha (compactacaoDaFita).
 */
export function BarraDeFerramentas(props: BarraDeFerramentasProps): React.JSX.Element {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('desenho');
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

          {abaAtiva === 'edicao' && (
            <div className="grupo-de-ferramentas" role="group" aria-label="Edição">
              <button onClick={props.onDesfazer} disabled={!props.podeDesfazer} title="Desfazer (Ctrl+Z)">
                <Icone nome="desfazer" />
                <span>Desfazer</span>
              </button>
              <button onClick={props.onRefazer} disabled={!props.podeRefazer} title="Refazer (Ctrl+Y)">
                <Icone nome="refazer" />
                <span>Refazer</span>
              </button>
              <button onClick={props.onCopiar} disabled={!props.temSelecaoUnica} title="Copiar (Ctrl+C) — uma peça por vez">
                <Icone nome="copiar" />
                <span>Copiar</span>
              </button>
              <button onClick={props.onColar} disabled={!props.podeColar} title="Colar (Ctrl+V)">
                <Icone nome="colar" />
                <span>Colar</span>
              </button>
              <button onClick={props.onRecortar} disabled={!props.temSelecaoUnica} title="Recortar (Ctrl+X) — uma peça por vez">
                <Icone nome="recortar" />
                <span>Recortar</span>
              </button>
              <button onClick={props.onDuplicar} disabled={!props.temSelecao} title="Duplicar (Ctrl+D)">
                <Icone nome="duplicar" />
                <span>Duplicar</span>
              </button>
              <button onClick={props.onExcluir} disabled={!props.temSelecao} title="Excluir (Delete)">
                <Icone nome="excluir" />
                <span>Excluir</span>
              </button>
              <button onClick={props.onSelecionarTudo} disabled={!props.podeSelecionarTudo} title="Selecionar tudo (Ctrl+A)">
                <Icone nome="selecionar-tudo" />
                <span>Selecionar tudo</span>
              </button>
            </div>
          )}

          {abaAtiva === 'desenho' && (
            <div className="grupo-de-ferramentas" role="group" aria-label="Construção">
              <button
                aria-pressed={props.modo === 'selecionar'}
                className={props.modo === 'selecionar' ? 'item-selecionado' : ''}
                onClick={props.onEntrarModoSelecionar}
                title="Selecionar objetos (Esc)"
              >
                <Icone nome="selecionar" />
                <span>Selecionar</span>
              </button>
              <button
                aria-pressed={props.modo === 'novo-molde'}
                className={props.modo === 'novo-molde' ? 'item-selecionado' : ''}
                onClick={props.onEntrarModoNovoMolde}
                title="Novo molde: clique para adicionar pontos do contorno, Enter para fechar"
              >
                <Icone nome="novo-molde" />
                <span>Novo Molde</span>
              </button>
              <button disabled title={NAO_IMPLEMENTADO_CURVA}>
                <Icone nome="curva" />
                <span>Curva</span>
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
            </div>
          )}

          {abaAtiva === 'manipulacao' && (
            <>
              <div className="grupo-de-ferramentas" role="group" aria-label="Redefinir">
                <button className="botao-grande" disabled title={`Modificar — ${NAO_CONFIRMADO}`}>
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
                  <button className="botao-pequeno" disabled title={`Redefinir perímetro — ${NAO_CONFIRMADO}`}>
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
                    title="Copiar: duplica a peça selecionada (mesmo que Duplicar na aba Edição)"
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
      </div>
    </div>
  );
}
