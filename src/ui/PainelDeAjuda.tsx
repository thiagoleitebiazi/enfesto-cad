import { Sobreposicao } from './Sobreposicao';
import { description, version } from '../../package.json';

export type ConteudoDaAjuda = 'atalhos' | 'sobre';

interface PainelDeAjudaProps {
  readonly conteudo: ConteudoDaAjuda;
  readonly onFechar: () => void;
}

/** Os mesmos atalhos tratados em `aoTeclar` (App.tsx) — manter as duas listas juntas. */
const ATALHOS_DE_TECLADO: ReadonlyArray<readonly [string, string]> = [
  ['Ctrl+N', 'Novo projeto'],
  ['Ctrl+O', 'Abrir (Biblioteca)'],
  ['Ctrl+S', 'Salvar'],
  ['Ctrl+Shift+S', 'Salvar como'],
  ['Ctrl+I', 'Importar DXF'],
  ['Ctrl+E', 'Exportar PDF'],
  ['Ctrl+H', 'Histórico do projeto'],
  ['Ctrl+Z', 'Desfazer'],
  ['Ctrl+Y ou Ctrl+Shift+Z', 'Refazer'],
  ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copiar / Recortar / Colar'],
  ['Ctrl+D', 'Duplicar'],
  ['Ctrl+A', 'Selecionar tudo'],
  ['Delete ou Backspace', 'Excluir a seleção'],
  ['+ ou =', 'Aumentar zoom'],
  ['-', 'Diminuir zoom'],
  ['Ctrl+0', 'Ajustar à tela'],
  ['Enter', 'Fechar o contorno (Novo Molde, Furo)'],
  ['Esc', 'Desligar Mão ou Zoom por janela; senão, cancelar a ferramenta atual'],
];

const GESTOS_DO_MOUSE: ReadonlyArray<readonly [string, string]> = [
  ['Roda', 'Zoom no ponto do cursor'],
  ['Botão do meio, ou Espaço + arrastar', 'Mover a vista (como a Mão)'],
  ['Duplo clique numa peça', 'Propriedades da peça'],
  ['Shift+clique num vértice (Mover ponto)', 'Somar vértices à seleção'],
  ['Clique no canto das réguas', 'Alternar a régua entre cm e mm'],
];

function TabelaDeAtalhos(props: { readonly titulo: string; readonly linhas: ReadonlyArray<readonly [string, string]> }): React.JSX.Element {
  return (
    <table className="tabela-de-atalhos">
      <caption>{props.titulo}</caption>
      <tbody>
        {props.linhas.map(([tecla, acao]) => (
          <tr key={tecla}>
            <th scope="row">
              <kbd>{tecla}</kbd>
            </th>
            <td>{acao}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Menu Ajuda: a lista de atalhos que o programa realmente trata, e o "Sobre". */
export function PainelDeAjuda(props: PainelDeAjudaProps): React.JSX.Element {
  if (props.conteudo === 'atalhos') {
    return (
      <Sobreposicao titulo="Atalhos de teclado" onFechar={props.onFechar}>
        <div className="painel-de-ajuda">
          <TabelaDeAtalhos titulo="Teclado" linhas={ATALHOS_DE_TECLADO} />
          <TabelaDeAtalhos titulo="Mouse" linhas={GESTOS_DO_MOUSE} />
        </div>
      </Sobreposicao>
    );
  }
  return (
    <Sobreposicao titulo="Sobre o Enfesto CAD" onFechar={props.onFechar}>
      <div className="painel-de-ajuda painel-sobre">
        <p className="nome-do-programa">
          Enfesto CAD <span>versão {version}</span>
        </p>
        <p>{description}.</p>
        <dl className="lista-de-propriedades">
          <dt>Importa</dt>
          <dd>DXF e PDF vetorial</dd>
          <dt>Exporta</dt>
          <dd>PDF vetorial em escala 1:1 (encaixe ou moldes) e relatório de produção em PDF ou Excel</dd>
          <dt>Projetos</dt>
          <dd>Salvos neste computador, na Biblioteca, com histórico de versões</dd>
        </dl>
      </div>
    </Sobreposicao>
  );
}
