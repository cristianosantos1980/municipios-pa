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

A API é consultada pelo frontend a cada 30 minutos ou pelo botão Atualizar. O frontend lê o GeoJSON do repositório, sem download adicional.

**Limites da POC:** filtros de versão e período não estão ligados ao backend nesta primeira fase, e os cartões de situação por recência da imagem de referência serão adicionados após a aprovação da cobertura básica. A lista de municípios sem transmissão é calculada a partir do GeoJSON completo, não apenas dos municípios presentes no cadastro CNES.
