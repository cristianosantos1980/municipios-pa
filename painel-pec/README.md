# POC — Cobertura Municipal PEC e-SUS APS — Pará

Projeto experimental de painel institucional com **React + Apache ECharts + FastAPI + PostgreSQL** e Docker Compose. Usa diretamente o `PARA.geojson` da raiz deste repositório (propriedades `CD_MUN` e `NM_MUN`).

## Instalação no devops1

```bash
cd /opt
git clone --branch poc/cobertura-pec-dashboard --single-branch https://github.com/cristianosantos1980/municipios-pa.git
cd municipios-pa/painel-pec
cp .env.example .env
chmod 600 .env
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
```

A porta padrão é `127.0.0.1:18090`; acesse por túnel SSH a partir do Windows:

```bash
ssh -L 18090:127.0.0.1:18090 devops1@ENDERECO_DEVOPS1
```

Abra `http://127.0.0.1:18090` no navegador.

## Modo de demonstração

A configuração inicial `DATA_MODE=demo` **não apresenta dados reais**. O painel marca explicitamente a demonstração. Os 144 municípios e seus contornos são reais, mas a cobertura demonstrativa é simulada.

## PostgreSQL Analytics (após aprovação)

Definir `DATA_MODE=postgres`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` em `.env`, com usuário somente leitura e acesso de rede autorizado. A API utiliza `default_transaction_read_only=on`, timeout SQL de 15 segundos e consulta apenas `analytics.vw_pec_cnes`. Em seguida:

```bash
docker compose -f compose.yaml up -d --force-recreate api
```

Não publicar a porta 18090 para toda a rede sem autenticação e HTTPS. Não versionar `.env`, dumps, credenciais ou dados assistenciais. A POC não altera Apache Hop, banco, checkpoint ou workflows.

## Atualização e versionamento

Após novas alterações aprovadas:

```bash
cd /opt/municipios-pa
git pull --ff-only
cd painel-pec
docker compose -f compose.yaml up -d --build
```

A API é consultada pelo frontend a cada 30 minutos ou pelo botão Atualizar. O rodapé exibe o último recebimento encontrado em `ultima_transmissao` da resposta da Analytics, com data e hora disponíveis. Esse instante **não é o horário do ETL** nem o horário da consulta ao painel. Se houver filtros de município, versão ou período, o valor é o maior recebimento do recorte; na ausência de dados aparece `Sem dados`. O frontend lê o GeoJSON do repositório, sem download adicional.

## Mapa com OpenStreetMap

O cartão de cobertura territorial utiliza exclusivamente **OpenStreetMap** (Leaflet com zoom e navegação). O OpenStreetMap mostra ruas e localidades como fundo; a cor verde/vermelha vem exclusivamente dos 144 polígonos do `PARA.geojson` e da resposta da API. A seleção de município destaca e aproxima a região.

No OpenStreetMap a roda do mouse amplia/reduz o zoom. **Pins estilo localização, verdes/vermelhos** aparecem a partir do nível 7 para evitar aglomeração no panorama estadual; ao clicar em um pin o mapa aproxima e exibe seu município. Ao selecionar um município no filtro, o mapa aproxima a área e mostra seu pin mesmo em zoom menor. Cada pin é um marcador representativo da área do município, não a localização geográfica de um CNES, do PEC nem necessariamente da sede municipal. As cores seguem os mesmos dados da API e da sobreposição territorial.

O navegador do usuário precisa acessar `https://tile.openstreetmap.org` para carregar os mapas de fundo. A licença do OpenStreetMap é exibida no mapa. Esta opção deve ser usada na POC sob a política pública de tiles: [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Não fazer prefetch ou download em massa. Para uso institucional com muitos acessos, avaliar provedor de tiles com SLA ou serviço próprio.

O servidor de API não envia dados clínicos nem credenciais ao OpenStreetMap; o navegador, entretanto, realiza requisições aos servidores de tiles, expondo metadados de rede e da área visualizada. Para ambientes com acesso externo restrito, é necessário disponibilizar um provedor de tiles interno ou autorizado.

## Unidades de Saúde e pins georreferenciados

