# PDF da escala — modelo de novembro/2026

O gerador usa a estrutura visual do PDF fornecido pela coordenação: A4 retrato, logotipo no cabeçalho, mês/ano centralizado, celebrações à esquerda e visitas à direita. Dias de celebração são agrupados; cada horário mantém sua própria linha. Os quadros de contatos aparecem lado a lado abaixo das tabelas no guia restrito.

- Celebrações: Dia, dia da semana, Hora, Ministro(s), Observações.
- Visitas: Dia, Ministro(s), Assistido(s).
- Destaques: Carmelo amarelo, capela azul, adoração verde, eventos especiais/casamentos âmbar; fins de semana cinza. O local/tipo continua expresso em texto.
- Observações exibem título específico, local diferente da Matriz e instruções da celebração. Missas habituais na Matriz não repetem esses textos em todas as linhas.
- Fontes compactas próximas da referência, quebra de palavras/linhas longas e páginas adicionais quando necessário. Cabeçalhos e versão/página são repetidos sem reduzir indefinidamente a fonte.
- Rodapé com competência, data de emissão, versão e paginação.

## Acesso

`Baixar PDF aprovado` continua gerando a escala geral, sem identificação, título, local, observações ou contatos privados das visitas. A coluna de assistidos usa referências locais como `Visita dominical 01`.

`Baixar escala completa com contatos (restrita)`, na tela Escalas da coordenação, usa a rota autenticada de guia de visitas e inclui os dados do snapshot aprovado. Para ministros, a mesma rota continua limitando os assistidos às visitas atribuídas ao próprio usuário. Essa visualização usa a largura da página para facilitar leitura. Nenhuma permissão foi ampliada.

O logotipo é o único elemento gráfico extraído da referência. O PDF original com dados pessoais não faz parte do repositório, das fixtures ou dos exemplos.

## Validação

Amostra inteiramente fictícia de novembro/2026 com 40 celebrações, 30 visitas, seis assistidos e doze ministros: uma página A4, renderizada e revisada visualmente. Testes verificam tabelas, nomes de cinco ministros, meses extensos com paginação, último encontro e ausência de dados privados no PDF geral. Testes existentes de guia por destinatário continuam aplicáveis.

Não há promessa de que todos os meses caibam em uma página: nomes extensos, mais eventos ou observações longas geram páginas adicionais para preservar o conteúdo.
