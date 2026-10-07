"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  position: [number, number];
  label: string;
  sublabel?: string;
  color: string; // hex
  emoji?: string;
}

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers: MapMarker[];
  polyline?: [number, number][];
  polylineColor?: string;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  fitAll?: boolean;
}

function makeIcon(color: string, emoji: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:34px;height:34px;border-radius:50% 50% 50% 4px;
      transform:rotate(-45deg);
      background:${color};
      border:2.5px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:15px;line-height:1">${emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView(markers[0].position, 15);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => m.position));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [markers, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  center = [10.4806, -66.9036],
  zoom = 13,
  markers,
  polyline,
  polylineColor = "#0e9aa7",
  onMapClick,
  className = "h-96 w-full",
  fitAll = true,
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      scrollWheelZoom
      style={{ borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polyline && polyline.length > 1 && (
        <Polyline positions={polyline} pathOptions={{ color: polylineColor, weight: 4, dashArray: "8 8", opacity: 0.85 }} />
      )}
      {markers.map((m) => (
        <Marker key={m.id} position={m.position} icon={makeIcon(m.color, m.emoji || "📍")}>
          <Popup>
            <div className="text-sm font-semibold">{m.label}</div>
            {m.sublabel && <div className="text-xs text-gray-600">{m.sublabel}</div>}
          </Popup>
        </Marker>
      ))}
      {fitAll && <FitBounds markers={markers} />}
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
    </MapContainer>
  );
}
