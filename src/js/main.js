var map = L.map('map', {
    zoom: 9,
    minZoom: 7,      // (optional) prevents zooming in beyond level 19
    center: L.latLng([46.14, 25.51]), // Covasna/Harghita region, Romania (Persani Mts / NW corner survey area)
    attributionControl: true,
    contextmenu: true,
    contextmenuWidth: 180,
    contextmenuItems: [{
        text: 'Copy coordinates (Lat, Long)',
        callback: copyCoordinates
    }],
    fullscreenControl: true,
    fullscreenControlOptions: {
        position: 'topleft',
    },
});

function copyCoordinates(event) {
    const coordinates = `${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(coordinates)
            .then(function () {
                notification.success('Copied', coordinates);
            })
            .catch(function () {
                copyCoordinatesFallback(coordinates);
            });
        return;
    }

    copyCoordinatesFallback(coordinates);
}

function copyCoordinatesFallback(coordinates) {
    const textArea = document.createElement('textarea');
    textArea.value = coordinates;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        if (document.execCommand('copy')) {
            notification.success('Copied', coordinates);
        } else {
            notification.alert('Copy failed', 'Unable to copy coordinates');
        }
    } catch (error) {
        notification.alert('Copy failed', 'Unable to copy coordinates');
    }

    document.body.removeChild(textArea);
}

L.control.locate().addTo(map);

map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet ' + L.version + '</a>');

map.addControl(new L.Control.LinearMeasurement({
    unitSystem: 'metric',
    color: '#FF0080',
    type: 'line'
}));

// var hash = new L.Hash(map);

var notification = L.control
    .notifications({
        className: 'pastel',
        timeout: 5000,
        position: 'topleft',
        closable: true,
        dismissable: true,
    })
    .addTo(map);

L.Control.geocoder({ position: "topleft", showResultIcons: true }).addTo(map);

L.Control.betterFileLayer({
    fileSizeLimit: 60240, // File size limit in kb (10 MB)),
    text: { // If you need translate
        title: "Import a file (Max 60 MB)", // Plugin Button Text
    },
}).addTo(map);


L.control.scale(
    {
        imperial: false,
    }).addTo(map);


// var browserControl = L.control.browserPrint({ position: 'topleft', title: 'Print Map' }).addTo(map);

map.on("bfl:layerloaded", function () { notification.success('Success', 'Data loaded successfully'); })
map.on("bfl:layerloaderror", function () { notification.alert('Error', 'Unable to load file'); })
map.on("bfl:filenotsupported", function () { notification.alert('Error', 'File type not supported'); })
map.on("bfl:layerisempty", function () { notification.warning('Error', 'No features in file'); })
map.on("bfl:filesizelimit", function () { notification.alert('Error', 'Maximun file size allowed is 60 MB'); })


var routingControl = null;


L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var layers = [];
for (var providerId in providers) {
    layers.push(providers[providerId]);
}

//  Add navigation
map.on('popupopen', function (e) {
    const link = e.popup._contentNode.querySelector('.navigate-link');
    if (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();

            const lat = parseFloat(this.dataset.lat);
            const lng = parseFloat(this.dataset.lng);
            const destination = L.latLng(lat, lng);

            if (routingControl !== null) {
                map.removeControl(routingControl);
            }

            navigator.geolocation.getCurrentPosition(function (pos) {
                const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

                routingControl = L.Routing.control({
                    waypoints: [
                        userLatLng,
                        destination
                    ],
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: {
                        styles: [
                            {
                                color: '#0077ff',      // route color
                                weight: 4,             // line thickness
                                opacity: 0.8,
                                dashArray: '8, 8'      // ✅ dashed line: 8px dash, 8px gap
                            }
                        ]
                    },
                    createMarker: () => null  // optional: no default markers
                }).addTo(map);

            }, function (err) {
                alert("Geolocation failed: " + err.message);
            });
        });
    }
});


var ctrl = L.control.iconLayers(layers).addTo(map);


function addTouchTarget(layer, latlng, popupContent) {
    const touchTarget = L.circleMarker(latlng, {
        radius: 14,
        stroke: false,
        fill: true,
        fillColor: '#000',
        fillOpacity: 0,
        interactive: true,
        bubblingMouseEvents: false
    });

    touchTarget.bindPopup(popupContent);
    touchTarget.on('click', function () {
        layer.openPopup();
    });

    return touchTarget;
}

function getVisiblePointLayer(layer) {
    return layer.getLayers ? layer.getLayers()[1] : layer;
}

function getFeatureLatLng(layer) {
    return getVisiblePointLayer(layer).getLatLng();
}

function openFeaturePopup(layer) {
    getVisiblePointLayer(layer).openPopup();
}

function createSiteLayer(data, options) {
    const settings = Object.assign({ color: '#e31a1c', radius: 6, label: 'Site' }, options || {});
    return L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            const visibleMarker = L.circleMarker(latlng, {
                radius: settings.radius,
                fillColor: settings.color,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.85
            });
            const name = (feature.properties && feature.properties.Name) || settings.label;
            if (settings.showLabels) {
                visibleMarker.bindTooltip(name, { permanent: true, direction: 'top', className: 'mt-label' });
            }
            return L.layerGroup([addTouchTarget(visibleMarker, latlng, ""), visibleMarker]);
        },
        onEachFeature: function (feature, layer) {
            const visibleMarker = getVisiblePointLayer(layer);
            const latLng = visibleMarker.getLatLng();
            const name = (feature.properties && feature.properties.Name) || settings.label;
            const description = feature.properties && (feature.properties.description || feature.properties.descriptio);

            let popupContent = `<b>${settings.label}:</b> ${name}<br>`;
            if (description) {
                popupContent += `${description}<br>`;
            }
            popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
            popupContent += `<a href="#" class="navigate-link" data-lat="${latLng.lat}" data-lng="${latLng.lng}">📍 Navigate here</a>`;

            layer.eachLayer(function (targetLayer) {
                targetLayer.bindPopup(popupContent);
            });
        }
    });
}

function createXSiteLayer(data, options) {
    const settings = Object.assign({ color: '#000', label: 'Site' }, options || {});
    return L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'mt-x-marker',
                    html: `<span style="color:${settings.color};">&times;</span>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            });
            if (settings.showLabels) {
                const name = (feature.properties && feature.properties.Name) || settings.label;
                marker.bindTooltip(name, { permanent: true, direction: 'top', className: 'mt-label' });
            }
            return marker;
        },
        onEachFeature: function (feature, layer) {
            const latLng = layer.getLatLng();
            const name = (feature.properties && feature.properties.Name) || settings.label;
            const description = feature.properties && (feature.properties.description || feature.properties.descriptio);

            let popupContent = `<b>${settings.label}:</b> ${name}<br>`;
            if (description) {
                popupContent += `${description}<br>`;
            }
            popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
            popupContent += `<a href="#" class="navigate-link" data-lat="${latLng.lat}" data-lng="${latLng.lng}">📍 Navigate here</a>`;

            layer.bindPopup(popupContent);
        }
    });
}

