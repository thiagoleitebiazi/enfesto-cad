# ADR 0226 — O ícone do programa

O programa e o instalador saíam com o ícone padrão do Electron. O dono do projeto pediu que usassem o logo do Enfesto CAD.

**Decisão:** o logo enviado tinha 46 × 39 pixels, pequeno demais para um ícone, mas era a marca que já está na barra do programa. Por isso o ícone sai do mesmo vetor dela: as camadas branca, azul e laranja sobre uma placa azul-marinho arredondada.

- `scripts/icone/gerar-icones.cjs` desenha cada tamanho e grava `build/icon.ico` e `build/icon.icns`. Os dois ficam no repositório, então construir o programa não depende de rodar o gerador;
- até 40 pixels, a marca ocupa mais da placa e o traço engrossa, para as três camadas não virarem um borrão;
- o Windows recebe de 16 a 256 pixels, e o Mac de 32 a 1024, na grade de placa com margem e sombra que ele usa;
- o programa, o instalador, o desinstalador e o `.dmg` usam esses arquivos;
- um teste confere que os tamanhos existem e que a marca do ícone continua igual à da barra.

**Limites:** o Windows guarda ícones em cache: quem já tem atalho pode continuar vendo o antigo até o Windows atualizar. O ícone do Mac só pode ser conferido na construção do Mac, que roda quando o programa é publicado.
