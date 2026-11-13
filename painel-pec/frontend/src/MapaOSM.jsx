import React, {useEffect, useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLORS = {yes:'#39a75a', no:'#e85d64', muted:'#bfc8d6'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);

function pinIcon(positive, isUnit=false) {
  const color=positive ? COLORS.yes : COLORS.no;
  return L.divIcon({
    className:'pec-marker'+(isUnit?' pec-marker-unit':''),
    iconSize:[isUnit?26:30,isUnit?36:42],
    iconAnchor:[isUnit?13:15,isUnit?36:42],
    popupAnchor:[0,-36],
    html:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" aria-hidden="true">'+
      '<path d="M18 1C8.5 1 1 8.4 1 18c0 13 17 28.5 17 28.5S35 31 35 18C35 8.4 27.5 1 18 1Z" fill="'+color+'" stroke="#fff" stroke-width="2"/>'+
      '<circle cx="18" cy="17.5" r="7" fill="white"/>'+
      (isUnit?'<path d="M18 13v9M13.5 17.5h9" stroke="'+color+'" stroke-width="2.4" stroke-linecap="round"/>':'')+
      '</svg>'
  });
}

/** Os polígonos são do PARA.geojson; os pins das unidades são coordenadas CNES. */
export default function MapaOSM({geo, rows, selectedMunicipio, unidades=[], selectedUnidade=''}) {
  const el=useRef(null);
  const mapRef=useRef(null);
  const polygonRef=useRef(null);
  const municipioPinsRef=useRef(null);
  const unidadePinsRef=useRef(null);
  const unidadeMarkerByCnesRef=useRef(new Map());

  useEffect(()=>{
    if(!el.current)return;
    const map=L.map(el.current,{
      zoomControl:true,scrollWheelZoom:true,zoomSnap:.5,zoomDelta:.5,
      wheelPxPerZoomLevel:100,preferCanvas:true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      minZoom:3,maxZoom:17
    }).addTo(map);
    map.setView([-3.75,-52.4],6);
    mapRef.current=map;
    const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));
    observer.observe(el.current);
    return()=>{
      observer.disconnect();
      map.remove();
      mapRef.current=null;
      polygonRef.current=null;
      municipioPinsRef.current=null;
      unidadePinsRef.current=null;
      unidadeMarkerByCnesRef.current.clear();
    };
  },[]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!geo||!rows.length)return;
    if(polygonRef.current)map.removeLayer(polygonRef.current);
    if(municipioPinsRef.current)map.removeLayer(municipioPinsRef.current);
    const byCode=new Map(rows.map(row=>[row.ibge,row]));
    const polygons=L.geoJSON(geo,{
      style:feature=>{
        const code=String(feature.properties?.CD_MUN??'').trim();
        const row=byCode.get(code);
        const selected=!selectedMunicipio||code===selectedMunicipio;
        return {
          color:selectedMunicipio&&code===selectedMunicipio?'#17365b':'#fff',
          weight:selectedMunicipio&&code===selectedMunicipio?2.3:.8,
          opacity:1,
          fillColor:!selected?COLORS.muted:(row?.cobertura?COLORS.yes:COLORS.no),
          fillOpacity:selected?.62:.28
        };
      },
      onEachFeature:(feature,polygon)=>{
        const code=String(feature.properties?.CD_MUN??'').trim();
        const row=byCode.get(code);
        const name=feature.properties?.NM_MUN||row?.municipio||code;
        polygon.bindTooltip('<strong>'+esc(name)+'</strong><br>'+
          (row?.cobertura?'Com transmissão identificada':'Sem transmissão identificada')+
          '<br>CNES distintos: '+(row?.cnes??0),{sticky:true});
        polygon.on('mouseover',()=>polygon.setStyle({weight:2,fillOpacity:.82}));
        polygon.on('mouseout',()=>polygons.resetStyle(polygon));
      }
    }).addTo(map);
    polygonRef.current=polygons;

    const layerMunicipios=L.layerGroup().addTo(map);
    municipioPinsRef.current=layerMunicipios;
    const pins=polygons.getLayers().map(polygon=>{
      const code=String(polygon.feature?.properties?.CD_MUN??'').trim();
      const row=byCode.get(code);
      const name=polygon.feature?.properties?.NM_MUN||row?.municipio||code;
      // Ponto representativo do município; NÃO corresponde à sede ou unidade.
      const point=polygon.getBounds().getCenter();
      const marker=L.marker(point,{icon:pinIcon(Boolean(row?.cobertura))});
      marker.bindPopup('<strong>'+esc(name)+'</strong><br>'+
        (row?.cobertura?'Com transmissão identificada':'Sem transmissão identificada'));
      marker.on('click',()=>{
        map.flyTo(point,Math.max(map.getZoom()+1,9),{duration:.45});
      });
      return {code,marker};
    });
    const updatePins=()=>{
      layerMunicipios.clearLayers();
      if(map.getZoom()<7&&!selectedMunicipio)return;
      pins.forEach(({code,marker})=>{
        if(!selectedMunicipio||code===selectedMunicipio)layerMunicipios.addLayer(marker);
      });
    };
    map.on('zoomend',updatePins);
    const bounds=polygons.getBounds();
    if(bounds.isValid()){
      if(selectedMunicipio){
        const target=polygons.getLayers().find(p=>
          String(p.feature?.properties?.CD_MUN??'').trim()===selectedMunicipio);
        if(target)map.fitBounds(target.getBounds(),{padding:[35,35],maxZoom:10,animate:false});
      }else map.fitBounds(bounds,{padding:[18,18],animate:false});
    }
    updatePins();
    return()=>{
      map.off('zoomend',updatePins);
      if(map.hasLayer(layerMunicipios))map.removeLayer(layerMunicipios);
      if(map.hasLayer(polygons))map.removeLayer(polygons);
      if(municipioPinsRef.current===layerMunicipios)municipioPinsRef.current=null;
      if(polygonRef.current===polygons)polygonRef.current=null;
    };
  },[geo,rows,selectedMunicipio]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map)return;
    if(unidadePinsRef.current)map.removeLayer(unidadePinsRef.current);
    unidadeMarkerByCnesRef.current.clear();
    if(!selectedMunicipio||!unidades.length)return;
    const layer=L.layerGroup().addTo(map);
    unidadePinsRef.current=layer;
    for(const unidade of unidades){
      const {latitude,longitude,cnes}=unidade;
      if(typeof latitude!=='number'||typeof longitude!=='number')continue;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
      const marker=L.marker([latitude,longitude],{
        icon:pinIcon(Boolean(unidade.possui_transmissao),true),
        zIndexOffset:500
      });
      const status=unidade.possui_transmissao?'Com transmissão identificada':'Sem transmissão identificada';
      marker.bindPopup('<strong>'+esc(unidade.estabelecimento)+'</strong><br>'+
        'CNES: '+esc(cnes)+'<br>'+status+
        (unidade.ultima_transmissao?'<br>Última transmissão: '+esc(unidade.ultima_transmissao):''));
      marker.addTo(layer);
      unidadeMarkerByCnesRef.current.set(cnes,marker);
    }
    return()=>{
      if(map.hasLayer(layer))map.removeLayer(layer);
      if(unidadePinsRef.current===layer)unidadePinsRef.current=null;
      unidadeMarkerByCnesRef.current.clear();
    };
  },[selectedMunicipio,unidades]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!selectedUnidade)return;
    const unidade=unidades.find(u=>u.cnes===selectedUnidade);
    if(!unidade||unidade.latitude==null||unidade.longitude==null)return;
    const latlng=[unidade.latitude,unidade.longitude];
    map.flyTo(latlng,Math.max(map.getZoom(),13),{duration:.6});
    const marker=unidadeMarkerByCnesRef.current.get(selectedUnidade);
    if(marker)marker.openPopup();
  },[selectedUnidade,unidades]);

  return <div ref={el} className="osm-map"
    aria-label="Mapa navegável do Pará com municípios e unidades CNES georreferenciadas"/>;
}
