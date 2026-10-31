import { MANUAL_DO_PROGRAMA, NOVIDADES_DO_PROGRAMA } from './manualDoPrograma';
import { Sobreposicao } from './Sobreposicao';
import { description, version } from '../../package.json';
import { ehMac } from './rodaDoMouse';

export type ConteudoDaAjuda = 'atalhos' | 'sobre' | 'manual' | 'novidades';

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
  ['F2', 'Girar a peça em ângulo livre'],
  ['F3', 'Girar a peça 180°'],
  ['F4', 'Espelhar a peça'],
  ['F5', 'Levar a peça à dobra horizontal do tecido'],
  ['F6', 'Levar a peça à dobra vertical do tecido'],
  ['F7', 'Peça em ½ camada'],
  ['F8', 'Peça na orientação original'],
  ['F9', 'Travar o arrasto na horizontal'],
  ['F10', 'Travar o arrasto na vertical'],
  ['F11', 'Peça de simetria só na dobra do tecido, ou com as outras'],
  ['F12', 'Ligar ou desligar a sobreposição de moldes'],
  ['Setas', 'Mover a peça até encostar'],
  ['Ctrl+← / Ctrl+→', 'Girar a peça 90° para a esquerda / a direita'],
  ['Ctrl+F', 'Mover a peça para fora do enfesto'],
  ['Ctrl+R', 'Mover com referência'],
  ['Ctrl+G / Ctrl+U', 'Agrupar / desagrupar as peças selecionadas'],
  ['Ctrl+W', 'Verificar moldes sobrepostos'],
  ['Ctrl+T', 'Medir distâncias'],
  ['Ctrl+K', 'Cortar'],
  ['Ctrl+Shift+T', 'Inserir texto'],
  ['Ctrl+P', 'Plotar (PLT)'],
  ['Ctrl+L', 'Localizar (Biblioteca)'],
  ['Alt+clique', 'Selecionar as peças do mesmo tamanho'],
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
  ['Arrastar no vazio (Selecionar)', 'Seleciona as peças que ficam inteiras dentro do retângulo'],
  ['Ctrl+clique numa peça', 'Põe a peça na seleção, ou a tira; arrastar uma das selecionadas leva todas'],
  ['Ctrl+arrastar no vazio', 'Soma as peças do retângulo às que já estavam selecionadas'],
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
  if (props.conteudo === 'manual') {
    return (
      <Sobreposicao titulo="Manual" onFechar={props.onFechar}>
        <div className="painel-de-ajuda">
          {MANUAL_DO_PROGRAMA.map((s) => (
            <section key={s.titulo} aria-label={s.titulo}>
              <h3>{s.titulo}</h3>
              {s.passos.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </Sobreposicao>
    );
  }
  if (props.conteudo === 'novidades') {
    return (
      <Sobreposicao titulo="O que há de novo" onFechar={props.onFechar}>
        <div className="painel-de-ajuda">
          <ul>
            {NOVIDADES_DO_PROGRAMA.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
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
          <dd>Digitadas, coladas de uma planilha, importadas de CSV ou trocadas com o ERP por uma pasta (Planejamento › Ordens; nenhum ERP ligado pela rede)</dd>
          <dt>Usuários</dt>
          <dd>Sem login: quem confirma um plano ou movimenta o estoque é informado (digitado)</dd>
        </dl>
      </div>
    </Sobreposicao>
  );
}