// Status overlays: completed/running sites are looked up by exact "Name" (e.g. "A01",
// "P36") across the planned regional (NW corner) and planned Persani site collections.
// Those same sites are excluded from the underlying layers below so a site only ever
// shows once, as its status marker rather than its original planned marker.
var siteSourceCollections = [plannedRegionalNW, plannedPersani];
var statusSiteNames = (completedSites || []).concat(runningSites || []);

function findSiteFeatureByName(name, collections) {
    const target = String(name).trim();
    for (const collection of collections) {
        const features = (collection && collection.features) || [];
        for (const feature of features) {
            const featureName = feature.properties && feature.properties.Name;
            if (!featureName) continue;
            if (String(featureName).trim() === target) {
                return feature;
            }
        }
    }
    return null;
}

function excludeSitesByName(data, names) {
    const excluded = new Set((names || []).map(function (n) { return String(n).trim(); }));
    if (!excluded.size || !data || !data.features) return data;
    return Object.assign({}, data, {
        features: data.features.filter(function (feature) {
            const name = feature.properties && feature.properties.Name;
            return !excluded.has(name ? String(name).trim() : '');
        })
    });
}

// Create site layers
// Planned MT sites: circles (blue = NW corner regional grid, orange = Persani), names always visible
var plannedRegionalNWLayer = createSiteLayer(excludeSitesByName(plannedRegionalNW, statusSiteNames), { color: '#1f78b4', radius: 7, label: 'Planned Site (NW Corner)', showLabels: true });
var plannedPersaniLayer = createSiteLayer(excludeSitesByName(plannedPersani, statusSiteNames), { color: '#ff7f00', radius: 7, label: 'Planned Site (Persani)', showLabels: true });

