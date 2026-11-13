"""POC SESPA: API apenas de leitura; sem DDL, INSERT ou UPDATE."""
import os, json, hashlib
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
import psycopg

app=FastAPI(title="Cobertura Municipal PEC — POC", docs_url=None, redoc_url=None)
GEO=Path(os.getenv("GEOJSON_PATH","/data/PARA.geojson"))

def municipalities():
    data=json.loads(GEO.read_text(encoding="utf-8"))
    result={}
    for f in data.get("features",[]):
        p=f.get("properties") or {}
        code=str(p.get("COD_MUN") or p.get("id") or f.get("id") or "").strip()
        name=str(p.get("NM_MUN") or p.get("name") or code)
        if len(code)!=7 or not code.isdigit() or code in result or not f.get("geometry"):
            raise ValueError("GeoJSON: código IBGE duplicado/inválido ou geometria ausente")
        result[code]=name
    if len(result)!=144: raise ValueError(f"Esperados 144 municípios; encontrados {len(result)}")
    return result

@app.get("/api/health")
def health():
    return {"status":"ok"}

@app.get("/api/cobertura")
def coverage():
    try: base=municipalities()
    except Exception as exc: raise HTTPException(500,str(exc))
    mode=os.getenv("DATA_MODE","demo").lower()
    matched={}
    if mode=="demo":
        # Demonstração determinística, NÃO é dado oficial.
        matched={k: {"cnes": 1+(int(k)%17), "ultima":None} for k in base if int(k)%9!=0}
    elif mode=="postgres":
        sql="""
        SELECT municipio_ibge_cnes AS ibge,
               COUNT(DISTINCT cnes)::int AS cnes,
               MAX(ultima_transmissao) AS ultima
        FROM analytics.vw_pec_cnes
        WHERE uf='15'
          AND municipio_ibge_cnes IS NOT NULL
          AND cnes IS NOT NULL
        GROUP BY municipio_ibge_cnes
        """
        try:
            with psycopg.connect(
                host=os.environ["PGHOST"],port=int(os.getenv("PGPORT","5433")),
                dbname=os.environ["PGDATABASE"],user=os.environ["PGUSER"],
                password=os.getenv("PGPASSWORD",""),
                sslmode=os.getenv("PGSSLMODE","prefer"),
                connect_timeout=5,options="-c default_transaction_read_only=on -c statement_timeout=15000"
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    for ibge,cnes,ultima in cur.fetchall():
                        code=str(ibge).strip()
                        if code in base: matched[code]={"cnes":cnes,"ultima":ultima.isoformat() if ultima else None}
        except Exception as exc:
            raise HTTPException(503,"Não foi possível consultar a Analytics; verifique logs internos e credenciais de leitura")
    else: raise HTTPException(500,"DATA_MODE inválido")
    rows=[{"ibge":code,"municipio":name,"cobertura":int(code in matched),
           "cnes":matched.get(code,{}).get("cnes",0),
           "ultima_transmissao":matched.get(code,{}).get("ultima")}
          for code,name in sorted(base.items(),key=lambda v:v[1])]
    n=sum(x["cobertura"] for x in rows)
    return {"modo":mode,"gerado_em":datetime.now().isoformat(timespec="seconds"),
            "resumo":{"total":len(rows),"mapeados":n,"pendentes":len(rows)-n,
                      "percentual":round(n*100/len(rows),2)},
            "municipios":rows}
