// ============================================================
// Great Chaparell Cemetery
// Leaflet Image Tile Map
// ============================================================

const MAP_WIDTH = 10000;
const MAP_HEIGHT = 10000;

const TILE_SIZE = 256;
const MAX_ZOOM = 6;


// ------------------------------------------------------------
// Eigenes CRS für ein normales Bild
// ------------------------------------------------------------

const ImageCRS = L.extend({}, L.CRS.Simple, {

    // X bleibt unverändert.
    // Y wird nach unten gezählt, genau wie bei einem Bild.
    transformation: new L.Transformation(
        1,
        0,
        -1,
        MAP_HEIGHT / Math.pow(2, MAX_ZOOM)
    ),

    scale: function (zoom) {
        return Math.pow(2, zoom);
    },

    zoom: function (scale) {
        return Math.log(scale) / Math.LN2;
    }
});


// ------------------------------------------------------------
// Kartengröße auf Zoom 0
// ------------------------------------------------------------

const scale = Math.pow(2, MAX_ZOOM);

// Anzahl der tatsächlich erzeugten Tiles
const tileColumns = Math.ceil(MAP_WIDTH / TILE_SIZE);
const tileRows = Math.ceil(MAP_HEIGHT / TILE_SIZE);

// Tatsächliche Größe der Tile-Fläche
const width = (tileColumns * TILE_SIZE) / scale;
const height = (tileRows * TILE_SIZE) / scale;


// ------------------------------------------------------------
// Kartengrenzen
// ------------------------------------------------------------

const bounds = [
    [0, 0],
    [height, width]
];


// ------------------------------------------------------------
// Karte
// ------------------------------------------------------------

const map = L.map("map", {

    crs: ImageCRS,

    minZoom: 0,
    maxZoom: MAX_ZOOM,

    zoomControl: true,

    attributionControl: false,

    zoomSnap: 1,
    zoomDelta: 1
});


// ------------------------------------------------------------
// Tiles
// ------------------------------------------------------------

L.tileLayer("tiles/{z}/{x}/{y}.jpg", {

    tileSize: TILE_SIZE,

    minZoom: 0,
    maxZoom: MAX_ZOOM,

    // Keine Kacheln außerhalb der tatsächlichen Kartenfläche anfordern.
    bounds: L.latLngBounds(bounds),

    noWrap: true,

    keepBuffer: 2

}).addTo(map);


// ------------------------------------------------------------
// Startansicht
// ------------------------------------------------------------

map.fitBounds(bounds);

// Für die Belegungsansicht und eventuelle Größenänderungen verfügbar machen.
window.cemeteryMap = map;

// Leaflet soll seine Darstellung an die tatsächliche Größe des Kartenbereichs anpassen.
if ("ResizeObserver" in window) {
    const mapElement = document.getElementById("map");
    const mapResizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
    });
    mapResizeObserver.observe(mapElement);
}