Os filtros **Município** e **Unidade de Saúde** funcionam nos dois sentidos. É possível escolher município primeiro e carregar suas unidades por `GET /api/unidades?municipio=<IBGE7>`, ou pesquisar diretamente uma unidade por nome/CNES (mínimo três caracteres), em todo o Pará, por `GET /api/unidades/busca?q=...`. Escolher uma unidade preenche o município correspondente, carrega o cadastro local e localiza seu pin. Mesmo com um município selecionado, digitar outro nome de unidade permite localizar um estabelecimento em outro município e atualizar ambos os filtros. A pesquisa estadual retorna no máximo 30 opções, é limitada a 8 segundos e não faz uma consulta por tecla (debounce de 350 ms). Ambas as consultas utilizam somente leitura de `analytics.cnes_estabelecimentos`; a consulta municipal também utiliza `analytics.vw_pec_cnes` para status de transmissão. A lista inclui nome e CNES; o endpoint municipal retorna latitude e longitude quando válidas.

- Selecionar uma unidade com coordenadas válidas aproxima o OpenStreetMap até o ponto geográfico cadastrado e abre o pin correspondente.
- Pins verdes indicam CNES com transmissão identificada na Analytics, de acordo com os filtros de versão e datas; vermelhos indicam ausência de transmissão identificada nesse recorte. **Isso não representa cadastro CNES ativo/inativo, regularidade de envio ou disponibilidade assistencial.**
- Os pins municipais representam o município de forma aproximada; somente os pins das unidades usam a latitude/longitude efetivamente cadastradas.
- Unidades sem coordenadas válidas continuam no filtro, identificadas como sem coordenadas, mas não têm posição inventada no mapa.
- O serviço não consulta registros assistenciais, não grava dados no PostgreSQL e não altera Apache Hop.
- Como posição geográfica cadastral pode estar incorreta ou desatualizada, verificar qualidade de latitude/longitude antes de divulgar a localização ao público.

**Testes rápidos após atualizar:** selecionar Colares, confirmar lista de unidades, escolher unidade com coordenadas, observar aproximação e popup com nome/CNES/status; mudar versão PEC ou período e conferir as cores; limpar filtros e confirmar a visão dos 144 municípios.

## Filtros

- **Versão PEC**: lista obtida por `GET /api/versoes`; filtra `versao_pec` de `analytics.vw_pec_cnes`.
- **Data do Recebimento**: filtro único com Todo o período, últimos 7/30/90 dias ou período personalizado (datas inicial e final). A API continua recebendo `data_inicio` e `data_fim` no formato ISO `AAAA-MM-DD`; a data final é inclusiva. A referência temporal disponível na view é `ultima_transmissao`, que representa o último recebimento consolidado, não o histórico de eventos.
- Os filtros afetam todos os indicadores de cobertura e o mapa; o campo Município é uma busca local na lista de pendências.
- **Atenção à semântica temporal:** a view representa a **última transmissão consolidada**, não o histórico de todos os lotes. Um filtro de mês não indica necessariamente todos os municípios que enviaram naquele mês.

A API aceita apenas consultas parametrizadas `SELECT`, com transação read-only e timeout SQL. O GeoJSON municipal continua sendo referência independente de cobertura total. Para manter a API saudável, a consulta de versões também tem timeout de 15 segundos.

**Recência:** o painel apresenta quatro cards (até 7 dias, 8 a 30 dias, acima de 30 dias e sem transmissão identificada), calculados a partir de `ultima_transmissao` no conjunto de municípios exibidos. Os percentuais usam o total do recorte atual. A classificação pode mudar com a passagem dos dias sem nova transmissão, mesmo sem atualização do banco.

**Visualização de unidade:** ao selecionar um CNES georreferenciado, o mapa oculta os polígonos de cobertura e todos os demais pins, mantendo apenas o pin daquela unidade e seu popup. Ao limpar a seleção, a visão cartográfica municipal é restaurada.

**Limites da POC:** A seleção de município calcula uma cobertura de 0% ou 100% para um município (não é mais a taxa estadual); use Todos os municípios para a cobertura estadual. O painel é de homologação; a publicação pública exige autenticação, HTTPS e revisão de acesso ao banco.
