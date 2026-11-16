import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import MapaOSM from './MapaOSM';
import './style.css';

const n=x=>new Intl.NumberFormat('pt-BR').format(x??0);
const DAY=86400000;
const dateISO=d=>{const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)};
const ageDays=value=>value?Math.floor((new Date().setHours(0,0,0,0)-new Date(String(value).slice(0,10)+'T00:00:00').getTime())/DAY):null;
const recency=[{key:'recent',label:'Recepção recente',detail:'Até 7 dias',icon:'✓'},{key:'attention',label:'Atenção',detail:'8 a 30 dias',icon:'!'},{key:'late',label:'Sem recepção recente',detail:'Mais de 30 dias',icon:'×'},{key:'none',label:'Sem recepção identificada',detail:'Sem registro',icon:'∅'}];
const category=row=>{const age=ageDays(row.ultima_transmissao);return !row.cobertura||age===null?'none':age<=7?'recent':age<=30?'attention':'late'};
const receberDataHora=value=>{
  if(!value)return {data:null,hora:null};
    const parts=String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if(!parts)return {data:null,hora:null};
  return {data:parts[3]+'/'+parts[2]+'/'+parts[1],hora:parts[4]?parts[4]+':'+parts[5]:null};
};
function UiIcon({name,size=24}){
 const base={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true};
 const shapes={
  building:<><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M2 9 12 3l10 6M9 21v-7h6v7M7 12h.01M17 12h.01"/></>,
  mapped:<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><path d="m9 10 2 2 4-4"/></>,
  missing:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h3M9 16l6 3m0-3-6 3"/></>,
  coverage:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8M16 4h4v4"/></>,
  map:<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3M13 15h3"/></>,
  alert:<><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  recent:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m6 5 2 2 4-4"/></>,
  attention:<><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  late:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M7.4 18.6 17.7 5.5"/><path d="M4.4 5.5 18.9 19"/></>,
  none:<><path d="M3 9a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 15a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/></>,
  clear:<><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></>,
  reload:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-2"/></>
 };
 return <svg {...base}>{shapes[name]||shapes.alert}</svg>;
}
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
function UnidadePesquisa({municipio,unidades,value,onSelecionar,carregando,erro}){
 const [texto,setTexto]=useState(''),[aberto,setAberto]=useState(false),[busca,setBusca]=useState([]),[buscando,setBuscando]=useState(false),[erroBusca,setErroBusca]=useState(''),[buscaDigitada,setBuscaDigitada]=useState(false);
 const local=useMemo(()=>{const termo=normalizar(texto.trim());return termo?unidades.filter(u=>normalizar(u.estabelecimento+' '+u.cnes).includes(termo)):unidades},[unidades,texto]);
 useEffect(()=>{
   if(!buscaDigitada||!aberto||texto.trim().length<3){setBusca([]);setBuscando(false);setErroBusca('');return}
   const controller=new AbortController();
   const timer=setTimeout(()=>{
     setBuscando(true);
     fetch('/api/unidades/busca?q='+encodeURIComponent(texto.trim()),{signal:controller.signal,cache:'no-store'})
       .then(async r=>{if(!r.ok)throw Error('Falha na pesquisa (HTTP '+r.status+')');return r.json()})
       .then(d=>{setBusca(d.unidades||[]);setErroBusca('')})
       .catch(e=>{if(e.name!=='AbortError')setErroBusca(e.message)})
       .finally(()=>{if(!controller.signal.aborted)setBuscando(false)});
   },350);
   return()=>{clearTimeout(timer);controller.abort()};
 },[buscaDigitada,aberto,texto]);
 useEffect(()=>{if(!value){setTexto('');return}const u=unidades.find(u=>u.cnes===value);if(u)setTexto(u.estabelecimento)},[value,unidades]);
 const escolher=u=>{
   const selecionada=u||null;
   setTexto(selecionada?.estabelecimento||'');
   setBuscaDigitada(false);
   setBusca([]);
   setErroBusca('');
   setBuscando(false);
   // Ao limpar uma unidade, exibir novamente a lista do município já selecionado.
   setAberto(!selecionada&&Boolean(municipio));
   onSelecionar(selecionada);
 };
 const opcoes=buscaDigitada?busca:(municipio?local:[]);
 return <div className="municipio-picker unidade-picker">
  <input type="text" autoComplete="off" role="combobox" aria-autocomplete="list"
    aria-expanded={aberto} aria-controls="unidades-opcoes" aria-label="Pesquisar unidade de saúde"
    value={texto} placeholder="Nome da unidade ou CNES..." onFocus={()=>{setAberto(true);if(!value&&!texto.trim()){setBuscaDigitada(false);setBusca([]);setErroBusca('')}}}
    onBlur={()=>setAberto(false)} onChange={e=>{setTexto(e.target.value);setBuscaDigitada(true);setAberto(true)}}
    onKeyDown={e=>{if(e.key==='Escape')setAberto(false);if(e.key==='Enter'&&aberto&&opcoes.length){e.preventDefault();escolher(opcoes[0])}}}/>
  {(texto||value)&&<button type="button" className="municipio-clear" aria-label="Limpar unidade" onMouseDown={e=>e.preventDefault()} onClick={()=>escolher(null)}>×</button>}
  {aberto&&<div className="municipio-options" id="unidades-opcoes" role="listbox">
    {!municipio&&(!buscaDigitada||texto.trim().length<3)&&<div className="municipio-empty">Digite ao menos 3 caracteres para buscar em todo o Pará.</div>}
    {municipio&&!buscaDigitada&&carregando&&<div className="municipio-empty">Carregando unidades...</div>}
    {municipio&&!buscaDigitada&&erro&&<div className="municipio-empty">{erro}</div>}
    {buscaDigitada&&buscando&&<div className="municipio-empty">Pesquisando unidades...</div>}
    {erroBusca&&<div className="municipio-empty">{erroBusca}</div>}
    {opcoes.map(u=><button type="button" role="option" aria-selected={value===u.cnes} key={(u.municipio_ibge||municipio||'')+'-'+u.cnes}
      onMouseDown={e=>{e.preventDefault();escolher(u)}}>{u.estabelecimento} — CNES {u.cnes}
      {buscaDigitada&&<small> · {u.municipio_nome}</small>}
      {municipio&&!buscaDigitada&&u.latitude==null&&<small> · sem coordenadas</small>}</button>)}
    {!buscando&&(!carregando||buscaDigitada)&&!erroBusca&&(!erro||buscaDigitada)&&opcoes.length===0&&(municipio||(buscaDigitada&&texto.trim().length>=3))&&<div className="municipio-empty">Nenhuma unidade encontrada.</div>}
  </div>}
 </div>;
}
// Calendário de intervalo único: os dois meses são uma janela sincronizada.
// Datas só são aplicadas aos filtros após a confirmação, evitando consultas por clique.
const formatarDataISO=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00')):'Selecione uma data';
const primeiroDiaMes=valor=>{const d=valor?new Date(valor+'T12:00:00'):new Date();return new Date(d.getFullYear(),d.getMonth(),1)};
const isoCalendario=(ano,mes,dia)=>String(ano).padStart(4,'0')+'-'+String(mes+1).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
function CalendarioMensal({mes,inicio,fim,onSelecionar}){
 const ano=mes.getFullYear(),indice=mes.getMonth();
 const primeiroDia=new Date(ano,indice,1).getDay(),totalDias=new Date(ano,indice+1,0).getDate();
 const nomeMes=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(mes);
 const celulas=Array.from({length:primeiroDia+totalDias},(_,i)=>i<primeiroDia?null:i-primeiroDia+1);
 return <section className="calendar-month" aria-label={'Calendário de '+nomeMes}>
  <div className="calendar-month-title">{nomeMes}</div>
  <div className="calendar-days" role="group" aria-label={'Escolher um dia de '+nomeMes}>
   {['Do','2ª','3ª','4ª','5ª','6ª','Sá'].map((dia,i)=><span className="calendar-weekday" key={i} aria-hidden="true">{dia}</span>)}
   {celulas.map((dia,i)=>{
    if(dia===null)return <span key={'vazio-'+i} aria-hidden="true"/>;
    const iso=isoCalendario(ano,indice,dia);
    const extremo=iso===inicio||iso===fim;
    const intermediario=Boolean(inicio&&fim&&iso>inicio&&iso<fim);
    const classes=[extremo?'calendar-day-selected':'',intermediario?'calendar-day-in-range':''].filter(Boolean).join(' ');
    return <button type="button" key={iso} className={classes} aria-pressed={extremo} aria-label={dia+' de '+nomeMes+(intermediario?', dentro do período selecionado':'')} onClick={()=>onSelecionar(iso)}>{dia}</button>;
   })}
  </div>
 </section>;
}
function PeriodoPersonalizado({inicio,fim,aberto,onApply,onCancel}){
 const [rascunhoInicio,setRascunhoInicio]=useState(inicio||'');
 const [rascunhoFim,setRascunhoFim]=useState(fim||'');
 const [mesBase,setMesBase]=useState(()=>primeiroDiaMes(inicio||dateISO(new Date())));
 useEffect(()=>{
  if(!aberto)return;
  setRascunhoInicio(inicio||'');
  setRascunhoFim(fim||'');
  const hoje=new Date(),inicial=primeiroDiaMes(inicio||dateISO(hoje));
  // Sem período prévio, exibir mês anterior e mês atual, como no fluxo anterior.
  setMesBase(inicio?inicial:new Date(hoje.getFullYear(),hoje.getMonth()-1,1));
 },[aberto,inicio,fim]);
 const selecionarDia=iso=>{
  if(!rascunhoInicio||rascunhoFim){setRascunhoInicio(iso);setRascunhoFim('');return}
  if(iso<rascunhoInicio){setRascunhoFim(rascunhoInicio);setRascunhoInicio(iso);return}
  setRascunhoFim(iso);
 };
 const navegar=meses=>setMesBase(anterior=>new Date(anterior.getFullYear(),anterior.getMonth()+meses,1));
 const seguinte=new Date(mesBase.getFullYear(),mesBase.getMonth()+1,1);
 return <div className="custom-period" role="group" aria-label="Selecionar intervalo de recepção de dados">
  <div className="calendar-mode"><span className="calendar-mode-active">Entre</span></div>
  <div className="calendar-range-summary">
   <div><small>Data inicial</small><strong>{formatarDataISO(rascunhoInicio)}</strong></div>
   <span aria-hidden="true">e</span>
   <div><small>Data final</small><strong>{formatarDataISO(rascunhoFim)}</strong></div>
  </div>
  <div className="calendar-range-navigation">
   <button type="button" aria-label="Meses anteriores" onClick={()=>navegar(-1)}>‹</button>
   <span>Escolha o início e o fim no mesmo mês ou entre meses</span>
   <button type="button" aria-label="Próximos meses" onClick={()=>navegar(1)}>›</button>
  </div>
  <div className="custom-period-calendars">
   <CalendarioMensal mes={mesBase} inicio={rascunhoInicio} fim={rascunhoFim} onSelecionar={selecionarDia}/>
   <CalendarioMensal mes={seguinte} inicio={rascunhoInicio} fim={rascunhoFim} onSelecionar={selecionarDia}/>
  </div>
  <div className="custom-period-footer">
   <div><span>Período: <strong>{rascunhoInicio&&rascunhoFim?new Intl.DateTimeFormat('pt-BR').format(new Date(rascunhoInicio+'T12:00:00'))+' a '+new Intl.DateTimeFormat('pt-BR').format(new Date(rascunhoFim+'T12:00:00')):'Selecione as duas datas'}</strong></span><small>Primeiro clique: início. Segundo clique: fim. Terceiro clique: novo intervalo.</small></div>
   <div className="calendar-actions"><button type="button" className="calendar-cancel" onClick={onCancel}>Cancelar</button><button type="button" className="calendar-done" disabled={!rascunhoInicio||!rascunhoFim} onClick={()=>onApply(rascunhoInicio,rascunhoFim)}>Aplicar filtro</button></div>
  </div>
 </div>;
}
function App(){
 const [geo,setGeo]=useState(null),[payload,setPayload]=useState(null),
       [error,setError]=useState(''),[municipio,setMunicipio]=useState(''),
       [lastRefresh,setLastRefresh]=useState(null),[versao,setVersao]=useState(''),
       [versoes,setVersoes]=useState([]),[dataInicio,setDataInicio]=useState(''),
       [dataFim,setDataFim]=useState(''),[periodo,setPeriodo]=useState('all'),
       [unidade,setUnidade]=useState(''),[unidades,setUnidades]=useState([]),
       [carregandoUnidades,setCarregandoUnidades]=useState(false),
       [erroUnidades,setErroUnidades]=useState('');
 const [calendarioAberto,setCalendarioAberto]=useState(false);
 const [atualizando,setAtualizando]=useState(false);
 const [avisoAtualizacao,setAvisoAtualizacao]=useState('');
 // Mostra confirmação temporária apenas em atualizações solicitadas pelo usuário.
 useEffect(()=>{
  if(!avisoAtualizacao)return;
  const timer=setTimeout(()=>setAvisoAtualizacao(''),5000);
  return()=>clearTimeout(timer);
 },[avisoAtualizacao]);
 const periodoAnteriorRef=useRef('all');
 const calendarioContainerRef=useRef(null);
 // Fecha o pop-up sem perder as datas, ao clicar fora ou pressionar Esc.
 useEffect(()=>{
   if(!calendarioAberto)return;
   const fecharFora=event=>{
     if(calendarioContainerRef.current&&!calendarioContainerRef.current.contains(event.target)){setCalendarioAberto(false);setPeriodo(periodoAnteriorRef.current)}
   };
   const fecharEsc=event=>{if(event.key==='Escape'){setCalendarioAberto(false);setPeriodo(periodoAnteriorRef.current)}};
   document.addEventListener('pointerdown',fecharFora);
   document.addEventListener('keydown',fecharEsc);
   return()=>{document.removeEventListener('pointerdown',fecharFora);document.removeEventListener('keydown',fecharEsc)};
 },[calendarioAberto]);
 const refresh=async(manual=false)=>{
  // A atualização automática é silenciosa; o clique manual mostra confirmação.
  if(manual)setAvisoAtualizacao('');
  setAtualizando(true);
  try{
   const params=new URLSearchParams();
   if(versao)params.set('versao',versao);
   if(dataInicio)params.set('data_inicio',dataInicio);
   if(dataFim)params.set('data_fim',dataFim);
   const res=await fetch('/api/cobertura'+(params.size?'?'+params:''),{cache:'no-store'});
   if(!res.ok)throw new Error('Falha na API: '+res.status);
   setPayload(await res.json());setLastRefresh(new Date());setError('');
   if(manual)setAvisoAtualizacao('Dados atualizados com sucesso.');
  }catch(e){
   setAvisoAtualizacao('');
   setError(String(e));
  }finally{
   setAtualizando(false);
  }
 };
 useEffect(()=>{fetch('/PARA.geojson').then(r=>r.json()).then(setGeo).catch(e=>setError(String(e)));fetch('/api/versoes').then(r=>r.ok?r.json():Promise.reject(Error('Falha ao listar versões PEC'))).then(data=>setVersoes(data.versoes)).catch(e=>setError(String(e)));},[]);
 useEffect(()=>{refresh();const id=setInterval(refresh,30*60*1000);return()=>clearInterval(id)},[versao,dataInicio,dataFim]);
 useEffect(()=>{
   setUnidades([]);
   setErroUnidades('');
   if(!municipio){setCarregandoUnidades(false);return;}
   const controller=new AbortController();
   setCarregandoUnidades(true);
   const params=new URLSearchParams({municipio});
   if(versao)params.set('versao',versao);
   if(dataInicio)params.set('data_inicio',dataInicio);
   if(dataFim)params.set('data_fim',dataFim);
   fetch('/api/unidades?'+params.toString(),{signal:controller.signal,cache:'no-store'})
     .then(async response=>{
       if(!response.ok)throw new Error('Não foi possível consultar unidades (HTTP '+response.status+')');
       return response.json();
     })
     .then(data=>setUnidades(data.unidades||[]))
     .catch(e=>{if(e.name!=='AbortError')setErroUnidades(e.message)})
     .finally(()=>{if(!controller.signal.aborted)setCarregandoUnidades(false)});
   return()=>controller.abort();
 },[municipio,versao,dataInicio,dataFim,lastRefresh]);
 const rows=payload?.municipios||[];
 const filtered=useMemo(()=>municipio?rows.filter(r=>r.ibge===municipio):rows,[rows,municipio]);
 // Indicadores executivos permanecem estaduais mesmo com municipio/unidade selecionados.
 const summary=payload?.resumo||{total:144,mapeados:0,pendentes:0,percentual:0};
 const missing=filtered.filter(x=>!x.cobertura);
 const selectedRow=municipio?rows.find(r=>r.ibge===municipio):null;
 const ultimoRecebimento=useMemo(()=>filtered.reduce((latest,row)=>{
   const value=row.ultima_transmissao;
   return value&&(!latest||value>latest)?value:latest;
 },null),[filtered]);
 const ultimoRecebimentoFormatado=receberDataHora(ultimoRecebimento);
 const recebimentoNoRecorte=Boolean(municipio||versao||dataInicio||dataFim);
 const recencia=useMemo(()=>recency.map(c=>{const count=rows.filter(r=>category(r)===c.key).length;return {...c,count,percentage:rows.length?count*100/rows.length:0}}),[rows]);
 const selecionarPeriodo=value=>{
  if(value==='custom'){
   if(periodo!=='custom')periodoAnteriorRef.current=periodo;
   setPeriodo('custom');setCalendarioAberto(true);return;
  }
  periodoAnteriorRef.current=value;
  setPeriodo(value);
  setCalendarioAberto(false);
  if(value==='all'){setDataInicio('');setDataFim('');return}
  const now=new Date();const end=dateISO(now);const days=Number(value);
  const begin=new Date(now);begin.setDate(begin.getDate()-days+1);
  setDataInicio(dateISO(begin));setDataFim(end);
 };
 // Somente a confirmação atualiza os parâmetros efetivos da API e os indicadores.
 const aplicarPeriodo=(inicio,fim)=>{
  setDataInicio(inicio);setDataFim(fim);
  setPeriodo('custom');periodoAnteriorRef.current='custom';
  setCalendarioAberto(false);
 };
 const cancelarPeriodo=()=>{setCalendarioAberto(false);setPeriodo(periodoAnteriorRef.current)};
 return <><header className="top"><span>SESPA <small>│</small> Saúde Digital</span><span>Centralizador Estadual · Painel de Cobertura PEC</span></header>
 <main>
  <div className="heading"><div className="mark">✚</div><div><h1>Cobertura Municipal – PEC e-SUS APS – Pará</h1><p>Centralizador Estadual do e-SUS APS | SESPA – Pará</p></div><div className="institution">★ SESPA　│　GOVERNO DO PARÁ</div></div>
  <section className="filters"><label>Município <MunicipioPesquisa rows={rows} value={municipio} onChange={codigo=>{setMunicipio(codigo);setUnidade('')}}/></label><label>Unidade de Saúde <UnidadePesquisa municipio={municipio} unidades={unidades} value={unidade} carregando={carregandoUnidades} erro={erroUnidades} onSelecionar={u=>{if(!u){setUnidade('');return}if(u.municipio_ibge&&u.municipio_ibge!==municipio)setMunicipio(u.municipio_ibge);setUnidade(u.cnes)}}/></label><label>Versão PEC <select value={versao} onChange={e=>setVersao(e.target.value)}><option value="">Todas as versões</option>{versoes.map(v=><option key={v} value={v}>{v}</option>)}</select></label><div className="period-control" ref={calendarioContainerRef}>
    <label className="period-filter">Data da Recepção
      <select aria-label="Data da Recepção" aria-expanded={periodo==='custom'&&calendarioAberto} aria-controls="calendario-periodo" value={periodo} onClick={()=>{if(periodo==='custom')setCalendarioAberto(true)}} onChange={e=>selecionarPeriodo(e.target.value)}><option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="custom">Personalizado</option></select>
    </label>
    {periodo==='custom'&&dataInicio&&dataFim&&<span className="period-selected-summary" title={'Período aplicado: '+dataInicio+' a '+dataFim}><UiIcon name="calendar" size={15}/>{dataInicio.slice(8,10)+'/'+dataInicio.slice(5,7)+'/'+dataInicio.slice(0,4)} a {dataFim.slice(8,10)+'/'+dataFim.slice(5,7)+'/'+dataFim.slice(0,4)}</span>}
    {periodo==='custom'&&<div id="calendario-periodo" className={'calendar-popover'+(calendarioAberto?' calendar-popover-open':'')} aria-hidden={!calendarioAberto}>
      <PeriodoPersonalizado inicio={dataInicio} fim={dataFim} aberto={calendarioAberto} onApply={aplicarPeriodo} onCancel={cancelarPeriodo}/>
    </div>}
  </div><div className="filter-actions"><button type="button" className="filter-icon-button" aria-label="Limpar filtros" title="Limpar filtros" onClick={()=>{setVersao('');setDataInicio('');setDataFim('');setPeriodo('all');periodoAnteriorRef.current='all';setCalendarioAberto(false);setMunicipio('');setUnidade('')}}><UiIcon name="clear" size={22}/></button><button type="button" className={'filter-icon-button refresh-button'+(atualizando?' refresh-button-loading':'')} aria-label={atualizando?'Atualizando dados':'Atualizar dados'} title={atualizando?'Atualizando dados...':'Atualizar dados'} disabled={atualizando} onClick={()=>refresh(true)}><span className="refresh-icon"><UiIcon name="reload" size={22}/></span></button></div></section>
  {avisoAtualizacao&&<div className="refresh-success" role="status" aria-live="polite"><UiIcon name="mapped" size={18}/>{avisoAtualizacao}</div>}
  {payload?.modo==='demo'&&<div className="warning">AMBIENTE DEMONSTRATIVO — dados simulados. Não utilizar os indicadores para gestão.</div>}
  {error&&<div className="error">{error}</div>}
  {erroUnidades&&<div className="error">Unidades de Saúde: {erroUnidades}. O mapa municipal continua disponível.</div>}
  {(versao||dataInicio||dataFim)&&<div className="filter-note">Cobertura considerando apenas os últimos dados recepcionados e consolidados que correspondem aos filtros selecionados. Não representa todos os envios históricos do período.</div>}
  {selectedRow&&<div className="filter-note">Município selecionado: <strong>{selectedRow.municipio}</strong> ({selectedRow.ibge}). {unidades.length?'Unidades cadastradas: '+unidades.length+'. ':''}Selecione uma unidade para localizar seu ponto no mapa. As cores indicam recepção de dados identificada na Analytics, não a situação cadastral do CNES.</div>}
  {unidade&&unidades.find(u=>u.cnes===unidade)?.latitude==null&&<div className="filter-note">Esta unidade não possui coordenadas geográficas válidas no cadastro. Não é possível localizar seu pin com precisão.</div>}
  <section className="metrics">
   <article className="metric-total"><span className="metric-icon"><UiIcon name="building" size={28}/></span><div><h3>Municípios</h3><strong>{n(summary.total)}</strong><span>Referência estadual (IBGE)</span></div></article>
   <article className="metric-mapped"><span className="metric-icon"><UiIcon name="mapped" size={28}/></span><div><h3>Com recepção</h3><strong>{n(summary.mapeados)}</strong><span>Com dados recepcionados</span></div></article>
   <article className="metric-missing"><span className="metric-icon"><UiIcon name="missing" size={28}/></span><div><h3>Sem recepção</h3><strong>{n(summary.pendentes)}</strong><span>Sem dados recepcionados na Analytics</span></div></article>
   <article className="metric-coverage"><span className="metric-icon"><UiIcon name="coverage" size={28}/></span><div><h3>Cobertura</h3><strong>{summary.percentual.toFixed(2).replace('.',',')}%</strong><div className="progress"><i style={{width:summary.percentual+'%'}}/></div><span>Meta de referência: 100%</span></div></article>
  </section>
  <section className="boards">
    <article className="geo"><div className="map-header"><h2 className="section-heading"><span className="section-icon section-icon-map"><UiIcon name="map" size={25}/></span>Cobertura Territorial por Município</h2></div><div className="map-area"><MapaOSM geo={geo} rows={rows} selectedMunicipio={municipio} unidades={unidades} selectedUnidade={unidade}/></div><footer><span className="dot green"/> Com recepção de dados　 <span className="dot red"/> Sem recepção de dados</footer></article>
    <div className="right">
      <article className="recency-panel"><h2 className="section-heading"><span className="section-icon section-icon-recency"><UiIcon name="calendar" size={25}/></span>Situação dos Municípios por Recência da Recepção de Dados</h2><div className="recency-grid">{recencia.map(c=><div key={c.key} className={'recency-card recency-'+c.key}><span className="recency-icon"><UiIcon name={c.key} size={25}/></span><div className="recency-label"><strong>{c.label}</strong><small>{c.detail}</small></div><div className="recency-count"><strong>{n(c.count)}</strong><small>{c.percentage.toFixed(2).replace('.',',')}%</small></div></div>)}</div></article>
      <article className="municipality-table-panel">
        <h2 className="section-heading"><span className="section-icon section-icon-alert"><UiIcon name="alert" size={25}/></span>{municipio?'Situação do Município Selecionado':'Municípios sem Recepção de Dados Identificada ('+missing.length+')'}</h2>
        <div className="table-wrap"><table><thead><tr><th>Código IBGE</th><th>Município</th><th>Situação</th><th>Data da última recepção</th><th>Hora da última recepção</th></tr></thead><tbody>
        {(municipio?filtered:missing).map(r=>{
          const recebido=receberDataHora(r.ultima_transmissao);
          return <tr key={r.ibge}><td>{r.ibge}</td><td>{r.municipio}</td><td><span className={r.cobertura?'pill pill-ok':'pill pill-no-receipt'}>{r.cobertura?'Dados recepcionados':'Sem recepção de dados'}</span></td><td>{recebido.data||<span className="no-data">Sem dados</span>}</td><td>{recebido.hora||<span className="no-data">Sem dados</span>}</td></tr>;
        })}
        </tbody></table></div>
      </article>
    </div>
  </section>
  <p className="foot">Fonte: {payload?.modo==='postgres'?'PostgreSQL Analytics, somente leitura':'Demonstração'} · {recebimentoNoRecorte?'Última recepção de dados no recorte':'Última recepção de dados na Analytics'}: {ultimoRecebimentoFormatado.data?(ultimoRecebimentoFormatado.data+(ultimoRecebimentoFormatado.hora?' às '+ultimoRecebimentoFormatado.hora:'')):<span className="no-data">Sem dados</span>} · GeoJSON: municipios-pa · <a href="https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp" target="_blank" rel="noopener noreferrer">CNES - Última atualização: 14/10/26</a> · <a href="https://pec.centralizador.saude.pa.gov.br" target="_blank" rel="noopener noreferrer">Centralizador Estadual</a></p>
 </main></>;
}
createRoot(document.getElementById('root')).render(<App/>);