// Other MT site datasets: X symbols, each a different color
var ciomadulSitesLayer = createXSiteLayer(ciomadulSites, { color: '#6a3d9a', label: 'Ciomadul Existing MT Data' });
var installedSites2022Layer = createXSiteLayer(installedSites2022, { color: '#33a02c', label: 'Installed Site (2022)' });
var installedBadSites2022Layer = createXSiteLayer(installedBadSites2022, { color: '#e31a1c', label: 'Installed Site - Issue (2022)' });

function createStatusSiteLayer(names, collections, options) {
    const settings = Object.assign({ color: '#000', radius: 8, label: 'Site' }, options || {});
    const layer = L.layerGroup();

    (names || []).forEach(function (name) {
        const feature = findSiteFeatureByName(name, collections);
        if (!feature) {
            console.warn(settings.label + ': no matching site found for name ' + name);
            return;
        }

        const coords = feature.geometry.coordinates;
        const latlng = L.latLng(coords[1], coords[0]);
        const featureName = feature.properties.Name;

        const visibleMarker = L.circleMarker(latlng, {
            radius: settings.radius,
            fillColor: settings.color,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        });

        let popupContent = `<b>${settings.label}:</b> ${featureName}<br>`;
        popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;
        popupContent += `<a href="#" class="navigate-link" data-lat="${latlng.lat}" data-lng="${latlng.lng}">📍 Navigate here</a>`;

        visibleMarker.bindPopup(popupContent);

        layer.addLayer(addTouchTarget(visibleMarker, latlng, popupContent));
        layer.addLayer(visibleMarker);
    });

    return layer;
}

var completedSitesLayer = createStatusSiteLayer(completedSites, siteSourceCollections, { color: '#888888', radius: 8, label: 'Completed Site' });
var runningSitesLayer = createStatusSiteLayer(runningSites, siteSourceCollections, { color: '#ffe119', radius: 8, label: 'Running Site' });

function countMatchedSites(names, collections) {
    return (names || []).reduce(function (count, name) {
        return count + (findSiteFeatureByName(name, collections) ? 1 : 0);
    }, 0);
}

