import { useState } from 'react';
import { Sobreposicao } from './Sobreposicao';
import { MAXIMO_DE_PROGRAMAS, type Programa } from '../domain/programas';

interface PainelDeProgramasProps {
  readonly programas: readonly Programa[];
  readonly erro: string | null;
  readonly onAbrir: (id: string) => void;
  readonly onRemover: (id: string) => void;
  /** Abre a escolha do programa ou do arquivo; o nome pode vir em branco. */
  readonly onAdicionarArquivo: (nome: string) => void;
  readonly onAdicionarEndereco: (nome: string, endereco: string) => void;
  readonly onFechar: () => void;
}

/**
 * "Programas" (aba Início): atalhos para os outros programas que se usam
 * junto com este. A lista é do computador, não do projeto, e o programa só
 * abre o que foi cadastrado aqui.
 */
export function PainelDeProgramas(props: PainelDeProgramasProps): React.JSX.Element {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const cheia = props.programas.length >= MAXIMO_DE_PROGRAMAS;

  return (
    <Sobreposicao titulo="Programas" onFechar={props.onFechar}>
      <div className="formulario-de-sobreposicao painel-de-imagens">
        {props.programas.length === 0 ? (
          <p className="nota-do-formulario">
            Nenhum atalho ainda. Cadastre abaixo os programas que você usa junto com este: o do plotter, o da máquina de
            corte, uma planilha, um site.
          </p>
        ) : (
          <ul className="lista-de-curvas" aria-label="Atalhos cadastrados">
            {props.programas.map((programa) => (
              <li key={programa.id}>
                <span className="dados-da-imagem">
                  <strong>{programa.nome}</strong>
                  <small title={programa.alvo}>{programa.alvo}</small>
                </span>
                <button type="button" onClick={() => props.onAbrir(programa.id)} aria-label={`Abrir ${programa.nome}`}>
                  Abrir
                </button>
                <button type="button" onClick={() => props.onRemover(programa.id)} aria-label={`Remover o atalho ${programa.nome}`}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <label>
          Nome do atalho novo (em branco, usa o nome do arquivo ou do site)
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          Endereço, para um atalho de site (https://…)
          <input type="text" inputMode="url" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </label>

        {props.erro && (
          <p className="mensagem-de-erro" role="alert">
            {props.erro}
          </p>
        )}

        <p className="nota-do-formulario">
          Os atalhos ficam guardados neste computador e valem para todos os projetos (até {MAXIMO_DE_PROGRAMAS}). O
          programa só abre o que você cadastrou aqui: arquivos escolhidos por você e endereços http ou https.
        </p>

        <div className="acoes-da-sobreposicao">
          <button type="button" onClick={props.onFechar}>
            Fechar
          </button>
          <button
            type="button"
            disabled={cheia || endereco.trim() === ''}
            title={cheia ? `A lista já tem ${MAXIMO_DE_PROGRAMAS} atalhos` : endereco.trim() === '' ? 'Escreva o endereço primeiro' : undefined}
            onClick={() => {
              props.onAdicionarEndereco(nome, endereco);
              setNome('');
              setEndereco('');
            }}
          >
            Adicionar endereço
          </button>
          <button
            type="button"
            className="botao-primario"
            disabled={cheia}
            title={cheia ? `A lista já tem ${MAXIMO_DE_PROGRAMAS} atalhos` : undefined}
            onClick={() => {
              props.onAdicionarArquivo(nome);
              setNome('');
            }}
          >
            Escolher programa ou arquivo…
          </button>
        </div>
      </div>
    </Sobreposicao>
  );
}
