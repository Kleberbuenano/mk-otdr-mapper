# MK OTDR Mapper

Aplicativo web para mapear redes de fibra óptica, importar KML/KMZ, editar trechos e consultar conexões entre fibras.

## Arquivos

- `dist/index.html`: mapa Leaflet, edição, importação e medições.
- `dist/network.js`: cadastro de cabos, fusões individuais, continuidade e backup JSON.

## Estado atual

O inventário de cabos e fusões é salvo no navegador e pode ser exportado e restaurado em JSON. A consulta de continuidade ainda não está integrada à medição geográfica. Não há sincronização de projetos em nuvem.

## Vercel

Conectar este repositório ao projeto existente `mk-otdr-mapper-aer-lda`. Usar framework Other, sem comando de build e diretório de saída `dist`. O projeto existente tem ID `prj_XtkKfmyl1lCeHtabFpxojSGQp1wj`.

O envio ao GitHub não publica automaticamente no projeto Vercel enquanto a integração Git não estiver configurada.
