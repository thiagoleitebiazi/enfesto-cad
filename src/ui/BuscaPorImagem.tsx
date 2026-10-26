import { useRef, useState } from 'react';
import type { ImagemDePixels } from '../domain/digitalizacao';
import { imagensDoProjeto } from '../domain/imagens';
import type { Projeto } from '../domain/projeto';
import { assinaturaDaImagem, maisParecidos, type AssinaturaVisual } from '../domain/buscaVisual';
import { numeroComVirgula } from '../core/numeros';
import { pixelsDaImagem } from './pixelsDaImagem';

interface BuscaPorImagemProps {
  readonly projetos: readonly Projeto[];
  readonly onAbrir: (id: string) => void;
  /** Lê os pixels de uma imagem (data URL); nos testes, um de mentira. */
  readonly lerPixels?: (dados: string) => Promise<ImagemDePixels>;
}

const QUANTOS = 5;

const lerArquivo = (arquivo: File): Promise<string> =>
  new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(leitor.error ?? new Error('não deu para ler o arquivo'));
    leitor.readAsDataURL(arquivo);
  });

/**
 * A busca por imagem (ADR 0145): uma foto escolhida é comparada às imagens dos modelos da biblioteca (Modelo ›
 * Imagens), e os mais parecidos aparecem primeiro, com o quanto se parecem.
 */
export function BuscaPorImagem(props: BuscaPorImagemProps): React.JSX.Element {
  const lerPixels = props.lerPixels ?? pixelsDaImagem;
  // As assinaturas das imagens já lidas (pelo id da imagem e o tamanho do texto: a mesma imagem não é lida duas vezes).
  const guardadas = useRef(new Map<string, AssinaturaVisual>());
  const [resultado, setResultado] = useState<{ readonly nome: string; readonly lista: ReadonlyArray<{ readonly projeto: Projeto; readonly semelhanca: number }>; readonly semImagem: number } | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async (arquivo: File): Promise<void> => {
    setBuscando(true);
    setRecado(null);
    try {
      const referencia = assinaturaDaImagem(await lerPixels(await lerArquivo(arquivo)));
      const candidatos: Array<{ readonly projeto: Projeto; readonly assinaturas: AssinaturaVisual[] }> = [];
      for (const projeto of props.projetos) {
        const assinaturas: AssinaturaVisual[] = [];
        for (const imagem of imagensDoProjeto(projeto)) {
          const chave = `${imagem.id}:${imagem.dados.length}`;
          let a = guardadas.current.get(chave);
          if (!a) {
            try {
              a = assinaturaDaImagem(await lerPixels(imagem.dados));
              guardadas.current.set(chave, a);
            } catch {
              continue;
            }
          }
          assinaturas.push(a);
        }
        candidatos.push({ projeto, assinaturas });
      }
      const lista = maisParecidos(referencia, candidatos).slice(0, QUANTOS).map((r) => ({ projeto: r.candidato.projeto, semelhanca: r.semelhanca }));
      setResultado({ nome: arquivo.name, lista, semImagem: candidatos.filter((c) => c.assinaturas.length === 0).length });
    } catch (e) {
      setRecado(`Não deu para ler a imagem: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <section className="busca-por-imagem" aria-label="Busca por imagem">
      <label>
        Buscar por imagem: os modelos mais parecidos com uma foto
        <input
          type="file"
          accept="image/*"
          aria-label="Imagem para buscar"
          disabled={buscando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void buscar(arquivo);
            e.target.value = '';
          }}
        />
      </label>
      {buscando && <p className="nota-do-formulario">Comparando…</p>}
      {recado && <p className="nota-do-formulario">{recado}</p>}
      {resultado && (
        <div role="status">
          <p className="nota-do-formulario">
            {resultado.lista.length === 0 ? `Nenhum modelo com imagem para comparar com ${resultado.nome}.` : `Os mais parecidos com ${resultado.nome}:`}
            {resultado.semImagem > 0 ? ` ${resultado.semImagem} projeto(s) sem imagem ficaram de fora (Modelo › Imagens).` : ''}
          </p>
          <ol className="parecidos">
            {resultado.lista.map(({ projeto, semelhanca }) => (
              <li key={projeto.id}>
                <img src={imagensDoProjeto(projeto)[0]?.dados} alt="" />
                <span>
                  <strong>{projeto.nome}</strong> ({projeto.codigo})
                  <br />
                  <small>parecido {numeroComVirgula(semelhanca * 100, 0)}%</small>
                </span>
                <button type="button" onClick={() => props.onAbrir(projeto.id)}>
                  Abrir
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
