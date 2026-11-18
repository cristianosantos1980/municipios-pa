# Monitoramento da Recepção de Dados - PEC e-SUS APS

Painel institucional com **React + Leaflet/OpenStreetMap + FastAPI + PostgreSQL** e Docker Compose. Usa diretamente o `PARA.geojson` da raiz deste repositório (propriedades `CD_MUN` e `NM_MUN`).

## Interface UX e funcionalidades

A identidade aprovada utiliza **faixas azuis com ícones brancos** para títulos: Resumo do Município, Cobertura Territorial, Distribuição das Versões PEC, Últimas Recepções, Recência e situação municipal. O cabeçalho exibe **SESPA sem o logotipo do Governo do Pará**; o botão Atualizar é somente um ícone com animação durante a consulta e toast de sucesso com fade. A interface é responsiva.

- **Resumo municipal:** exibido após selecionar município; lista estabelecimentos CNES, quantidades com e sem recepção, percentual de unidades cadastradas com recepção no recorte, última data e botão para abrir a lista de estabelecimentos. Selecionar CNES da lista centraliza o pin correspondente, quando existem coordenadas válidas.
- **Distribuição das versões:** `GET /api/versoes/distribuicao`, apenas leitura, contabiliza cada CNES no máximo uma vez pela versão do último registro que atende ao filtro de data/versão; não equivale a inventário completo de instalações. Se a consulta exceder o tempo limite, o gráfico exibe uma mensagem sem ocultar o restante do dashboard.
- **Últimas Recepções (30 dias):** representa a **distribuição por data dos últimos registros municipais disponíveis**, não a evolução acumulada histórica nem a quantidade de todos os envios diários. Os pontos do gráfico agora apresentam um **tooltip com data (DD/MM/AAAA) e quantidade de municípios** ao passar o mouse, tocar ou focar pelo teclado; o tooltip não modifica os valores e fecha ao retirar o cursor da área. O gráfico e o ícone informativo da faixa azul têm dimensionamento independente; as regras de CSS devem atingir apenas o SVG do gráfico, não todos os ícones do cartão. Não apresentar curva de evolução histórica sem dados históricos próprios.
- **Ajuda e indicadores:** os quatro cartões têm definição em tooltip e o botão **Ajuda** abre uma janela flutuante sobre o conteúdo, sem deslocar a estrutura do painel. É possível fechá-la pelo botão de fechar, por **Entendi**, pela tecla **Esc** ou clicando fora da janela. As mensagens explicam os limites da fonte Analytics. Especificamente, **“Sem recepção” não comprova que o município não enviou dados**: significa que não foi identificado registro recepcionado e consolidado no recorte. Dificuldades de transmissão, processamento, integração ou atualização podem contribuir para essa situação; essas possibilidades exigem verificação antes de qualquer conclusão sobre o envio municipal.
- **Exportação CSV:** utiliza os indicadores administrativos já carregados, respeitando filtros; não exporta dados de pacientes ou dados clínicos.
- **Popup da unidade CNES:** nome, código CNES, status, última recepção e versão PEC associada; caso ausente, **Não identificada**.
- **Fontes e atualizações:** apresenta a última data `analytics.cnes_estabelecimentos.atualizado_em`, o último registro PEC no recorte e o horário da consulta do frontend, com hiperlinks oficiais preservados.

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

