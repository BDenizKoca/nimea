// map/js/terrain.js

(function(window) {
    'use strict';

    let bridge = {};
    let terrainLayer = null;

    function initTerrainModule(nimeaBridge) {
        bridge = nimeaBridge;
        if (!bridge) {
            console.error("Terrain module requires the global Nimea bridge.");
            return;
        }

        bridge.terrainModule = {
            renderTerrain,
            getTerrainAsGeoJSON,
        };

        // Only render terrain if in DM mode
        if (bridge.state.isDmMode) {
            renderTerrain();
        }
    }

    function renderTerrain() {
        if (!bridge.state.isDmMode) {
            return;
        }

        if (terrainLayer) {
            bridge.map.removeLayer(terrainLayer);
        }

        terrainLayer = L.geoJSON(bridge.state.terrain, {
            style: function(feature) {
                const kind = feature.properties.kind;
                switch (kind) {
                    case 'road':
                        return { color: "#6a8caf", weight: 3, opacity: 0.8 }; // A solid, thicker blue-grey for roads
                    case 'difficult':
                        return { color: "#a0522d", weight: 2, opacity: 0.7, fillColor: "#a0522d", fillOpacity: 0.2, dashArray: '8, 8' }; // A dashed, earthy brown for difficult terrain
                    case 'forest':
                        return { color: "#228B22", weight: 2, opacity: 0.7, fillColor: "#228B22", fillOpacity: 0.3, dashArray: '4, 8' }; // Forest green with different dash pattern
                    case 'unpassable':
                        return { color: "#c0392b", weight: 2, opacity: 0.8, fillColor: "#c0392b", fillOpacity: 0.4 }; // A bold red for unpassable areas
                    default:
                        return { color: "#cccccc", weight: 1, opacity: 0.5 };
                }
            },
            onEachFeature: function (feature, layer) {
                layer.on('click', () => {
                    // Optional: show info or editing tools for the terrain feature
                });
            }
        }).addTo(bridge.map);
    }

    function getTerrainAsGeoJSON() {
        const geojson = {
            type: 'FeatureCollection',
            features: []
        };
        if (terrainLayer) {
            terrainLayer.eachLayer(layer => {
                const feature = layer.toGeoJSON();
                // Ensure properties are preserved
                if (layer.feature && layer.feature.properties) {
                    feature.properties = layer.feature.properties;
                }
                geojson.features.push(feature);
            });
        }
        return geojson;
    }

    window.__nimea_terrain_init = initTerrainModule;

})(window);
