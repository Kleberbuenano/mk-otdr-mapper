# Estabilização do motor geográfico — MK OTDR Mapper

Esta branch contém mudanças incrementais para reduzir o risco de medições e rotas incorretas. A branch `main` permanece intacta.

## Regra de segurança da Rota 02

A Rota 02 deve ser uma alternativa topológica real à Rota 01. Se não existir caminho alternativo, a aplicação deve informar isso claramente; nunca deve apresentar silenciosamente a própria Rota 01 como Rota 02.

## Riscos geográficos identificados para correção gradual

- O grafo atual aproxima endpoints em até 18 m e liga endpoints a segmentos próximos em até 25 m. Proximidade geográfica não prova continuidade física de fibra.
- O encaixe GPS/evento precisa considerar a projeção sobre o segmento, não somente o vértice mais próximo.
- A localização de eventos OTDR percorre os segmentos na ordem do array; antes de medir, é necessário garantir continuidade e sentido da rota.
- A calibração global proporcional deve ser tratada como estimativa, não como calibração por trecho/âncora.
- A ligação final entre rota e CEO deve ter limite explícito e ser exibida como aproximação quando aplicável.

## Critérios mínimos de regressão

1. Rota 01 encontra o caminho conectado esperado do PT09 à CEO.
2. Rota 02 retorna um caminho diferente e válido; se não houver alternativa, apresenta mensagem explícita.
3. Segmentos paralelos próximos não são conectados apenas por distância sem confirmação.
4. GPS encaixa no segmento correto e informa quando está fora da tolerância.
5. Evento OTDR não atravessa trechos desconectados nem muda de ramo silenciosamente.
6. Distância geográfica, distância OTDR e reserva técnica são mostradas separadamente.
7. Reserva técnica de 20 m por CEO aplicável não é duplicada.
8. Importar, salvar, recarregar e exportar o projeto preserva rotas, CEOs, sites, cabos e fusões.

## Limites desta entrega

Não há arquivos de teste KML/KMZ/SOR reais anexados a esta alteração. Os critérios acima precisam ser executados com projetos reais de campo antes de qualquer merge ou publicação. Nenhuma alteração nesta branch deve ser promovida automaticamente para produção.
