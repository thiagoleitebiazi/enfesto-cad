import { Sobreposicao } from './Sobreposicao';
import { description, version } from '../../package.json';
import { ehMac } from './rodaDoMouse';

export type ConteudoDaAjuda = 'atalhos' | 'sobre';

interface PainelDeAjudaProps {
  readonly conteudo: ConteudoDaAjuda;
  readonly onFechar: () => void;
  /** No Mac a lista diz como as teclas e o trackpad funcionam lá. Sem isto, vale o sistema deste computador. */
  readonly noMac?: boolean;
}

/** No Mac: o que muda nos atalhos e no mouse. */
const NO_MAC: ReadonlyArray<readonly [string, string]> = [
  ['⌘ (Command)', 'Faz o mesmo que o Ctrl em todos os atalhos acima (o Ctrl também funciona)'],
  ['⌘Z, ⌘C, ⌘V, ⌘X, ⌘A', 'Estão também no menu Editar, na barra do Mac'],
  ['⌘H', 'Oculta o programa, como em todo Mac: o Histórico fica em Control+H'],
  ['⌘Q', 'Sai do programa'],
  ['delete', 'Excluir a seleção (é a tecla Backspace do Windows)'],
];

const GESTOS_DO_TRACKPAD: ReadonlyArray<readonly [string, string]> = [
  ['Dois dedos, ou a roda do mouse', 'Mover a vista'],
  ['Pinça, ou ⌘ + rolar (ou + a roda)', 'Zoom no ponto do cursor'],
  ['Clique com dois dedos', 'Não é usado (o desenho não tem menu de botão direito)'],
];

/** Os mesmos atalhos tratados em `aoTeclar` (App.tsx) — manter as duas listas juntas. */
const ATALHOS_DE_TECLADO: ReadonlyArray<readonly [string, string]> = [
  ['F1', 'Esta lista de atalhos'],
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
  ['Enter', 'Fechar o contorno (Reta ou Criar molde, e Furo)'],
  ['Esc', 'Fechar o diálogo aberto; senão, desligar Mão ou Zoom por janela; senão, cancelar a ferramenta atual'],
];

const GESTOS_DO_MOUSE: ReadonlyArray<readonly [string, string]> = [
  ['Roda', 'Zoom no ponto do cursor'],
  ['Botão do meio, ou Espaço + arrastar', 'Mover a vista (como a Mão)'],
  ['Duplo clique numa peça', 'Propriedades da peça'],
  ['Shift+clique num vértice', 'Mover ponto e Modificar: incluir o vértice na seleção, ou tirá-lo dela'],
  ['Clique no canto das réguas', 'Alternar a régua entre cm e mm'],
];

function TabelaDeAtalhos(props: { readonly titulo: string; readonly linhas: ReadonlyArray<readonly [string, string]> }): React.JSX.Element {
  return (
    <table className="tabela-de-atalhos">
      <caption>{props.titulo}</caption>
      {/* Largura fixa da coluna das teclas: as duas tabelas do diálogo ficam alinhadas. */}
      <colgroup>
        <col className="coluna-das-teclas" />
        <col />
      </colgroup>
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
  const noMac = props.noMac ?? ehMac();
  if (props.conteudo === 'atalhos') {
    return (
      <Sobreposicao titulo="Atalhos de teclado" onFechar={props.onFechar}>
        <div className="painel-de-ajuda">
          <TabelaDeAtalhos titulo="Teclado" linhas={ATALHOS_DE_TECLADO} />
          {noMac && <TabelaDeAtalhos titulo="No Mac" linhas={NO_MAC} />}
          <TabelaDeAtalhos titulo="Mouse" linhas={noMac ? GESTOS_DO_MOUSE.filter(([tecla]) => tecla !== 'Roda') : GESTOS_DO_MOUSE} />
          {noMac && <TabelaDeAtalhos titulo="Trackpad" linhas={GESTOS_DO_TRACKPAD} />}
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
          <dt>Ordens de produção</dt>
          <dd>Digitadas, coladas de uma planilha ou importadas de CSV (nenhum ERP ligado)</dd>
          <dt>Usuários</dt>
          <dd>Sem login: quem confirma um plano ou movimenta o estoque é informado (digitado)</dd>
        </dl>
      </div>
    </Sobreposicao>
  );
}
