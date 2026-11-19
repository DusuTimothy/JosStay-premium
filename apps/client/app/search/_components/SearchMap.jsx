"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const JOS_CENTER = [9.8965, 8.8583];

const AREA_CENTRES = {
  "Jos North": [9.928, 8.892],
  "Jos South": [9.812, 8.842],
  Rayfield: [9.846, 8.858],
  Bukuru: [9.8, 8.868],
};

const jitter = (id) => [((id % 5) - 2) * 0.0058, ((id % 7) - 3) * 0.0058];

const priceIcon = (price) =>
  L.divIcon({
    className: "leaflet-price-marker",
    html: `<div style="display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:34px;padding:0 12px;border-radius:999px;background:#3F2159;color:#fff;font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:-.01em;border:2px solid #fff;box-shadow:0 12px 26px -10px rgba(20,10,30,.65);white-space:nowrap;">₦${Math.round(
      price / 1000,
    )}k</div>`,
    iconSize: [62, 38],
    iconAnchor: [31, 19],
    popupAnchor: [0, -20],
  });

function MapViewport({ points }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  useEffect(() => {
    if (!points.length) {
      map.setView(JOS_CENTER, 12);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0].position, 14, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((point) => point.position)), {
      padding: [52, 52],
      maxZoom: 14,
      animate: true,
    });
  }, [map, points]);

  return null;
}

export function SearchMap({ properties = [] }) {
  const points = useMemo(
    () =>
      properties.map((property) => {
        const centre = AREA_CENTRES[property.area] || JOS_CENTER;
        const [dLat, dLng] = jitter(property.id);
        return {
          id: property.id,
          slug: property.slug,
          name: property.name,
          area: property.area,
          price: property.price,
          rating: property.rating,
          position: [centre[0] + dLat, centre[1] + dLng],
        };
      }),
    [properties],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-[#E8EDE6]">
      <MapContainer
        center={JOS_CENTER}
        zoom={12}
        minZoom={9}
        maxZoom={18}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        attributionControl
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapViewport points={points} />
        {points.map((point) => (
          <Marker key={point.id} position={point.position} icon={priceIcon(point.price)}>
            <Popup>
              <div className="min-w-[180px] font-sans">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-plum-600">
                  {point.area}
                </p>
                <p className="mt-1 text-[14px] font-bold leading-snug text-ink">
                  {point.name}
                </p>
                <p className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted">
                  <span>
                    ₦{Number(point.price).toLocaleString("en-NG")}{" "}
                    <span className="text-[10px]">/ night</span>
                  </span>
                  <span className="font-semibold text-ink">★ {point.rating}</span>
                </p>
                <Link
                  href={`/property/${point.slug}`}
                  className="mt-2.5 inline-flex h-8 items-center justify-center rounded-md bg-plum-700 px-3 text-[11px] font-bold text-white"
                >
                  View stay
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[650] inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-ink shadow-card backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-plum-600" />
        Jos, Plateau State
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[650] rounded-md bg-ink/75 px-2.5 py-1.5 text-[10px] font-medium text-white/90 backdrop-blur">
        Sample locations · demo data
      </div>
    </div>
  );
}
