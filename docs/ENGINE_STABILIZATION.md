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

## Auditoria diagnóstica de proximidade

Foi adicionado `src/topology-audit.js` para listar candidatos geométricos de proximidade entre segmentos distintos:

- endpoints de segmentos diferentes dentro do limite configurado (padrão: 18 m);
- endpoint próximo ao interior de outro segmento (padrão: 25 m);
- distância, identificação dos segmentos e projeção aproximada são retornadas para revisão.

**Importante:** o módulo é somente diagnóstico. Cada candidato retorna `requiresConfirmation: true` e `connects: false`. Ele não cria arestas, não altera `buildGraph()` e não muda rotas, GPS ou medições. A intenção é preparar uma revisão de campo sem introduzir uma nova regra topológica sem evidência.

Os limites são parâmetros de triagem, não tolerâncias universais de instalação. A validação final exige KML/KMZ de uma rede conhecida e confirmação de continuidade física.


## Cruzamentos entre trechos

A auditoria também sinaliza cruzamentos geométricos entre o interior de dois segmentos distintos (tipo `segment-crossing`). Isso ajuda a identificar cabos que se cruzam no mapa sem que se saiba se existe emenda, derivação ou apenas passagem em níveis diferentes. O cruzamento é sempre um alerta de revisão: `requiresConfirmation: true` e `connects: false`. Segmentos colineares ou sobrepostos não são tratados como um ponto único de cruzamento.

Foram acrescentados dois testes: cruzamento interno sinalizado sem conexão automática e sobreposição colinear sem falso ponto de cruzamento.


## Diagnóstico de componentes desconectados

`analyzeEndpointConnectivity()` agrupa segmentos usando somente coincidência exata das coordenadas das extremidades (precisão padrão de 6 casas decimais). O relatório lista componentes geométricos, segmentos isolados, extremidades sem par e candidatos a junção com grau maior que 2. Não faz snap por distância e declara explicitamente que não prova continuidade óptica. A análise é diagnóstica e ainda não está ligada à interface nem ao `buildGraph()`.


## Preparação da camada visual de diagnóstico

Foi adicionado `src/diagnostic-geojson.js`, adaptador independente que transforma os relatórios da auditoria em uma `FeatureCollection` GeoJSON pronta para consumo por Leaflet ou outra biblioteca cartográfica.

Classificações visuais propostas:

- Azul: segmento pertencente a componente com extremidades geometricamente compartilhadas.
- Vermelho: segmento isolado geometricamente ou extremidade sem par.
- Âmbar: candidato de proximidade, cruzamento ou junção que exige conferência.

Cada feature declara `opticalContinuityConfirmed: false` quando aplicável. O conjunto declara `diagnosticOnly: true` e `changesOperationalGraph: false`. O adaptador não modifica os segmentos de entrada, não cria arestas e não está conectado à interface nem ao grafo operacional.

Os testes do adaptador cobrem a classificação de componentes, alertas de proximidade, imutabilidade dos dados de entrada e validação de parâmetros. A integração visual no mapa fica deliberadamente para uma etapa posterior, depois de validar o contrato GeoJSON e obter um KML/KMZ real de campo.


## Camada visual de diagnóstico no mapa

A interface do mapa recebeu um controle opcional **Diagnóstico**. Ao ativá-lo, a aplicação carrega os módulos de auditoria e apresenta uma camada Leaflet separada das camadas operacionais, além de um painel com componentes desconectados, segmentos isolados, extremidades sem par e candidatos de proximidade/cruzamento.

- Azul: segmento com extremidades geometricamente compartilhadas.
- Vermelho: componente geométrico isolado ou extremidade sem par.
- Âmbar: candidato de proximidade, cruzamento ou junção para conferência.
- Popups informam que cada achado exige confirmação em campo e não comprova continuidade óptica.
- A camada é desativável e não altera o grafo, as medições, o KML ou os dados da rede.
- Alertas âmbar de endpoint-endpoint são suprimidos quando as coordenadas coincidem na precisão de análise, evitando duplicar como alerta uma junção já classificada como compartilhamento geométrico.

Como o Vercel publica somente a pasta `dist`, foram incluídas cópias dos módulos de auditoria em `dist/topology-audit.js` e `dist/diagnostic-geojson.js`. Os testes verificam também a presença desses assets e a execução do adaptador distribuído.

A camada ainda requer validação visual real no navegador com KML/KMZ de campo. A aprovação de build/CI não substitui essa validação.


## Testes após integração da camada

O conjunto atual contém 27 testes automatizados, incluindo a leitura do bundle publicado em `dist`, presença dos controles na página e supressão de alertas âmbar duplicados em endpoints com coordenadas compartilhadas. Execução PR #50 aprovada: 27 testes, 0 falhas.
