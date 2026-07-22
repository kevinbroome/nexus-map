import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1200;

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomControl: true,
});

const bounds = L.latLngBounds(
  [0, 0],
  [WORLD_HEIGHT, WORLD_WIDTH],
);

map.setMaxBounds(bounds.pad(0.25));
map.fitBounds(bounds);

const worldBackground = L.rectangle(bounds, {
  color: "#444",
  weight: 1,
  fillColor: "#d8d0b8",
  fillOpacity: 1,
}).addTo(map);

worldBackground.bindTooltip("The currently rather empty world");

map.on("click", (event: L.LeafletMouseEvent) => {
  const x = Math.round(event.latlng.lng);
  const y = Math.round(event.latlng.lat);

  const selectedLocation = document.querySelector<HTMLParagraphElement>(
    "#selected-location",
  );

  if (selectedLocation) {
    selectedLocation.textContent = `Selected: ${x}, ${y}`;
  }
});
