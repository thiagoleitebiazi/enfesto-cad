import { Sobreposicao } from './Sobreposicao';
import {
  descreverEscalaDaImagem,
  imagemProntaParaContornar,
  MAXIMO_DE_IMAGENS,
  OPACIDADES_DA_IMAGEM,
  type ImagemDoModelo,
} from '../domain/imagens';

interface PainelDeImagensProps {
  readonly imagens: readonly ImagemDoModelo[];
  /** Aberto pelo "Digitalizar": mostra os passos para copiar um molde de papel e o botão de contornar. */
  readonly digitalizando: boolean;
  readonly erro: string | null;
  /** Abre a escolha do arquivo. */
  readonly onAdicionar: () => void;
  readonly onMostrar: (id: string, visivel: boolean) => void;
  readonly onOpacidade: (id: string, opacidade: number) => void;
  /** Fecha o painel e pede os dois cliques da calibração sobre a imagem. */
  readonly onCalibrar: (id: string) => void;
  readonly onRemover: (id: string) => void;
  /** Fecha o painel e liga o "Criar molde", para contornar a imagem. */
  readonly onContornar: () => void;
  readonly onFechar: () => void;
}

/**
 * "Imagens" (aba Modelo) e "Digitalizar" (aba Produção): as fotos e os
 * desenhos guardados no projeto, mostrados por baixo das peças. É o mesmo
 * painel; pelo "Digitalizar", ele explica como copiar um molde de papel.
 */
export function PainelDeImagens(props: PainelDeImagensProps): React.JSX.Element {
  const cheio = props.imagens.length >= MAXIMO_DE_IMAGENS;
  const pronta = imagemProntaParaContornar(props.imagens);

  return (
    <Sobreposicao titulo={props.digitalizando ? 'Digitalizar molde de papel' : 'Imagens do modelo'} onFechar={props.onFechar}>
      <div className="formulario-de-sobreposicao painel-de-imagens">
        {props.digitalizando && (
          <ol className="passos-do-digitalizar">
            <li>Fotografe o molde de papel de cima, bem de frente, com uma régua ao lado — ou escaneie-o.</li>
            <li>Adicione a foto aqui e use &ldquo;Calibrar escala&rdquo;: dois cliques nas pontas de uma medida conhecida.</li>
            <li>Com a imagem na escala, contorne o molde clicando nos pontos dele.</li>
          </ol>
        )}

        {props.imagens.length === 0 ? (
          <p className="nota-do-formulario">Nenhuma imagem neste projeto ainda.</p>
        ) : (
          <ul className="lista-de-imagens" aria-label="Imagens do projeto">
            {props.imagens.map((imagem) => (
              <li key={imagem.id}>
                <img src={imagem.dados} alt={`Miniatura de ${imagem.nome}`} />
                <div className="dados-da-imagem">
                  <strong>{imagem.nome}</strong>
                  <small>{descreverEscalaDaImagem(imagem)}</small>
                  <small className={imagem.calibrada ? 'imagem-na-escala' : 'imagem-por-calibrar'}>
                    {imagem.calibrada ? 'Escala calibrada' : 'Escala por calibrar'}
                  </small>
                  <label className="opcao-em-linha">
                    <input type="checkbox" checked={imagem.visivel} onChange={(e) => props.onMostrar(imagem.id, e.target.checked)} />
                    Mostrar no desenho
                  </label>
                  <label className="opcao-em-linha">
                    Opacidade
                    <select
                      value={String(imagem.opacidade)}
                      onChange={(e) => props.onOpacidade(imagem.id, Number(e.target.value))}
                      aria-label={`Opacidade de ${imagem.nome}`}
                    >
                      {OPACIDADES_DA_IMAGEM.map((valor) => (
                        <option key={valor} value={String(valor)}>
                          {Math.round(valor * 100)}%
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="acoes-da-imagem">
                  <button type="button" onClick={() => props.onCalibrar(imagem.id)} aria-label={`Calibrar a escala de ${imagem.nome}`}>
                    Calibrar escala
                  </button>
                  <button type="button" onClick={() => props.onRemover(imagem.id)} aria-label={`Remover ${imagem.nome}`}>
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {props.erro && (
          <p className="mensagem-de-erro" role="alert">
            {props.erro}
          </p>
        )}

        <p className="nota-do-formulario">
          A imagem fica guardada no projeto e aparece por baixo das peças, a partir do começo da mesa ou logo depois das
          peças que já estão nela (&ldquo;Ajustar à tela&rdquo; mostra tudo). Até {MAXIMO_DE_IMAGENS} imagens; as
          grandes são reduzidas ao entrar. A escala só vale como medida depois de calibrada.
        </p>

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Fechar
          </button>
          <button
            type="button"
            onClick={props.onAdicionar}
            disabled={cheio}
            title={cheio ? `O projeto já tem ${MAXIMO_DE_IMAGENS} imagens: remova uma antes de adicionar outra` : undefined}
          >
            Adicionar imagem…
          </button>
          {props.digitalizando && (
            <button
              type="button"
              className="botao-primario"
              onClick={props.onContornar}
              disabled={!pronta}
              title={pronta ? undefined : 'Deixe uma imagem à mostra e calibre a escala dela primeiro'}
            >
              Contornar o molde
            </button>
          )}
        </div>
      </div>
    </Sobreposicao>
  );
}
