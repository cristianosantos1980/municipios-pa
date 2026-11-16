# AGENTS.md — Continuidade e regras de desenvolvimento

Este arquivo orienta agentes de IA (ChatGPT, Codex e similares) e desenvolvedores que retomarem este repositório. **Leia-o antes de alterar arquivos.** O objetivo é preservar a estabilidade do painel Analytics e-SUS PEC do Pará, com alterações rastreáveis e seguras.

## 1. Identificação e contexto

- Repositório: `cristianosantos1980/municipios-pa`.
- Branch de trabalho atual: `poc/cobertura-pec-dashboard`. **Não modificar a branch `main` sem autorização expressa.**
- Aplicação: `painel-pec/`; GeoJSON municipal: `PARA.geojson`, na raiz.
- Finalidade: apresentar a cobertura territorial, a recepção de dados e a recência dos registros PEC e-SUS APS identificados na Analytics do Centralizador Estadual do Pará.
- Público: equipes técnicas e gestores da SESPA e dos municípios. Empregar português do Brasil, linguagem institucional e indicadores compreensíveis.
- O ambiente de produção é operado pelo responsável pelo projeto. **Commit no GitHub não significa implantação ou validação em produção.**

## 2. Arquitetura existente

- Frontend: React 18, Vite, CSS e Leaflet/OpenStreetMap.
  - `painel-pec/frontend/src/main.jsx`: filtros, indicadores estaduais, classificação de recência, tabela e rodapé.
  - `painel-pec/frontend/src/MapaOSM.jsx`: polígonos, pins, zoom, tooltips e popups.
  - `painel-pec/frontend/src/style.css`: identidade visual e regras responsivas.
  - `painel-pec/frontend/index.html` e `favicon.svg`: documento e identidade na aba do navegador.
- Backend: FastAPI/Python, em `painel-pec/backend/main.py`.
- Execução: Docker Compose, em `painel-pec/compose.yaml`, com serviços `api` e `web`.
- Origem dos indicadores: PostgreSQL Analytics; a aplicação consulta dados usando credenciais de **somente leitura**.
- Bases consultadas no projeto: `analytics.vw_pec_cnes` e `analytics.cnes_estabelecimentos`. Conferir código e esquema antes de modificar qualquer consulta.
- O nome de origem `ultima_transmissao` é um campo técnico. Não o renomear em SQL, JSON ou contrato de API apenas para refletir textos da interface.
- O mapa usa `PARA.geojson`; os pontos das unidades só devem aparecer quando houver latitude/longitude cadastral válida.

## 3. Regras obrigatórias de trabalho

1. **Inspecionar antes de alterar.** Ler este arquivo, os arquivos pertinentes e, se necessário, o `README.md`. Identificar branch, HEAD, mudanças recentes e dependências.
2. **Preservar o que funciona.** Aplicar a menor alteração capaz de atender ao pedido; evitar refatorações, mudanças de layout ou alteração de contratos não solicitadas.
3. **Editar diretamente o repositório quando houver acesso autorizado de escrita.** Não transferir trabalho manual ao responsável se o agente puder realizar o commit. Nunca alegar publicação sem confirmação efetiva da ferramenta.
4. **Usar somente a branch autorizada.** Não executar force push, rebase destrutivo, reset, exclusão de branch ou alteração em `main` sem aprovação explícita.
5. **Registrar commits claros**, preferencialmente no padrão `fix(painel): ...`, `feat(painel): ...`, `style(painel): ...`, `docs(painel): ...`.
6. **Não alterar banco, ETL ou infraestrutura por iniciativa própria.** Sem `DROP`, `DELETE`, `TRUNCATE`, migrações, alteração de roles, pipelines Apache Hop, tabelas, dados ou permissões sem solicitação explícita e avaliação de risco.
7. **Nunca publicar segredos.** Não adicionar `.env`, senhas, tokens, chaves privadas SSH, backups ou dados assistenciais ao Git. Não imprimir segredos em respostas, logs, testes ou commits.
8. **Separar desenvolvimento de produção.** Evitar mudanças de portas, URLs, proxy, TLS, firewall, Docker Compose ou configurações persistentes sem necessidade justificada. Preservar o `.env` local do servidor.
9. **Não inventar resultados.** Distinguir revisão estática, build local, teste automatizado e execução real em produção. Informar claramente o que foi ou não validado.
10. **Não incorporar dependências desnecessárias.** Preferir componentes, ícones SVG e padrões já presentes; avaliar segurança e compatibilidade ao adicionar bibliotecas.

