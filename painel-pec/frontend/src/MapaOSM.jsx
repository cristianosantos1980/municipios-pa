import React, {useEffect, useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLORS = {yes:'#39a75a', no:'#e85d64', muted:'#bfc8d6'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);

/**
 * OpenStreetMap como camada de fundo; polígonos dos 144 municípios são
 * carregados exclusivamente do GeoJSON versionado do projeto.
 */
export default function MapaOSM({geo, rows, selectedMunicipio}) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, {
      zoomControl: true,
      scrollWheelZoom: false, // Evita zoom involuntário ao rolar o painel
      preferCanvas: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      minZoom: 3,
      maxZoom: 17
    }).addTo(map);
    map.setView([-3.75, -52.4], 6);
    mapRef.current = map;
    // Leaflet exige reavaliar as dimensões após o componente ser montado.
    const observer = new ResizeObserver(() => map.invalidateSize({pan:false}));
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !rows.length) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    const byCode = new Map(rows.map(row => [row.ibge, row]));
    const layer = L.geoJSON(geo, {
      style: feature => {
        const code = String(feature.properties?.CD_MUN ?? '').trim();
        const row = byCode.get(code);
        const selected = !selectedMunicipio || code === selectedMunicipio;
        return {
          color: selectedMunicipio && code === selectedMunicipio ? '#133c69' : '#ffffff',
          weight: selectedMunicipio && code === selectedMunicipio ? 2.3 : .8,
          opacity: 1,
          fillColor: !selected ? COLORS.muted : row?.cobertura ? COLORS.yes : COLORS.no,
          fillOpacity: selected ? .63 : .32
        };
      },
      onEachFeature: (feature, polygon) => {
        const code = String(feature.properties?.CD_MUN ?? '').trim();
        const row = byCode.get(code);
        const name = feature.properties?.NM_MUN || row?.municipio || code;
        const status = row?.cobertura ? 'Com transmissão identificada' : 'Sem transmissão identificada';
        polygon.bindTooltip('<strong>' + esc(name) + '</strong><br>' +
          esc(status) + '<br>CNES distintos: ' + (row?.cnes ?? 0), {sticky:true});
        polygon.on('mouseover', () => polygon.setStyle({weight:2,fillOpacity:.85}));
        polygon.on('mouseout', () => layer.resetStyle(polygon));
      }
    }).addTo(map);
    layerRef.current = layer;
    const bounds=layer.getBounds();
    if (bounds.isValid()) {
      if (selectedMunicipio) {
        const target = layer.getLayers().find(x =>
          String(x.feature?.properties?.CD_MUN ?? '').trim() === selectedMunicipio
        );
        if (target) map.fitBounds(target.getBounds(), {padding:[35,35],maxZoom:10,animate:false});
      } else {
        map.fitBounds(bounds,{padding:[18,18],animate:false});
      }
    }
    return () => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (layerRef.current === layer) layerRef.current = null;
    };
  }, [geo,rows,selectedMunicipio]);

  return <div ref={el} className="osm-map" aria-label="Mapa navegável do Pará com cobertura municipal"/>;
}
