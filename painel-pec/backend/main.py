"""POC SESPA: API apenas de leitura; sem DDL, INSERT ou UPDATE."""
import os, json
from datetime import date, datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
import psycopg

app=FastAPI(title="Cobertura Municipal PEC — POC", docs_url=None, redoc_url=None)
GEO=Path(os.getenv("GEOJSON_PATH","/data/PARA.geojson"))

def municipalities():
    data=json.loads(GEO.read_text(encoding="utf-8"))
    result={}
    for index, f in enumerate(data.get("features", []), start=1):
        p = f.get("properties") or {}
        code = str(p.get("CD_MUN") or p.get("id") or f.get("id") or "").strip()
        name = str(p.get("NM_MUN") or p.get("name") or code).strip()
        # A API utiliza apenas o código IBGE e o nome. Geometrias podem ser
        # verificadas pelo frontend cartográfico, sem impedir os indicadores.
        if not (len(code) == 7 and code.isdigit()):
            raise ValueError(f"GeoJSON: código IBGE inválido na feição {index}: {code!r}")
        if code in result:
            raise ValueError(f"GeoJSON: IBGE duplicado na feição {index}: {code} ({name})")
        result[code] = name
    if len(result) != 144:
        raise ValueError(f"GeoJSON: esperado 144 municípios, encontrados {len(result)}")
    return result

@app.get("/api/health")
def health():
    return {"status":"ok"}