## 4. Comentários e documentação no código — atenção especial

**O projeto deve manter comentários úteis, atualizados e escritos em português do Brasil.**

- Comentar toda regra de negócio não óbvia: interpretação da cobertura, janela de recência, filtros temporais, seleção de municípios/unidades e comportamento cartográfico.
- Comentar decisões técnicas que possam surpreender o próximo mantenedor: por que determinada condição existe, limitações da Analytics, prevenção de consultas custosas e salvaguardas de segurança.
- Em funções com lógica complexa, usar um comentário curto ou documentação de função explicando **o motivo, os parâmetros relevantes e os efeitos** quando não forem evidentes.
- Na alteração de um comportamento comentado, **atualizar ou remover o comentário antigo no mesmo commit**. Comentário desatualizado é defeito de manutenção.
- Preferir comentários explicativos sobre o **porquê**, não repetir literalmente operações evidentes (`setMunicipio(...)`, `return`, etc.).
- Não comentar cada linha por obrigação e não inundar JSX/CSS de comentários decorativos. Usar comentários por bloco/regra, com linguagem objetiva.
- Preservar comentários existentes que ainda sejam corretos; não apagá-los sem motivo.
- Documentar contratos de API, parâmetros e mudanças de comportamento público no `README.md`, quando aplicável.
- Em CSS, identificar o propósito de grupos de regras e breakpoints; evitar sobrescritas contraditórias e duplicações desnecessárias.
- Em SQL, comentar especialmente as condições que definem `possui_transmissao`, a versão PEC, a última data e o significado dos dados ausentes.
- Não colocar nomes de pessoas, credenciais, endereços privados sensíveis ou dados clínicos em comentários.

## 5. Regras funcionais que devem permanecer

- **Nomenclatura da interface:** usar **“Recepção de Dados”**, “Com recepção”, “Sem recepção”, “Dados recepcionados”, “Recepção recente” e afins. O termo `ultima_transmissao` permanece no contrato técnico.
- **Indicadores executivos são estaduais:** os quatro cartões superiores — `Municípios`, `Com recepção`, `Sem recepção`, `Cobertura` — e a seção de recência mantêm os valores estaduais ao selecionar um município ou uma unidade. Os filtros de versão PEC e período podem modificar o recorte estadual, conforme a consulta.
- **Mapa e tabela municipal** devem reagir à escolha de município; a seleção de unidade deve localizar somente o CNES escolhido, preservando a possibilidade de limpar e voltar à visão municipal.
- **Filtro de Unidade de Saúde:** ao selecionar um município, listar suas unidades; ao selecionar uma unidade e limpá-la pelo `×`, mostrar novamente as unidades do município **sem remover o município**. Manter também a busca estadual por nome ou CNES.
- **Recência:** quatro faixas — até 7 dias, 8 a 30 dias, mais de 30 dias e sem registro identificado. Não mudar os limiares sem solicitação.
- **Sem registro não significa ausência absoluta de envio.** Significa ausência de registro identificado na fonte e no recorte consultado. Evitar afirmações mais fortes que os dados sustentam.
- **Recorte temporal:** a Analytics expõe o último registro consolidado disponível, não necessariamente todos os eventos históricos. A data mostrada no rodapé não é o horário de execução do ETL.
- **Georreferenciamento:** não inventar coordenadas para unidades sem latitude/longitude válida; pins municipais não representam endereços de CNES.
- **Responsividade:** manter funcionamento em desktop, tablet e celular; evitar rolagem horizontal da página inteira, mantendo o scroll somente na tabela quando necessário.
- **Acessibilidade:** preservar nomes acessíveis de botões e inputs, foco visível, contraste e `prefers-reduced-motion` na animação neon de “Sem recepção”.
- **Fontes no rodapé:** preservar CNES Setembro/2026 e link do Centralizador Estadual (`https://pec.centralizador.saude.pa.gov.br`).
- **Identidade visual:** manter o favicon inspirado no SUS, ícones vetoriais e estilo institucional, salvo solicitação de redesign.