Definir `DATA_MODE=postgres`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` em `.env`, com usuário somente leitura e acesso de rede autorizado. A API utiliza `default_transaction_read_only=on`, timeout SQL de 15 segundos e consulta as fontes `analytics.vw_pec_cnes` e `analytics.cnes_estabelecimentos`. Em seguida:

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

A API é consultada pelo frontend a cada 30 minutos ou pelo botão Atualizar. No clique manual, o ícone gira durante a consulta e o frontend exibe uma **notificação flutuante** após uma resposta bem-sucedida, com aparecimento suave e esmaecimento até desaparecer em 5 segundos; falhas continuam na mensagem de erro existente. Essa confirmação indica recarregamento da consulta, **não** a execução de uma nova carga ETL ou alteração do banco. Quando o período personalizado é aplicado, suas datas inicial e final permanecem visíveis **dentro do próprio seletor** após fechar o calendário, sem criar outra linha de filtros. O rodapé exibe o último recebimento encontrado em `ultima_transmissao` da resposta da Analytics, com data e hora disponíveis. Esse instante **não é o horário do ETL** nem o horário da consulta ao painel. Se houver filtros de município, versão ou período, o valor é o maior recebimento do recorte; na ausência de dados aparece `Sem dados`. O frontend lê o GeoJSON do repositório, sem download adicional.

## Mapa com OpenStreetMap

O cartão de cobertura territorial utiliza **OpenStreetMap** (Leaflet com zoom e navegação). O OpenStreetMap mostra ruas e localidades como fundo; as quatro cores da recência (verde escuro até 7 dias, verde claro de 8 a 30 dias, amarelo acima de 30 dias e vermelho sem registro) vêm dos 144 polígonos do `PARA.geojson` associados à resposta da API. A seleção de município destaca e aproxima a região.

No OpenStreetMap a roda do mouse amplia/reduz o zoom. **Pins municipais por faixa de recência e pins CNES por recepção identificada** aparecem a partir do nível 7 para evitar aglomeração no panorama estadual; ao clicar em um pin o mapa aproxima e exibe seu município. Ao selecionar um município no filtro, o mapa aproxima a área e mostra seu pin mesmo em zoom menor. Cada pin é um marcador representativo da área do município, não a localização geográfica de um CNES, do PEC nem necessariamente da sede municipal. As cores seguem os mesmos dados da API e da sobreposição territorial.

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

**Testes rápidos após atualizar:** selecionar Colares, confirmar lista de unidades, escolher unidade com coordenadas, observar aproximação e popup com nome/CNES/status; limpar somente a unidade pelo `×` e confirmar que a lista de unidades de Colares reaparece, sem perder o município; selecionar outra unidade; mudar versão PEC ou período e conferir as cores; limpar filtros e confirmar a visão dos 144 municípios. A pesquisa estadual por nome/CNES continua disponível quando o usuário digita no campo.

## Atualização automática da referência CNES no rodapé

O texto **“CNES - Última atualização”** não usa mais uma data fixa no frontend. A API `GET /api/cnes/atualizacao` executa exclusivamente um `SELECT MAX(atualizado_em)` em `analytics.cnes_estabelecimentos` com `uf = '15'`, usando a conexão PostgreSQL somente leitura e o timeout configurado. O frontend mostra a data mais recente no formato brasileiro após a consulta de cobertura bem-sucedida, preservando o hiperlink oficial de download do CNES. Quando não há data ou a consulta falha, exibe **“Não disponível”** em vez de uma data inventada ou desatualizada.

**Semântica:** `atualizado_em` é a data registrada na tabela analítica do cadastro CNES do Pará; **não equivale necessariamente à competência oficial do CNES, ao horário do ETL do PEC ou à data da última recepção de dados do PEC**. A atualização periódica do painel e o clique em Atualizar consultam novamente a referência.

## Limpeza individual e continuidade da seleção

Os campos de **Município** e **Unidade de Saúde** possuem botão **×** próprio: ao utilizá-lo, o valor do campo é removido, o foco retorna à pesquisa e as opções correspondentes são reabertas imediatamente. A limpeza do município apresenta novamente todos os municípios e desmarca a unidade anteriormente vinculada; a limpeza da unidade mantém o município e reabre a lista de CNES daquele município. O botão de lixeira permanece reservado à limpeza **geral**. Para versão e período, utilizar, respectivamente, **Todas as versões** e **Todo o período** no próprio seletor.

## Filtros

- **Versão PEC**: lista obtida por `GET /api/versoes`; filtra `versao_pec` de `analytics.vw_pec_cnes`.
- **Data da Recepção**: filtro único com Todo o período, últimos 7/30/90 dias ou período personalizado. Ao selecionar **Personalizado**, abre-se um **pop-up sobreposto ao painel** (sem deslocar os indicadores), com animação suave e **dois meses consecutivos sincronizados**, lado a lado no desktop e empilhados no celular. O primeiro clique escolhe o início e o segundo escolhe o fim, inclusive **no mesmo mês**; todas as datas intermediárias ficam destacadas. Um terceiro clique inicia nova seleção. **Aplicar filtro** é habilitado somente após escolher ambas as datas; antes disso, a API não recebe o intervalo em edição. **Cancelar**, Esc ou clique fora fecham sem aplicar o rascunho, preservando o filtro anterior. A API continua recebendo `data_inicio` e `data_fim` no formato ISO `AAAA-MM-DD`; a data final é inclusiva. A referência temporal disponível na view é `ultima_transmissao`, que representa o último recebimento consolidado, não o histórico de eventos.
- Os filtros de **versão e período** afetam os indicadores estaduais e gráficos. O filtro **Município/Unidade** detalha os componentes locais sem reduzir os quatro cartões estaduais ou a recência estadual.
- **Atenção à semântica temporal:** a view representa a **última transmissão consolidada**, não o histórico de todos os lotes. Um filtro de mês não indica necessariamente todos os municípios que enviaram naquele mês.

A API aceita apenas consultas parametrizadas `SELECT`, com transação read-only e timeout SQL. O GeoJSON municipal continua sendo referência independente de cobertura total. Para manter a API saudável, a consulta de versões também tem timeout de 15 segundos.

**Recência:** o painel apresenta quatro cards (até 7 dias, 8 a 30 dias, acima de 30 dias e sem transmissão identificada), calculados a partir de `ultima_transmissao` no conjunto **estadual** após filtros de versão/período. Os percentuais usam o total estadual do recorte atual. A classificação pode mudar com a passagem dos dias sem nova transmissão, mesmo sem atualização do banco.

**Visualização de unidade:** ao selecionar um CNES georreferenciado, o mapa oculta os polígonos de cobertura e todos os demais pins, mantendo apenas o pin daquela unidade e seu popup. **Um segundo clique no mesmo estabelecimento**, seja na lista do Resumo do Município, na pesquisa de Unidade de Saúde ou no próprio pin, **desseleciona apenas o CNES** e restaura a visão cartográfica do município, sem alterar município, versão PEC ou período. O botão × da pesquisa continua disponível para remover a seleção.

**Limites do projeto:** A seleção de município mantém os indicadores estaduais e exibe um resumo CNES municipal adicional. O percentual municipal é uma razão entre estabelecimentos cadastrados e estabelecimentos com recepção identificada no recorte, não cobertura assistencial. A publicação pública exige HTTPS, controles de acesso e revisão dos dados administrativos expostos.
