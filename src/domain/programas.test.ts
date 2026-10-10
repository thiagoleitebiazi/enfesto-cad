import { describe, it, expect } from 'vitest';
import {
  adicionarPrograma,
  enderecoValido,
  lerProgramas,
  MAXIMO_DE_PROGRAMAS,
  novoPrograma,
  removerPrograma,
  type Programa,
} from './programas';

describe('enderecoValido', () => {
  it('aceita http e https, e entende https quando falta o esquema', () => {
    expect(enderecoValido('https://www.exemplo.com.br/corte')).toBe('https://www.exemplo.com.br/corte');
    expect(enderecoValido('http://192.168.0.10:8080')).toBe('http://192.168.0.10:8080/');
    expect(enderecoValido('  www.exemplo.com.br ')).toBe('https://www.exemplo.com.br/');
    expect(enderecoValido('localhost:3000')).toBe('https://localhost:3000/');
  });

  it('recusa o que não é endereço de site: outros esquemas, vazio e texto solto', () => {
    expect(() => enderecoValido('file:///C:/Windows/System32/cmd.exe')).toThrow('http:// ou https://');
    expect(() => enderecoValido('javascript:alert(1)')).toThrow('http:// ou https://');
    expect(() => enderecoValido('ms-settings:privacy')).toThrow('http:// ou https://');
    expect(() => enderecoValido('   ')).toThrow('Escreva o endereço.');
    expect(() => enderecoValido('plotter')).toThrow('Endereço inválido');
    expect(() => enderecoValido('http://')).toThrow('Endereço inválido');
  });
});

describe('novoPrograma', () => {
  it('guarda o nome digitado; em branco, usa o nome do arquivo sem a extensão ou o do site', () => {
    expect(novoPrograma('a', ' Plotter ', 'arquivo', 'C:\\Program Files\\Plot\\plot.exe')).toEqual({
      id: 'a',
      nome: 'Plotter',
      tipo: 'arquivo',
      alvo: 'C:\\Program Files\\Plot\\plot.exe',
    });
    expect(novoPrograma('b', '', 'arquivo', 'C:\\Program Files\\Plot\\plot.exe').nome).toBe('plot');
    expect(novoPrograma('c', '', 'arquivo', '/home/ana/tabela de medidas.xlsx').nome).toBe('tabela de medidas');
    expect(novoPrograma('d', '', 'endereco', 'www.exemplo.com.br/pedidos')).toMatchObject({
      nome: 'exemplo.com.br',
      alvo: 'https://www.exemplo.com.br/pedidos',
    });
  });

  it('recusa atalho sem alvo, endereço que não é de site e nome comprido demais', () => {
    expect(() => novoPrograma('a', 'X', 'arquivo', '  ')).toThrow('Escolha o programa ou o arquivo');
    expect(() => novoPrograma('a', 'X', 'endereco', 'file:///c:/x.exe')).toThrow('http:// ou https://');
    expect(() => novoPrograma('a', 'n'.repeat(41), 'arquivo', 'C:\\x.exe')).toThrow('até 40 caracteres');
    expect(novoPrograma('a', 'n'.repeat(40), 'arquivo', 'C:\\x.exe').nome).toHaveLength(40);
  });
});

describe('a lista de atalhos', () => {
  const plotter = novoPrograma('a', 'Plotter', 'arquivo', 'C:\\plot.exe');
  const site = novoPrograma('b', 'Pedidos', 'endereco', 'https://exemplo.com.br');

  it('adiciona no fim e remove pelo id', () => {
    const lista = adicionarPrograma(adicionarPrograma([], plotter), site);

    expect(lista.map((p) => p.nome)).toEqual(['Plotter', 'Pedidos']);
    expect(removerPrograma(lista, 'a').map((p) => p.nome)).toEqual(['Pedidos']);
    expect(() => removerPrograma(lista, 'z')).toThrow('Atalho não encontrado.');
  });

  it('recusa repetir o mesmo alvo e passar do máximo', () => {
    expect(() => adicionarPrograma([plotter], novoPrograma('c', 'De novo', 'arquivo', 'C:\\plot.exe'))).toThrow('Já existe um atalho para isso: “Plotter”.');

    const cheia = Array.from({ length: MAXIMO_DE_PROGRAMAS }, (_, i) => novoPrograma(`p${i}`, `P${i}`, 'arquivo', `C:\\p${i}.exe`));
    expect(() => adicionarPrograma(cheia, site)).toThrow('até 12 atalhos');
  });
});

describe('lerProgramas', () => {
  it('devolve os atalhos bem formados, na ordem do arquivo', () => {
    const guardado: Programa[] = [
      { id: 'a', nome: 'Plotter', tipo: 'arquivo', alvo: 'C:\\plot.exe' },
      { id: 'b', nome: 'Pedidos', tipo: 'endereco', alvo: 'https://exemplo.com.br/' },
    ];

    expect(lerProgramas(JSON.parse(JSON.stringify(guardado)))).toEqual(guardado);
  });

  it('ignora o que não é atalho: o arquivo pode ter sido mexido por fora', () => {
    const mexido = [
      null,
      'texto',
      { id: 'a', nome: 'Sem tipo', alvo: 'C:\\x.exe' },
      { id: 'b', nome: 'Tipo estranho', tipo: 'comando', alvo: 'format c:' },
      { id: 'c', nome: 'Esquema proibido', tipo: 'endereco', alvo: 'file:///C:/Windows/System32/cmd.exe' },
      { id: '', nome: 'Sem id', tipo: 'arquivo', alvo: 'C:\\x.exe' },
      { id: 'd', nome: 'Bom', tipo: 'arquivo', alvo: 'C:\\bom.exe' },
      { id: 'd', nome: 'Id repetido', tipo: 'arquivo', alvo: 'C:\\outro.exe' },
      { id: 'e', nome: 5, tipo: 'arquivo', alvo: 'C:\\x.exe' },
    ];

    expect(lerProgramas(mexido)).toEqual([{ id: 'd', nome: 'Bom', tipo: 'arquivo', alvo: 'C:\\bom.exe' }]);
    expect(lerProgramas({ nao: 'é lista' })).toEqual([]);
    expect(lerProgramas(undefined)).toEqual([]);
  });

  it('nunca passa do máximo, mesmo com o arquivo cheio demais', () => {
    const demais = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, nome: `P${i}`, tipo: 'arquivo', alvo: `C:\\p${i}.exe` }));

    expect(lerProgramas(demais)).toHaveLength(MAXIMO_DE_PROGRAMAS);
  });
});
