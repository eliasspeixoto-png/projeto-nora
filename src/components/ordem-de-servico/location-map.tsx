
"use client";

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { MapPin } from 'lucide-react';

type LocationMapProps = {
  latitude: number;
  longitude: number;
  clientName: string;
};

// Corrige o problema do ícone padrão do Leaflet não aparecer
const customIcon = new Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
});


export default function LocationMap({ latitude, longitude, clientName }: LocationMapProps) {

  if (typeof window === 'undefined') {
    return null;
  }
  
  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border z-0">
        <MapContainer center={[latitude, longitude]} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude, longitude]} icon={customIcon}>
                <Popup>
                    Finalizado no local do cliente: <br /> <b>{clientName}</b>.
                </Popup>
            </Marker>
        </MapContainer>
    </div>
  );
}