(function updateSiteStatsBar() {
    // Total is counted by unique site name across the planned regional (NW corner)
    // and planned Persani collections (each site appears in exactly one collection).
    const uniqueSiteNumbers = new Set();
    siteSourceCollections.forEach(function (collection) {
        ((collection && collection.features) || []).forEach(function (feature) {
            const name = feature.properties && feature.properties.Name;
            if (name) uniqueSiteNumbers.add(String(name).trim());
        });
    });
    const totalCount = uniqueSiteNumbers.size;
    const completedCount = countMatchedSites(completedSites, siteSourceCollections);
    const runningCount = countMatchedSites(runningSites, siteSourceCollections);
    const remainingCount = Math.max(totalCount - completedCount - runningCount, 0);

    const statValues = {
        statTotal: totalCount,
        statRunning: runningCount,
        statCompleted: completedCount,
        statRemaining: remainingCount
    };

    Object.keys(statValues).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = statValues[id];
    });

    // Just for fun: a one-time, dismissable "halfway there" toast once completed sites
    // cross 50%. Doesn't block anything - it's a notification like any other, and won't
    // reappear on reload within the same tab.
    if (totalCount > 0 && completedCount / totalCount >= 0.5) {
        let alreadyCelebrated = false;
        try {
            alreadyCelebrated = sessionStorage.getItem('mt-halfway-celebrated') === '1';
        } catch (e) { /* sessionStorage unavailable - just show it */ }

        if (!alreadyCelebrated) {
            notification.success(
                'Halfway there!',
                `<div class="celebration-row">
                    <span class="celebration-emoji">🎉</span><span class="celebration-emoji">🎊</span><span class="celebration-emoji">🥳</span><span class="celebration-emoji">🎊</span><span class="celebration-emoji">🎉</span>
                </div><div>${completedCount} of ${totalCount} sites completed - nice work!</div>`,
                { timeout: 8000 }
            );
            try { sessionStorage.setItem('mt-halfway-celebrated', '1'); } catch (e) { /* ignore */ }
        }
    }
})();

function normalizeSearchText(value) {
    return String(value || "").trim().toLowerCase();
}

function createSiteSearchControl(siteLayers, options) {
    const settings = Object.assign({
        label: 'Search sites',
        layerName: 'site',
        datalistId: 'site-search-options'
    }, options || {});
    const layers = Array.isArray(siteLayers) ? siteLayers : [siteLayers];
    const stations = [];

    layers.forEach(function (siteLayer) {
        siteLayer.eachLayer(function (layer) {
            const name = layer.feature && layer.feature.properties && layer.feature.properties.Name;
            if (name) {
                stations.push({
                    name: name,
                    key: normalizeSearchText(name),
                    layer: layer,
                    siteLayer: siteLayer
                });
            }
        });
    });

    const SiteSearchControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar mt-search-control');
            const form = L.DomUtil.create('form', 'mt-search-form', container);
            const input = L.DomUtil.create('input', 'mt-search-input', form);
            const datalist = L.DomUtil.create('datalist', '', form);
            const button = L.DomUtil.create('button', 'mt-search-button', form);

            datalist.id = settings.datalistId;
            input.type = 'search';
            input.placeholder = settings.label;
            input.setAttribute('aria-label', 'Search ' + settings.layerName);
            input.setAttribute('list', datalist.id);
            button.type = 'submit';
            button.title = 'Search ' + settings.layerName;
            button.setAttribute('aria-label', 'Search ' + settings.layerName);
            button.innerHTML = '<i class="fa fa-search" aria-hidden="true"></i>';

            stations.forEach(function (station) {
                const option = L.DomUtil.create('option', '', datalist);
                option.value = station.name;
            });

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            L.DomEvent.on(button, 'click', function (event) {
                if (!container.classList.contains('is-expanded')) {
                    L.DomEvent.preventDefault(event);
                    container.classList.add('is-expanded');
                    input.focus();
                }
            });

            L.DomEvent.on(form, 'submit', function (event) {
                L.DomEvent.preventDefault(event);

                const query = normalizeSearchText(input.value);
                if (!query) {
                    container.classList.add('is-expanded');
                    input.focus();
                    return;
                }

                const match = stations.find(function (station) {
                    return station.key === query;
                }) || stations.find(function (station) {
                    return station.key.includes(query);
                });

                if (!match) {
                    notification.warning('Not found', 'No ' + settings.layerName + ' matches "' + input.value + '"');
                    return;
                }

                if (!map.hasLayer(match.siteLayer)) {
                    match.siteLayer.addTo(map);
                }

                const latLng = getFeatureLatLng(match.layer);
                map.setView(latLng, Math.max(map.getZoom(), 14), {
                    animate: true
                });
                openFeaturePopup(match.layer);
            });

            return container;
        }
    });

    return new SiteSearchControl();
}