## 6. Segurança, privacidade e desempenho

- A API deve executar consultas parametrizadas, sem SQL concatenado a partir de entradas do usuário, com acesso somente leitura e tempo limite de consulta.
- Restringir respostas a indicadores e metadados necessários, sem dados clínicos ou identificáveis de pacientes.
- Não transformar ausência de registro, falha de comunicação ou indisponibilidade da Analytics em conclusão de que o PEC municipal está inativo.
- Manter consultas eficientes; evitar uma consulta por marcador, por tecla ou por renderização. Respeitar debounce/cancelamento na pesquisa estadual.
- Em OpenStreetMap, manter atribuição e respeitar a política do provedor de tiles; não realizar download em massa.
- Manter a configuração de publicação segura: HTTPS, controle de acesso definido pela implantação e nenhuma exposição involuntária de portas administrativas ou do PostgreSQL.
- Não inserir credenciais ou URLs internas privadas no frontend.

## 7. Rotina de alteração e validação

1. Confirmar o pedido, branch e arquivos afetados.
2. Inspecionar implementação atual; observar se a documentação está desatualizada. **O código e o contrato real têm precedência sobre descrições históricas do README.**
3. Implementar a menor mudança e revisar os comentários nos trechos tocados.
4. Verificar, quando o ambiente permitir:
   - Build do frontend: `cd painel-pec/frontend && npm install --no-audit --no-fund && npm run build` (em ambiente isolado; não versionar `node_modules`).
   - Sintaxe Python: `python -m py_compile painel-pec/backend/main.py` (se o backend foi alterado).
   - Configuração do Compose: `cd painel-pec && docker compose -f compose.yaml config --quiet` (exige `.env` local).
   - Smoke test: filtros, recência, seleção/limpeza de unidade, mapa, popups, tabela, fontes e telas pequenas.
5. Conferir diff para evitar edições não relacionadas e exposição de segredos.
6. Fazer commit na branch autorizada e **confirmar SHA**.
7. Informar: o que mudou, arquivos afetados, testes executados e não executados, SHA e orientação segura de deploy.

### Atualização de implantação (somente no servidor correto, após validação)

```bash
cd /opt/municipios-pa &&
git pull --ff-only origin poc/cobertura-pec-dashboard &&
cd painel-pec &&
docker compose -f compose.yaml up -d --build &&
docker compose -f compose.yaml ps
```

Este comando pressupõe que o repositório já existe nesse caminho, que a branch está selecionada, que as configurações locais foram preservadas e que o operador autorizou o deploy. **Não executá-lo automaticamente em produção.**

## 8. Pendências e limites conhecidos

- Foi solicitado anteriormente mostrar a **versão do PEC no popup da unidade**; quando não houver versão, exibir **“Não identificada”**. **Ainda não foi implementado**. Verificar a origem e o vínculo da versão com a última transmissão antes de alterar a API.
- O `README.md` contém descrições históricas que podem não refletir os indicadores estaduais estáveis, a nomenclatura “Recepção de Dados” e a situação de produção. Atualizar essas seções se a tarefa envolver documentação; não restaurar comportamentos antigos a partir do README.
- Não presumir que a implantação em produção já foi testada. Solicitar ou analisar evidências reais quando necessário.

## 9. Orientação para retomar em outro chat

Solicitação sugerida: **“Leia o AGENTS.md na raiz do repositório `cristianosantos1980/municipios-pa`, branch `poc/cobertura-pec-dashboard`; confira o código e os commits atuais e continue o Analytics e-SUS PEC obedecendo às regras de comentários, segurança, alterações mínimas e commits.”**

A cada retomada, consultar novamente o repositório. **Este arquivo é uma referência de continuidade, não uma garantia de que a branch, as regras de negócio ou as pendências não mudaram desde sua criação.**
