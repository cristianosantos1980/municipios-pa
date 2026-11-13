import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as echarts from 'echarts';
import MapaOSM from './MapaOSM';
import './style.css';

const n=x=>new Intl.NumberFormat('pt-BR').format(x??0);
const P={green:'#39a75a',red:'#e85d64',yellow:'#f3bc39',dark:'#203a63'};
const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function MunicipioPesquisa({rows,value,onChange}){
  const [texto,setTexto]=useState('');
  const [aberto,setAberto]=useState(false);
  const selecionado=rows.find(r=>r.ibge===value);
  useEffect(()=>{if(selecionado)setTexto(selecionado.municipio)},[value,selecionado?.municipio]);
  const opcoes=useMemo(()=>{
    const termo=normalizar(texto.trim());
    return termo?rows.filter(r=>normalizar(r.municipio).includes(termo)):rows;
  },[rows,texto]);
  const escolher=registro=>{
    onChange(registro?.ibge||'');
    setTexto(registro?.municipio||'');
    setAberto(false);
  };
  return <div className="municipio-picker">
    <input type="text" autoComplete="off" aria-label="Pesquisar município"
      role="combobox" aria-autocomplete="list" aria-expanded={aberto}
      aria-controls="municipios-opcoes" value={texto}
      placeholder="Pesquisar município..."
      onFocus={()=>setAberto(true)}
      onChange={e=>{setTexto(e.target.value);setAberto(true);if(value)onChange('')}}
      onBlur={()=>setAberto(false)}
      onKeyDown={e=>{
        if(e.key==='Escape'){setAberto(false);setTexto(selecionado?.municipio||'')}
        if(e.key==='Enter'&&aberto&&opcoes.length){e.preventDefault();escolher(opcoes[0])}
      }}/>
    {(texto||value)&&<button className="municipio-clear" type="button" aria-label="Limpar município" onMouseDown={e=>e.preventDefault()} onClick={()=>escolher(null)}>×</button>}
    {aberto&&<div className="municipio-options" id="municipios-opcoes" role="listbox">
      <button type="button" role="option" aria-selected={!value}
        onMouseDown={e=>{e.preventDefault();escolher(null)}}>Todos os municípios</button>
      {opcoes.length?opcoes.map(r=><button type="button" role="option" aria-selected={value===r.ibge}
        key={r.ibge} onMouseDown={e=>{e.preventDefault();escolher(r)}}>
        {r.municipio}
      </button>):<div className="municipio-empty">Nenhum município encontrado</div>}
    </div>}
  </div>;
}
function App(){
 const [geo,setGeo]=useState(null),[payload,setPayload]=useState(null),
       [error,setError]=useState(''),[municipio,setMunicipio]=useState(''),
       [lastRefresh,setLastRefresh]=useState(null),[versao,setVersao]=useState(''),
       [versoes,setVersoes]=useState([]),[dataInicio,setDataInicio]=useState(''),
       [dataFim,setDataFim]=useState('');
 const refresh=async()=>{
  try{
   const params=new URLSearchParams();
   if(versao)params.set('versao',versao);
   if(dataInicio)params.set('data_inicio',dataInicio);
   if(dataFim)params.set('data_fim',dataFim);
   const res=await fetch('/api/cobertura'+(params.size?'?'+params:''),{cache:'no-store'});
   if(!res.ok)throw new Error('Falha na API: '+res.status);
   setPayload(await res.json());setLastRefresh(new Date());setError('');
  }catch(e){setError(String(e))}
 };
 useEffect(()=>{fetch('/PARA.geojson').then(r=>r.json()).then(setGeo).catch(e=>setError(String(e)));fetch('/api/versoes').then(r=>r.ok?r.json():Promise.reject(Error('Falha ao listar versões PEC'))).then(data=>setVersoes(data.versoes)).catch(e=>setError(String(e)));},[]);
 useEffect(()=>{refresh();const id=setInterval(refresh,30*60*1000);return()=>clearInterval(id)},[versao,dataInicio,dataFim]);
 const rows=payload?.municipios||[];
 const filtered=useMemo(()=>municipio?rows.filter(r=>r.ibge===municipio):rows,[rows,municipio]);
 const summary=useMemo(()=>{
   if(!municipio)return payload?.resumo||{total:144,mapeados:0,pendentes:0,percentual:0};
   const total=filtered.length;
   const mapeados=filtered.filter(r=>r.cobertura).length;
   return {total,mapeados,pendentes:total-mapeados,percentual:total?Math.round(mapeados*10000/total)/100:0};
 },[payload,municipio,filtered]);
 const missing=filtered.filter(x=>!x.cobertura);
 const selectedRow=municipio?rows.find(r=>r.ibge===municipio):null;
 const chartRef=useRef(null);
 useEffect(()=>{
  if(!payload||!chartRef.current)return;
  const chart=echarts.init(chartRef.current);
  chart.setOption({
    color:[P.green,P.red],
    tooltip:{trigger:'item'},
    legend:{orient:'vertical',right:0,top:'center',textStyle:{fontSize:12}},
    series:[{type:'pie',radius:['48%','74%'],center:['29%','51%'],
      label:{show:false},
      data:[{name:'Com transmissão identificada',value:summary.mapeados},
            {name:'Sem transmissão identificada',value:summary.pendentes}]
    }]
  });
  const observer=new ResizeObserver(()=>chart.resize());observer.observe(chartRef.current);
  return()=>{observer.disconnect();chart.dispose()};
 },[payload,summary.mapeados,summary.pendentes]);
 return <><header className="top"><span>SESPA <small>│</small> Saúde Digital</span><span>Centralizador Estadual · Painel de Cobertura PEC</span></header>
 <main>
  <div className="heading"><div className="mark">✚</div><div><h1>Cobertura Municipal – PEC e-SUS APS – Pará</h1><p>Centralizador Estadual do e-SUS APS | SESPA – Pará</p></div><div className="institution">★ SESPA　│　GOVERNO DO PARÁ</div></div>
  <section className="filters"><label>Município <MunicipioPesquisa rows={rows} value={municipio} onChange={setMunicipio}/></label><label>Versão PEC <select value={versao} onChange={e=>setVersao(e.target.value)}><option value="">Todas as versões</option>{versoes.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Data inicial <input aria-label="Data inicial de transmissão" type="date" value={dataInicio} max={dataFim||undefined} onChange={e=>setDataInicio(e.target.value)}/></label><label>Data final <input aria-label="Data final de transmissão" type="date" value={dataFim} min={dataInicio||undefined} onChange={e=>setDataFim(e.target.value)}/></label><button onClick={()=>{setVersao('');setDataInicio('');setDataFim('');setMunicipio('')}}>Limpar filtros</button><button onClick={refresh}>↻ Atualizar</button></section>
  {payload?.modo==='demo'&&<div className="warning">AMBIENTE DEMONSTRATIVO — dados simulados. Não utilizar os indicadores para gestão.</div>}
  {error&&<div className="error">{error}</div>}
  {(versao||dataInicio||dataFim)&&<div className="filter-note">Cobertura considerando apenas os últimos recebimentos consolidados que correspondem aos filtros selecionados. Não representa todos os envios históricos do período.</div>}
  {selectedRow&&<div className="filter-note">Município selecionado: <strong>{selectedRow.municipio}</strong> ({selectedRow.ibge}). Os indicadores abaixo representam somente esse município; os demais aparecem em cinza no mapa.</div>}
  <section className="metrics">
   <article><h3>{municipio?'Municípios selecionados':'Total de municípios do Pará'}</h3><strong>{n(summary.total)}</strong><span>{municipio?'Recorte do filtro municipal':'Referência municipal do GeoJSON'}</span></article>
   <article><h3>Municípios mapeados</h3><strong>{n(summary.mapeados)}</strong><span>Com transmissão identificada</span></article>
   <article><h3>Municípios sem registro</h3><strong>{n(summary.pendentes)}</strong><span>Sem transmissão identificada</span></article>
   <article><h3>{municipio?'Cobertura do município':'Cobertura estadual'}</h3><strong>{summary.percentual.toFixed(2).replace('.',',')}%</strong><div className="progress"><i style={{width:summary.percentual+'%'}}/></div><span>Meta de referência: 100%</span></article>
  </section>
  <section className="boards">
    <article className="geo"><div className="map-header"><h2>▱ Cobertura Territorial por Município</h2></div><div className="map-area"><MapaOSM geo={geo} rows={rows} selectedMunicipio={municipio}/></div><footer><span className="dot green"/> Com transmissão　 <span className="dot red"/> Sem transmissão</footer></article>
    <div className="right">
      <article><h2>◷ Situação dos Municípios</h2><div ref={chartRef} className="donut"/></article>
      <article><h2>☑ {municipio?'Situação do Município Selecionado':'Municípios sem Transmissão Identificada ('+missing.length+')'}</h2>
      <div className="table-wrap"><table><thead><tr><th>Código IBGE</th><th>Município</th><th>Situação</th></tr></thead><tbody>
      {(municipio?filtered:missing).map(r=><tr key={r.ibge}><td>{r.ibge}</td><td>{r.municipio}</td><td><span className={r.cobertura?'pill pill-ok':'pill'}>{r.cobertura?'Com transmissão':'Sem transmissão'}</span></td></tr>)}
      </tbody></table></div></article>
    </div>
  </section>
  <p className="foot">Fonte: {payload?.modo==='postgres'?'PostgreSQL Analytics, somente leitura':'Demonstração'} · Última consulta: {lastRefresh?.toLocaleString('pt-BR')||'—'} · GeoJSON: municipios-pa</p>
 </main></>;
}
createRoot(document.getElementById('root')).render(<App/>);