L.easyButton({
    states: [{
        stateName: 'clearRoute',
        icon: 'fa-times-circle', // Font Awesome icon
        title: 'Clear Route',
        onClick: function (btn, map) {
            if (routingControl !== null) {
                map.removeControl(routingControl);
                routingControl = null;
            }
        }
    }]
}).addTo(map);

const popupTitle = (title) => `<div style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid #aaa; padding-bottom:2px;">${title}</div>`;

const powerMajorLayer = L.geoJSON(powerMajor, {
    style: {
        color: '#e31a1c',
        weight: 3
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Major Powerline')}<b>Name:</b> ${p.name || "-"}<br><b>Voltage:</b> ${p.voltage || "-"} V<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const powerMinorLayer = L.geoJSON(powerMinor, {
    style: {
        color: '#1f78b4',
        weight: 2
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Minor Powerline')}<b>Name:</b> ${p.name || "-"}<br><b>Voltage:</b> ${p.voltage || "-"} V<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const powerplantsLayer = L.geoJSON(powerplants, {
    style: {
        color: '#333',
        weight: 1,
        fillColor: '#fdbf6f',
        fillOpacity: 0.6
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const name = p.name || p['name:is'] || p['name:en'] || 'Power plant';
        layer.bindPopup(`${popupTitle('Power Plant')}<b>Name:</b> ${name}<br><b>Type:</b> ${p.power || "-"}<br><b>Source:</b> ${p['plant:source'] || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const windTurbineIcon = L.icon({
    iconUrl: 'src/assets/wind-turbine.svg',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
});

const windmillLayer = L.geoJSON(windmill, {
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: windTurbineIcon });
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`${popupTitle('Wind Turbine')}<b>Manufacturer:</b> ${p.manufacturer || "-"}<br><b>Model:</b> ${p.model || "-"}<br><b>Hub height:</b> ${p['height:hub'] || p.height || "-"}<br><b>Rotor diameter:</b> ${p['rotor:diameter'] || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

const residentialAreasLayer = L.geoJSON(residentialAreas, {
    style: {
        color: '#999',
        weight: 1,
        fillColor: '#ccc',
        fillOpacity: 0.35
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const name = p.name || p['name:ro'] || p['name:hu'] || 'Residential area';
        layer.bindPopup(`${popupTitle('Residential Area')}<b>Name:</b> ${name}<br><b>Type:</b> ${p.place || p.landuse || "-"}<br><b>Population:</b> ${p.population || "-"}`);
    }
});

const railwayLayer = L.geoJSON(railway, {
    style: {
        color: '#4d4d4d',
        weight: 2,
        dashArray: '8, 4'
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const name = p.name || p['name:ro'] || 'Railway';
        layer.bindPopup(`${popupTitle('Railway')}<b>Name:</b> ${name}<br><b>Type:</b> ${p.railway || "-"}<br><b>Usage:</b> ${p.usage || "-"}<br><b>Gauge:</b> ${p.gauge || "-"} mm<br><b>Electrified:</b> ${p.electrified || "-"}<br><b>Operator:</b> ${p.operator || "-"}`);
    }
});

// No offline geology/fault vector data was supplied for Romania (unlike the Iceland
// geology.js/faults.js polygon+line datasets), so this pulls tiles live from the IGR
// (Institutul Geologic al Romaniei) whole-country 1:1,000,000 geological map WMS -
// confirmed to actually cover the Persani/NW-corner survey area (the 50k service only
// has two pilot sheets published elsewhere in the country).
const geologyWmsUrl = 'https://geoserver.igr.ro/geoserver/geolro1M/wms';

const geologyLithologyLayer = L.tileLayer.wms(geologyWmsUrl, {
    layers: 'geologic_unit_1m_ro',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.6,
    attribution: 'Institutul Geologic al Romaniei (IGR)'
});

const geologyBoundariesLayer = L.tileLayer.wms(geologyWmsUrl, {
    layers: 'geologic_structure_1m_ro',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.8,
    attribution: 'Institutul Geologic al Romaniei (IGR)'
});


function legendSwatch(type, colors) {
    const colorList = Array.isArray(colors) ? colors : [colors];
    const background = colorList.length > 1
        ? `linear-gradient(90deg, ${colorList.join(', ')})`
        : colorList[0];

    if (type === 'x') {
        return `<span class="legend-swatch legend-x" style="color:${colorList[0]};">&times;</span>`;
    }

    if (type === 'dashed-line') {
        return `<span class="legend-swatch legend-line legend-line-dashed" style="border-top-color:${colorList[0]};"></span>`;
    }

    const shapeClass = type === 'line' ? 'legend-line' : (type === 'square' ? 'legend-square' : 'legend-dot');
    return `<span class="legend-swatch ${shapeClass}" style="background:${background};"></span>`;
}

var baseLayers = []; // (optional)

var groupedOverlays = [
    {
        group: "Survey Sites",
        collapsed: true,
        layers: [
            { name: "Planned Sites - NW Corner", layer: plannedRegionalNWLayer, icon: legendSwatch('dot', '#1f78b4') },
            { name: "Planned Sites - Persani", layer: plannedPersaniLayer, icon: legendSwatch('dot', '#ff7f00') },
            { name: "Ciomadul Sites", layer: ciomadulSitesLayer, icon: legendSwatch('x', '#6a3d9a') },
            { name: "Installed 2022", layer: installedSites2022Layer, icon: legendSwatch('x', '#33a02c') },
            { name: "Installed bad 2022", layer: installedBadSites2022Layer, icon: legendSwatch('x', '#e31a1c') },
            { name: "Running Sites", layer: runningSitesLayer, icon: legendSwatch('dot', '#ffe119') },
            { name: "Completed Sites", layer: completedSitesLayer, icon: legendSwatch('dot', '#888888') }
        ]
    },
    {
        group: "Infrastructure",
        collapsed: true,
        layers: [
            { name: "Major powerline", layer: powerMajorLayer, icon: legendSwatch('line', '#e31a1c') },
            { name: "Minor powerline", layer: powerMinorLayer, icon: legendSwatch('line', '#1f78b4') },
            { name: "Power plants", layer: powerplantsLayer, icon: legendSwatch('square', '#fdbf6f') },
            { name: "Wind turbines", layer: windmillLayer, icon: legendSwatch('dot', '#4363d8') },
            { name: "Residential areas", layer: residentialAreasLayer, icon: legendSwatch('square', '#ccc') },
            { name: "Railway", layer: railwayLayer, icon: legendSwatch('dashed-line', '#4d4d4d') }
        ]
    },
    {
        group: "Geology",
        collapsed: true,
        layers: [
            { name: "Lithology (IGR 1M WMS)", layer: geologyLithologyLayer, icon: legendSwatch('square', '#9a6324') },
            { name: "Geology Boundaries (IGR 1M WMS)", layer: geologyBoundariesLayer, icon: legendSwatch('line', '#000') }
        ]
    }
];

// The planned sites, status overlays, and wind turbines are visible by default;
// everything else is opt-in via the layer panel
plannedRegionalNWLayer.addTo(map);
plannedPersaniLayer.addTo(map);
completedSitesLayer.addTo(map);
runningSitesLayer.addTo(map);
windmillLayer.addTo(map);

L.control.panelLayers(baseLayers, groupedOverlays, {
    compact: true, // true = collapsed groups by default
    collapsibleGroups: true,
    selectorGroup: true, // adds a group checkbox that toggles every layer in that group at once
    position: 'topright'
}).addTo(map);

// The plugin applies selectorGroup to every group; drop it for "Survey Sites" only
// (planned sites should stay visible by default, not get bulk-toggled with the rest).
document.querySelectorAll('.leaflet-panel-layers-selector[name="Survey Sites"]').forEach(function (el) {
    el.remove();
});

createSiteSearchControl([plannedRegionalNWLayer, plannedPersaniLayer], {
    label: 'Search sites',
    layerName: 'planned site',
    datalistId: 'site-search-options'
}).addTo(map);