@app.get("/api/versoes")
def versions():
    """Lista versões observadas, sem expor dados individuais."""
    if os.getenv("DATA_MODE", "demo").lower() == "demo":
        return {"versoes": ["5.5.28", "5.5.24", "5.5.22"]}
    try:
        with psycopg.connect(
            host=os.environ["PGHOST"], port=int(os.getenv("PGPORT", "5433")),
            dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
            password=os.getenv("PGPASSWORD", ""),
            sslmode=os.getenv("PGSSLMODE", "prefer"), connect_timeout=5,
            options="-c default_transaction_read_only=on -c statement_timeout=15000"
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT versao_pec
                    FROM analytics.vw_pec_cnes
                    WHERE uf = '15' AND versao_pec IS NOT NULL
                    ORDER BY versao_pec DESC
                """)
                return {"versoes": [row[0] for row in cur.fetchall()]}
    except Exception:
        raise HTTPException(503, "Falha ao consultar as versões PEC na Analytics")



@app.get("/api/unidades")
def unidades(
    municipio: str = Query(min_length=7, max_length=7, pattern=r"^15\\d{5}$"),
    versao: str | None = Query(default=None, max_length=40),
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    """Estabelecimentos CNES por município; coordenadas e transmissão identificada."""
    if data_inicio and data_fim and data_inicio > data_fim:
        raise HTTPException(400, "Data inicial posterior à final")
    if municipio not in municipalities():
        raise HTTPException(404, "Município não encontrado no GeoJSON do Pará")
    if os.getenv("DATA_MODE", "demo").lower() == "demo":
        # Nunca simular endereços, CNES ou coordenadas geográficas.
        return {"municipio": municipio, "modo": "demo", "unidades": []}
    if os.getenv("DATA_MODE", "").lower() != "postgres":
        raise HTTPException(500, "DATA_MODE inválido")

    # A Analytics armazena município IBGE com seis dígitos; o GeoJSON com sete.
    ibge6 = municipio[:6]
    sql = """
        WITH estabelecimentos AS (
            SELECT DISTINCT ON (cnes)
                   cnes::text AS cnes, estabelecimento, latitude, longitude
              FROM analytics.cnes_estabelecimentos
             WHERE uf = '15'
               AND municipio_ibge::text IN (%s, %s)
               AND cnes IS NOT NULL
             ORDER BY cnes, atualizado_em DESC NULLS LAST
        ),
        transmissoes AS (
            SELECT cnes::text AS cnes,
                   MAX(ultima_transmissao) AS ultima
              FROM analytics.vw_pec_cnes
             WHERE uf = '15'
               AND municipio_ibge_cnes::text IN (%s, %s)
               AND cnes IS NOT NULL
               AND (%s::text IS NULL OR versao_pec = %s::text)
               AND (%s::date IS NULL OR ultima_transmissao >= %s::date)
               AND (%s::date IS NULL OR ultima_transmissao < (%s::date + INTERVAL '1 day'))
             GROUP BY cnes
        )
        SELECT e.cnes, e.estabelecimento, e.latitude, e.longitude,
               t.ultima
          FROM estabelecimentos e
          LEFT JOIN transmissoes t ON t.cnes = e.cnes
         ORDER BY e.estabelecimento, e.cnes
    """
    args = (ibge6, municipio, ibge6, municipio, versao, versao,
            data_inicio, data_inicio, data_fim, data_fim)
    try:
        with psycopg.connect(
            host=os.environ["PGHOST"], port=int(os.getenv("PGPORT", "5433")),
            dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
            password=os.getenv("PGPASSWORD", ""),
            sslmode=os.getenv("PGSSLMODE", "prefer"), connect_timeout=5,
            options="-c default_transaction_read_only=on -c statement_timeout=15000"
        ) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, args)
                registros = cur.fetchall()
    except Exception:
        raise HTTPException(503, "Falha na consulta somente leitura de unidades da Analytics")

    resultado = []
    for cnes, nome, latitude, longitude, ultima in registros:
        lat = float(latitude) if latitude is not None else None
        lon = float(longitude) if longitude is not None else None
        # Coordenadas fora da região plausível não são plotadas nem inventadas.
        coordenadas_validas = (lat is not None and lon is not None and
                              -12 <= lat <= 5 and -65 <= lon <= -43)
        resultado.append({
            "cnes": cnes, "estabelecimento": nome or "Unidade sem nome",
            "latitude": lat if coordenadas_validas else None,
            "longitude": lon if coordenadas_validas else None,
            "possui_transmissao": ultima is not None,
            "ultima_transmissao": ultima.isoformat() if ultima else None
        })
    return {"municipio": municipio, "modo": "postgres", "unidades": resultado}

@app.get("/api/cobertura")
def coverage(
    versao: str | None = Query(default=None, max_length=40),
    data_inicio: date | None = None,
    data_fim: date | None = None,
):
    if data_inicio and data_fim and data_inicio > data_fim:
        raise HTTPException(400, "Data inicial posterior à final")
    if versao is not None and not versao.strip():
        versao = None
    try: base=municipalities()
    except Exception as exc: raise HTTPException(500,str(exc))
    mode=os.getenv("DATA_MODE","demo").lower()
    matched={}
    if mode=="demo":
        # Demonstração determinística, NÃO é dado oficial.
        matched={k: {"cnes": 1+(int(k)%17), "ultima":None} for k in base if int(k)%9!=0}
        if versao and versao not in ("5.5.28", "5.5.24", "5.5.22"):
            matched = {}
        if data_inicio or data_fim:
            # Não criar datas falsas no modo demonstrativo.
            matched = {}
    elif mode=="postgres":
        sql="""
        SELECT municipio_ibge_cnes AS ibge,
               COUNT(DISTINCT cnes)::int AS cnes,
               MAX(ultima_transmissao) AS ultima
        FROM analytics.vw_pec_cnes
        WHERE uf='15'
          AND municipio_ibge_cnes IS NOT NULL
          AND cnes IS NOT NULL
          AND (%s::text IS NULL OR versao_pec = %s::text)
          AND (%s::date IS NULL OR ultima_transmissao >= %s::date)
          AND (%s::date IS NULL OR ultima_transmissao < (%s::date + INTERVAL '1 day'))
        GROUP BY municipio_ibge_cnes
        """
        # O cadastro da Analytics usa IBGE municipal de 6 dígitos,
        # enquanto o GeoJSON traz o código IBGE completo de 7 dígitos
        # (com dígito verificador). Relacionar pelo prefixo de 6 dígitos
        # é seguro após validar que cada prefixo é único no GeoJSON.
        codigo_geojson_por_6 = {}
        for codigo_7 in base:
            codigo_6 = codigo_7[:6]
            if codigo_6 in codigo_geojson_por_6:
                raise HTTPException(500, "GeoJSON contém prefixos IBGE de 6 dígitos duplicados")
            codigo_geojson_por_6[codigo_6] = codigo_7
        try:
            with psycopg.connect(
                host=os.environ["PGHOST"],port=int(os.getenv("PGPORT","5433")),
                dbname=os.environ["PGDATABASE"],user=os.environ["PGUSER"],
                password=os.getenv("PGPASSWORD",""),
                sslmode=os.getenv("PGSSLMODE","prefer"),
                connect_timeout=5,options="-c default_transaction_read_only=on -c statement_timeout=15000"
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (versao, versao, data_inicio, data_inicio, data_fim, data_fim))
                    for ibge,cnes,ultima in cur.fetchall():
                        codigo_origem = str(ibge).strip()
                        if len(codigo_origem) == 6 and codigo_origem.isdigit():
                            code = codigo_geojson_por_6.get(codigo_origem)
                        elif len(codigo_origem) == 7 and codigo_origem.isdigit() and codigo_origem in base:
                            code = codigo_origem
                        else:
                            code = None
                        if code:
                            matched[code] = {
                                "cnes": cnes,
                                "ultima": ultima.isoformat() if ultima else None
                            }
        except Exception as exc:
            raise HTTPException(503,"Não foi possível consultar a Analytics; verifique logs internos e credenciais de leitura")
    else: raise HTTPException(500,"DATA_MODE inválido")
    rows=[{"ibge":code,"municipio":name,"cobertura":int(code in matched),
           "cnes":matched.get(code,{}).get("cnes",0),
           "ultima_transmissao":matched.get(code,{}).get("ultima")}
          for code,name in sorted(base.items(),key=lambda v:v[1])]
    n=sum(x["cobertura"] for x in rows)
    return {"modo":mode,"gerado_em":datetime.now().isoformat(timespec="seconds"),
            "filtros": {"versao":versao,"data_inicio":data_inicio.isoformat() if data_inicio else None,
                        "data_fim":data_fim.isoformat() if data_fim else None},
            "resumo":{"total":len(rows),"mapeados":n,"pendentes":len(rows)-n,
                      "percentual":round(n*100/len(rows),2)},
            "municipios":rows}
