import { useState } from 'react';
import type { ModoDeDesenho } from './AreaDeDesenho';
import { Icone } from './Icone';

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
  readonly onEntrarModoSelecionar: () => void;
  readonly onEntrarModoNovoMolde: () => void;
  readonly onEntrarModoNovoFuro: () => void;
  readonly onEntrarModoPique: () => void;
  readonly onEntrarModoMarca: () => void;
  readonly onImportarDxf: () => void;
  readonly onAbrirTecido: () => void;
  readonly onAbrirEnfesto: () => void;
  readonly onSugerirPosicao: () => void;
  readonly podeSugerirPosicao: boolean;
  readonly onNestingAutomatico: () => void;
  readonly podeExecutarNesting: boolean;
  readonly onEntrarModoMoverPonto: () => void;
  readonly onEntrarModoInserirPonto: () => void;
  readonly onEntrarModoExcluirPonto: () => void;
  readonly onEntrarModoChanfrarCanto: () => void;
  readonly onEntrarModoArredondarCanto: () => void;
  readonly onAbrirDimensionar: () => void;
  readonly onEspelharManual: () => void;
  readonly onGirarLivre: () => void;
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

type Aba = 'arquivo' | 'edicao' | 'desenho' | 'manipulacao' | 'encaixe';

const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: 'arquivo', rotulo: 'Arquivo' },
  { id: 'edicao', rotulo: 'Edição' },
  { id: 'desenho', rotulo: 'Desenho' },
  { id: 'manipulacao', rotulo: 'Manipulação' },
  { id: 'encaixe', rotulo: 'Encaixe' },
];

/**
 * Barra de ferramentas em abas (estilo ribbon) — reorganiza os mesmos
 * grupos/ações que já existiam em linha única numa barra com abas
 * clicáveis, para caber mais ferramentas sem exigir rolagem horizontal
 * numa tela comum. "Visualização" fica fora do sistema de abas (sempre
 * visível à direita) porque zoom é uma necessidade constante,
 * independente da aba/tarefa atual — mesmo padrão de programas de
 * desenho com barra de abas (a visualização nunca fica "escondida" atrás
 * de uma aba). Cada botão tem ícone + rótulo (acabamento de ribbon
 * profissional), com ícones desenhados para este projeto — sem copiar o
 * conjunto de ícones de nenhum software de referência.
 */
export function BarraDeFerramentas(props: BarraDeFerramentasProps): React.JSX.Element {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('desenho');

  return (
    <div className="barra-de-ferramentas-ribbon" role="toolbar" aria-label="Barra de ferramentas principal">
      <div className="ribbon-abas" role="tablist" aria-label="Categorias de ferramentas">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            role="tab"
            aria-selected={abaAtiva === aba.id}
            className={abaAtiva === aba.id ? 'ribbon-aba ribbon-aba-ativa' : 'ribbon-aba'}
            onClick={() => setAbaAtiva(aba.id)}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      <div className="ribbon-conteudo">
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
            <div className="grupo-de-ferramentas" role="group" aria-label="Desenho">
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
              <div className="grupo-de-ferramentas" role="group" aria-label="Pontos">
                <button
                  aria-pressed={props.modo === 'mover-ponto'}
                  className={props.modo === 'mover-ponto' ? 'item-selecionado' : ''}
                  onClick={props.onEntrarModoMoverPonto}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Mover ponto: arraste um vértice da peça selecionada' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="mover-ponto" />
                  <span>Mover ponto</span>
                </button>
                <button
                  aria-pressed={props.modo === 'inserir-ponto'}
                  className={props.modo === 'inserir-ponto' ? 'item-selecionado' : ''}
                  onClick={props.onEntrarModoInserirPonto}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Inserir ponto: clique numa aresta da peça selecionada' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="inserir-ponto" />
                  <span>Inserir ponto</span>
                </button>
                <button
                  aria-pressed={props.modo === 'excluir-ponto'}
                  className={props.modo === 'excluir-ponto' ? 'item-selecionado' : ''}
                  onClick={props.onEntrarModoExcluirPonto}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Excluir ponto: clique num vértice da peça selecionada' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="excluir-ponto" />
                  <span>Excluir ponto</span>
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Transformar">
                <button
                  onClick={props.onAbrirDimensionar}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Dimensionar: escala a peça por fatores X/Y independentes' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="dimensionar" />
                  <span>Dimensionar</span>
                </button>
                <button
                  onClick={props.onEspelharManual}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Espelhar: inverte a peça horizontalmente (ação manual, uma vez)' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="espelhar" />
                  <span>Espelhar</span>
                </button>
                <button
                  onClick={props.onGirarLivre}
                  disabled={!props.temSelecaoUnica}
                  title={
                    props.temSelecaoUnica
                      ? 'Girar em ângulo livre: redefine a orientação de referência da peça (diferente dos botões 90°/180°/270°, que respeitam o sentido do fio)'
                      : 'Selecione uma peça primeiro'
                  }
                >
                  <Icone nome="girar" />
                  <span>Girar (ângulo livre)</span>
                </button>
              </div>

              <div className="grupo-de-ferramentas" role="group" aria-label="Organizar">
                <button
                  onClick={props.onAlinhar}
                  disabled={!props.podeAlinhar}
                  title={props.podeAlinhar ? 'Alinha as peças selecionadas pela borda esquerda' : 'Selecione 2 ou mais peças (Ctrl+A ou clique múltiplo na lista)'}
                >
                  <Icone nome="alinhar" />
                  <span>Alinhar</span>
                </button>
                <button
                  aria-pressed={props.modo === 'chanfrar-canto'}
                  className={props.modo === 'chanfrar-canto' ? 'item-selecionado' : ''}
                  onClick={props.onEntrarModoChanfrarCanto}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Chanfrar canto: clique num vértice da peça selecionada' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="chanfrar" />
                  <span>Chanfrar canto</span>
                </button>
                <button
                  aria-pressed={props.modo === 'arredondar-canto'}
                  className={props.modo === 'arredondar-canto' ? 'item-selecionado' : ''}
                  onClick={props.onEntrarModoArredondarCanto}
                  disabled={!props.temSelecaoUnica}
                  title={props.temSelecaoUnica ? 'Arredondar canto: clique num vértice da peça selecionada' : 'Selecione uma peça primeiro'}
                >
                  <Icone nome="arredondar" />
                  <span>Arredondar canto</span>
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

        <div className="grupo-de-ferramentas ribbon-visualizacao" role="group" aria-label="Visualização">
          <button onClick={props.onZoomOut} title="Diminuir zoom (-)">
            <Icone nome="zoom-out" />
            <span>Menos</span>
          </button>
          <button onClick={props.onZoomIn} title="Aumentar zoom (+)">
            <Icone nome="zoom-in" />
            <span>Mais</span>
          </button>
          <button onClick={props.onAjustarTela} title="Ajustar à tela (Ctrl+0)">
            <Icone nome="ajustar" />
            <span>Ajustar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
