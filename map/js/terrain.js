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
        
        console.log("Terrain module initialized.");
    }

    function renderTerrain() {
        if (!bridge.state.isDmMode) {
            console.log("Not in DM mode, skipping terrain rendering.");
            return;
        }

        if (terrainLayer) {
            bridge.map.removeLayer(terrainLayer);
        }

        terrainLayer = L.geoJSON(bridge.state.terrain, {
            style: function(feature) {
                const kind = feature.properties.kind;
                switch (kind) {
                    case 'road':      return { color: "#0000ff", weight: 2, opacity: 0.7 };
                    case 'unpassable':return { color: "#ff0000", weight: 1, opacity: 0.5, fillOpacity: 0.2 };
                    case 'difficult': return { color: "#ffa500", weight: 1, opacity: 0.5, dashArray: '5, 5' };
                    default:          return { color: "#cccccc", weight: 1, opacity: 0.5 };
                }
            },
            onEachFeature: function (feature, layer) {
                layer.on('click', () => {
                    // Optional: show info or editing tools for the terrain feature
                    console.log('Clicked on terrain:', feature.properties);
                });
            }
        }).addTo(bridge.map);

        console.log('Terrain rendered for DM.');
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
