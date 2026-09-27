interface BarraDeFerramentasProps {
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
}

const NAO_IMPLEMENTADO_ARQUIVO = 'Ainda não implementado — biblioteca de projetos (Etapa 9 do plano)';
const NAO_IMPLEMENTADO_DESENHO = 'Ainda não implementado — edição de contorno/pontos/curvas (Etapa 3)';
const NAO_IMPLEMENTADO_IO = 'Ainda não implementado — importação/exportação (Etapas 3 e 8)';
const NAO_IMPLEMENTADO_CONFIG = 'Ainda não implementado — tecido e enfesto (Etapa 4)';
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
        <button aria-pressed="true" title="Selecionar objetos (ferramenta ativa)">
          Selecionar
        </button>
        <button disabled title={NAO_IMPLEMENTADO_DESENHO}>Linha</button>
        <button disabled title={NAO_IMPLEMENTADO_DESENHO}>Curva</button>
        <button disabled title={NAO_IMPLEMENTADO_DESENHO}>Piques/Furos</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Importação e exportação">
        <button disabled title={NAO_IMPLEMENTADO_IO}>Importar DXF</button>
        <button disabled title={NAO_IMPLEMENTADO_IO}>Exportar PDF</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Configuração">
        <button disabled title={NAO_IMPLEMENTADO_CONFIG}>Tecido</button>
        <button disabled title={NAO_IMPLEMENTADO_CONFIG}>Enfesto</button>
      </div>

      <div className="grupo-de-ferramentas" role="group" aria-label="Visualização">
        <button onClick={props.onZoomOut} title="Diminuir zoom (-)">−</button>
        <button onClick={props.onZoomIn} title="Aumentar zoom (+)">+</button>
        <button onClick={props.onAjustarTela} title="Ajustar à tela (Ctrl+0)">Ajustar</button>
      </div>
    </div>
  );
}
