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
  const pinsRef = useRef(null);

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      zoomSnap: .5,
      zoomDelta: .5,
      wheelPxPerZoomLevel: 100,
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
      pinsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo || !rows.length) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    if (pinsRef.current) map.removeLayer(pinsRef.current);
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

    // Os pins mostram o estado de cobertura por município; não são
    // estabelecimentos CNES nem representam a sede administrativa exata.
    // Para evitar poluição visual no panorama estadual, surgem com zoom >= 7.
    const markers = L.layerGroup().addTo(map);
    pinsRef.current = markers;
    const pins = layer.getLayers().map(polygon => {
      const code = String(polygon.feature?.properties?.CD_MUN ?? '').trim();
      const row = byCode.get(code);
      const name = polygon.feature?.properties?.NM_MUN || row?.municipio || code;
      const point = typeof polygon.getCenter === 'function'
        ? polygon.getCenter() : polygon.getBounds().getCenter();
      const color = row?.cobertura ? COLORS.yes : COLORS.no;
      const marker = L.circleMarker(point, {
        radius: 6, color: '#ffffff', weight: 1.6,
        fillColor: color, fillOpacity: .98
      });
      marker.bindTooltip('<strong>' + esc(name) + '</strong><br>' +
        (row?.cobertura ? 'Com transmissão identificada' : 'Sem transmissão identificada'),
        {direction:'top',offset:[0,-6]});
      marker.on('click', () => {
        map.flyTo(point, Math.max(map.getZoom() + 1.5, 9), {duration:.45});
        marker.openTooltip();
      });
      return {marker,code};
    });
    const atualizaPins = () => {
      const zoom = map.getZoom();
      markers.clearLayers();
      if (zoom < 7 && !selectedMunicipio) return;
      for (const {marker,code} of pins) {
        if (selectedMunicipio && code !== selectedMunicipio) continue;
        marker.setRadius(zoom >= 10 ? 9 : zoom >= 8 ? 7 : 5);
        markers.addLayer(marker);
      }
    };
    map.on('zoomend', atualizaPins);
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
    atualizaPins();
    return () => {
      map.off('zoomend', atualizaPins);
      if (map.hasLayer(markers)) map.removeLayer(markers);
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (pinsRef.current === markers) pinsRef.current = null;
      if (layerRef.current === layer) layerRef.current = null;
    };
  }, [geo,rows,selectedMunicipio]);

  return <div ref={el} className="osm-map" aria-label="Mapa navegável do Pará com cobertura municipal"/>;
}
