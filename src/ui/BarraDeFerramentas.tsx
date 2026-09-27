import type { ModoDeDesenho } from './AreaDeDesenho';

interface BarraDeFerramentasProps {
  readonly modo: ModoDeDesenho;
  readonly podeDesfazer: boolean;
  readonly podeRefazer: boolean;
  readonly temSelecao: boolean;
  readonly onNovoProjeto: () => void;
  readonly onDesfazer: () => void;
  readonly onRefazer: () => void;
  readonly onDuplicar: () => void;
  readonly onExcluir: () => void;
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
}

const NAO_IMPLEMENTADO_ARQUIVO = 'Ainda não implementado — biblioteca de projetos (Etapa 9 do plano)';
const NAO_IMPLEMENTADO_CURVA = 'Ainda não implementado — contornos com curvas Bézier (apenas segmentos retos por enquanto)';
const NAO_IMPLEMENTADO_EXPORTAR = 'Ainda não implementado — exportação de PDF vetorial (Etapa 8)';
const NAO_IMPLEMENTADO_COPIAR = 'Ainda não implementado — copiar/colar (use Duplicar por enquanto)';

export function BarraDeFerramentas(props: BarraDeFerramentasProps): React.JSX.Element {
  return (
    <div className="barra-de-ferramentas" role="toolbar" aria-label="Barra de ferramentas principal">
      <div className="grupo-de-ferramentas" role="group" aria-label="Arquivo">
        <button onClick={props.onNovoProjeto}>Novo</button>
        <button disabled title={NAO_IMPLEMENTADO_ARQUIVO}>Abrir</button>
        <button disabled title={NAO_IMPLEMENTADO_ARQUIVO}>Salvar</button>
        <button disabled title={NAO_IMPLEMENTADO_ARQUIVO}>Salvar como</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Edição">
        <button onClick={props.onDesfazer} disabled={!props.podeDesfazer} title="Desfazer (Ctrl+Z)">
          Desfazer
        </button>
        <button onClick={props.onRefazer} disabled={!props.podeRefazer} title="Refazer (Ctrl+Y)">
          Refazer
        </button>
        <button disabled title={NAO_IMPLEMENTADO_COPIAR}>Copiar</button>
        <button disabled title={NAO_IMPLEMENTADO_COPIAR}>Colar</button>
        <button onClick={props.onDuplicar} disabled={!props.temSelecao} title="Duplicar (Ctrl+D)">
          Duplicar
        </button>
        <button onClick={props.onExcluir} disabled={!props.temSelecao} title="Excluir (Delete)">
          Excluir
        </button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Desenho">
        <button
          aria-pressed={props.modo === 'selecionar'}
          className={props.modo === 'selecionar' ? 'item-selecionado' : ''}
          onClick={props.onEntrarModoSelecionar}
          title="Selecionar objetos (Esc)"
        >
          Selecionar
        </button>
        <button
          aria-pressed={props.modo === 'novo-molde'}
          className={props.modo === 'novo-molde' ? 'item-selecionado' : ''}
          onClick={props.onEntrarModoNovoMolde}
          title="Novo molde: clique para adicionar pontos do contorno, Enter para fechar"
        >
          Novo Molde
        </button>
        <button disabled title={NAO_IMPLEMENTADO_CURVA}>Curva</button>
        <button
          aria-pressed={props.modo === 'novo-furo'}
          className={props.modo === 'novo-furo' ? 'item-selecionado' : ''}
          onClick={props.onEntrarModoNovoFuro}
          disabled={!props.temSelecao}
          title={props.temSelecao ? 'Novo furo na peça selecionada: clique os pontos, Enter para fechar' : 'Selecione uma peça primeiro'}
        >
          Furo
        </button>
        <button
          aria-pressed={props.modo === 'pique'}
          className={props.modo === 'pique' ? 'item-selecionado' : ''}
          onClick={props.onEntrarModoPique}
          disabled={!props.temSelecao}
          title={props.temSelecao ? 'Adicionar pique: clique perto da borda da peça selecionada' : 'Selecione uma peça primeiro'}
        >
          Pique
        </button>
        <button
          aria-pressed={props.modo === 'marca'}
          className={props.modo === 'marca' ? 'item-selecionado' : ''}
          onClick={props.onEntrarModoMarca}
          disabled={!props.temSelecao}
          title={props.temSelecao ? 'Adicionar marca de referência na peça selecionada' : 'Selecione uma peça primeiro'}
        >
          Marca
        </button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Importação e exportação">
        <button onClick={props.onImportarDxf} title="Importar peças de um arquivo DXF">
          Importar DXF
        </button>
        <button disabled title={NAO_IMPLEMENTADO_EXPORTAR}>Exportar PDF</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Configuração">
        <button onClick={props.onAbrirTecido} title="Configurar o tecido do projeto">Tecido</button>
        <button onClick={props.onAbrirEnfesto} title="Configurar o tipo e os parâmetros do enfesto">Enfesto</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Visualização">
        <button onClick={props.onZoomOut} title="Diminuir zoom (-)">−</button>
        <button onClick={props.onZoomIn} title="Aumentar zoom (+)">+</button>
        <button onClick={props.onAjustarTela} title="Ajustar à tela (Ctrl+0)">Ajustar</button>
      </div>
    </div>
  );
}
