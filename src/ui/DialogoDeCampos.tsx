import { Fragment, useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { lerMedida } from './medidas';

/**
 * Um campo de um diálogo de ferramenta. `medida` é um número em mm (aceita
 * vírgula); `inteiro`, uma contagem; `caixa`, liga/desliga; `escolha`, uma
 * entre várias opções.
 */
export type CampoDoDialogo =
  | {
      readonly tipo: 'medida' | 'inteiro' | 'texto';
      readonly id: string;
      readonly rotulo: string;
      readonly inicial: string;
      /** Pode ficar em branco: nesse caso o diálogo não entrega valor para ele. */
      readonly opcional?: boolean;
    }
  | { readonly tipo: 'caixa'; readonly id: string; readonly rotulo: string; readonly inicial: boolean }
  | {
      readonly tipo: 'escolha';
      readonly id: string;
      readonly rotulo: string;
      readonly opcoes: ReadonlyArray<{ readonly valor: string; readonly rotulo: string }>;
      readonly inicial: string;
    };

/**
 * O que o diálogo entrega: número nos campos `medida` e `inteiro`, texto nos
 * de texto e escolha, booleano nas caixas. Um campo opcional deixado em
 * branco não aparece.
 */
export type ValoresDoDialogo = Readonly<Record<string, number | string | boolean>>;

interface DialogoDeCamposProps {
  readonly titulo: string;
  /** Linhas de leitura no alto do diálogo ("Peça", "Frente"). */
  readonly resumo?: ReadonlyArray<readonly [string, string]>;
  readonly campos: readonly CampoDoDialogo[];
  readonly nota?: string;
  readonly rotuloDoBotao: string;
  /** Aplica com os valores já lidos; devolve a mensagem de erro, ou `null` se deu certo. */
  readonly onAplicar: (valores: ValoresDoDialogo) => string | null;
  readonly onFechar: () => void;
}

/**
 * Diálogo de uma ferramenta que só precisa de alguns valores digitados
 * (medidas em mm, contagens, opções). Lê e confere cada campo antes de
 * aplicar; um erro — do campo ou devolvido por quem aplica — aparece no
 * diálogo, que continua aberto.
 */
export function DialogoDeCampos(props: DialogoDeCamposProps): React.JSX.Element {
  const [valores, setValores] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(props.campos.map((c) => [c.id, c.inicial])),
  );
  const [erro, setErro] = useState<string | null>(null);

  function mudar(id: string, valor: string | boolean): void {
    setValores((atual) => ({ ...atual, [id]: valor }));
    setErro(null);
  }

  function aplicar(): void {
    const lidos: Record<string, number | string | boolean> = {};
    for (const campo of props.campos) {
      const bruto = valores[campo.id];
      if (campo.tipo === 'caixa') {
        lidos[campo.id] = bruto === true;
      } else if (campo.tipo === 'escolha') {
        lidos[campo.id] = String(bruto);
      } else if (campo.opcional && String(bruto).trim() === '') {
        continue;
      } else if (campo.tipo === 'texto') {
        const texto = String(bruto).trim();
        if (texto === '') return setErro(`Preencha "${campo.rotulo}".`);
        lidos[campo.id] = texto;
      } else {
        const texto = String(bruto).trim();
        const numero = texto === '' ? null : lerMedida(texto);
        if (numero === null) return setErro(`"${campo.rotulo}" precisa ser um número.`);
        if (campo.tipo === 'inteiro' && !Number.isInteger(numero)) {
          return setErro(`"${campo.rotulo}" precisa ser um número inteiro.`);
        }
        lidos[campo.id] = numero;
      }
    }
    const mensagem = props.onAplicar(lidos);
    if (mensagem) return setErro(mensagem);
    props.onFechar();
  }

  const primeiroDeTexto = props.campos.find((c) => c.tipo === 'medida' || c.tipo === 'inteiro' || c.tipo === 'texto')?.id;

  return (
    <Sobreposicao titulo={props.titulo} onFechar={props.onFechar}>
      <form
        className="formulario-de-sobreposicao formulario-de-medida-exata"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        {props.resumo && props.resumo.length > 0 && (
          <dl className="lista-de-propriedades">
            {props.resumo.map(([termo, valor]) => (
              <Fragment key={termo}>
                <dt>{termo}</dt>
                <dd>{valor}</dd>
              </Fragment>
            ))}
          </dl>
        )}

        {props.campos.map((campo) => {
          if (campo.tipo === 'caixa') {
            return (
              <label key={campo.id} className="opcao-em-linha">
                <input type="checkbox" checked={valores[campo.id] === true} onChange={(e) => mudar(campo.id, e.target.checked)} />
                {campo.rotulo}
              </label>
            );
          }
          if (campo.tipo === 'escolha') {
            return (
              <fieldset key={campo.id} className="grupo-de-opcoes-do-formulario">
                <legend>{campo.rotulo}</legend>
                {campo.opcoes.map((opcao) => (
                  <label key={opcao.valor} className="opcao-em-linha">
                    <input
                      type="radio"
                      name={`campo-${campo.id}`}
                      checked={valores[campo.id] === opcao.valor}
                      onChange={() => mudar(campo.id, opcao.valor)}
                    />
                    {opcao.rotulo}
                  </label>
                ))}
              </fieldset>
            );
          }
          return (
            <label key={campo.id}>
              {campo.rotulo}
              <input
                type="text"
                inputMode={campo.tipo === 'texto' ? 'text' : campo.tipo === 'inteiro' ? 'numeric' : 'decimal'}
                value={String(valores[campo.id])}
                onChange={(e) => mudar(campo.id, e.target.value)}
                autoFocus={campo.id === primeiroDeTexto}
              />
            </label>
          );
        })}

        {props.nota && <p className="nota-do-formulario">{props.nota}</p>}

        {/* O rodapé fica sempre à vista: numa janela mais alta que a tela, os campos rolam por trás dele. */}
        <div className="rodape-do-formulario">
          {erro && (
            <p className="mensagem-de-erro" role="alert">
              {erro}
            </p>
          )}

          <div className="acoes-da-sobreposicao">
            <button type="button" onClick={props.onFechar}>
              Cancelar
            </button>
            <button type="submit" className="botao-primario">
              {props.rotuloDoBotao}
            </button>
          </div>
        </div>
      </form>
    </Sobreposicao>
  );
}
