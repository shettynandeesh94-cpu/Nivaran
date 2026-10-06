import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { getAssignedTechnician } from '../utils/technicians';

// Accurate ward center coordinates for Mangaluru city wards
const WARD_COORDINATES = {
    'Kadri South': [12.8732, 74.8580],
    'Kadri North': [12.8835, 74.8565],
    'Bejai': [12.8885, 74.8450],
    'Bendoor': [12.8710, 74.8520],
    'Lalbagh': [12.8805, 74.8410],
    // Backward-compatible fallback keys
    'Ward 1': [12.8732, 74.8580],
    'Ward 2': [12.8835, 74.8565],
    'Ward 3': [12.8885, 74.8450],
    'Ward 4': [12.8710, 74.8520],
    'Ward 5': [12.8805, 74.8410],
};

const DEFAULT_CENTER = [12.8797, 74.8465]; // Mangaluru City Center

export const CityMapView = ({ complaints = [], onOpenDetails }) => {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersLayerRef = useRef(null);
    const baseTileLayerRef = useRef(null);
    const overlayTileLayerRef = useRef(null);

    const [mapStyle, setMapStyle] = useState('satellite'); // 'satellite' | 'streets' | 'terrain'
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedWard, setSelectedWard] = useState('ALL');
    const [stats, setStats] = useState({ total: 0, critical: 0, resolved: 0 });
    const [streetViewData, setStreetViewData] = useState(null);

    // Derive coordinates for a complaint (uses actual GPS or pseudo-deterministic ward coordinates)
    const getCoordinatesForComplaint = (c, index) => {
        if (c.location && c.location.latitude && c.location.longitude) {
            return [c.location.latitude, c.location.longitude];
        }
        const base = WARD_COORDINATES[c.ward] || DEFAULT_CENTER;
        // Subtle offset based on index so multiple complaints in the same ward don't overlap exactly
        const angle = (index * 137.5 * Math.PI) / 180;
        const radius = 0.003 + (index % 5) * 0.002;
        return [base[0] + radius * Math.cos(angle), base[1] + radius * Math.sin(angle)];
    };

    // Helper to apply the active tile layers
    const applyMapTiles = (map, style) => {
        if (baseTileLayerRef.current) {
            map.removeLayer(baseTileLayerRef.current);
            baseTileLayerRef.current = null;
        }
        if (overlayTileLayerRef.current) {
            map.removeLayer(overlayTileLayerRef.current);
            overlayTileLayerRef.current = null;
        }

        if (style === 'satellite') {
            // High-resolution Satellite Base Imagery
            baseTileLayerRef.current = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                {
                    maxZoom: 19,
                    attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
                }
            ).addTo(map);

            // Satellite Hybrid Overlay (Roads, Landmark Names, Borders)
            overlayTileLayerRef.current = L.tileLayer(
                'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                {
                    maxZoom: 19,
                    pane: 'overlayPane',
                }
            ).addTo(map);
        } else if (style === 'terrain') {
            // Topographic Terrain View
            baseTileLayerRef.current = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
                {
                    maxZoom: 19,
                    attribution: 'Tiles &copy; Esri &mdash; USGS, NOAA',
                }
            ).addTo(map);
        } else {
            // OpenStreetMap Standard Streets
            baseTileLayerRef.current = L.tileLayer(
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                }
            ).addTo(map);
        }
    };

    // Initialize Leaflet Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: DEFAULT_CENTER,
                zoom: 14,
                zoomControl: true,
            });

            applyMapTiles(map, mapStyle);

            const markersLayer = L.layerGroup().addTo(map);
            mapInstanceRef.current = map;
            markersLayerRef.current = markersLayer;

            // Allow clicking anywhere on the map to open 360° Street View
            map.on('contextmenu', (e) => {
                const { lat, lng } = e.latlng;
                setStreetViewData({
                    lat,
                    lng,
                    title: `Road Inspection Point`,
                    ward: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`
                });
            });

            setTimeout(() => {
                map.invalidateSize();
            }, 200);
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update Tile Layer when Map Style changes
    useEffect(() => {
        if (mapInstanceRef.current) {
            applyMapTiles(mapInstanceRef.current, mapStyle);
        }
    }, [mapStyle]);

    // Pan and Zoom Controller Helpers
    const handlePan = (dx, dy) => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.panBy([dx, dy], { animate: true, duration: 0.35 });
        }
    };

    const handleZoomIn = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomIn();
        }
    };

    const handleZoomOut = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomOut();
        }
    };

    // Keyboard Arrow Keys Navigation Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!mapInstanceRef.current) return;
            // Ignore if user is typing in an input or select
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

            const PAN_STEP = 150;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                mapInstanceRef.current.panBy([0, -PAN_STEP], { animate: true });
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                mapInstanceRef.current.panBy([0, PAN_STEP], { animate: true });
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                mapInstanceRef.current.panBy([-PAN_STEP, 0], { animate: true });
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                mapInstanceRef.current.panBy([PAN_STEP, 0], { animate: true });
            } else if (e.key === '+' || e.key === '=') {
                mapInstanceRef.current.zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                mapInstanceRef.current.zoomOut();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Update Markers when complaints or filters change
    useEffect(() => {
        if (!mapInstanceRef.current || !markersLayerRef.current) return;

        const markersLayer = markersLayerRef.current;
        markersLayer.clearLayers();

        const filtered = complaints.filter((c) => {
            const matchesCat = selectedCategory === 'ALL' || (c.category || '').toLowerCase().includes(selectedCategory.toLowerCase());
            const matchesStatus = selectedStatus === 'ALL' || c.status === selectedStatus;
            const matchesWard = selectedWard === 'ALL' || c.ward === selectedWard;
            return matchesCat && matchesStatus && matchesWard;
        });

        // Compute stats
        let criticalCount = 0;
        let resolvedCount = 0;
        const bounds = [];

        filtered.forEach((c, idx) => {
            const coords = getCoordinatesForComplaint(c, idx);
            bounds.push(coords);

            if (c.priority === 'HIGH' || c.status === 'ESCALATED') criticalCount++;
            if (c.status === 'RESOLVED') resolvedCount++;

            // Marker Color Logic
            let pinColor = '#3b82f6'; // Blue
            let pulseClass = '';
            if (c.status === 'RESOLVED') {
                pinColor = '#10b981'; // Green
            } else if (c.status === 'ESCALATED' || c.priority === 'HIGH') {
                pinColor = '#ef4444'; // Red
                pulseClass = 'marker-pulse-critical';
            } else if (c.status === 'IN_PROGRESS') {
                pinColor = '#f59e0b'; // Yellow/Orange
            }

            // Custom Icon
            const iconHtml = `
                <div class="custom-map-pin ${pulseClass}" style="background: ${pinColor};">
                    <i class="fa-solid ${getCategoryIcon(c.category)}"></i>
                </div>
            `;

            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-div-icon',
                iconSize: [34, 34],
                iconAnchor: [17, 34],
                popupAnchor: [0, -32],
            });

            const tech = getAssignedTechnician(c);

            // Popup HTML
            const popupContent = document.createElement('div');
            popupContent.className = 'map-popup-card';
            popupContent.innerHTML = `
                <div class="map-popup-header" style="border-left: 3px solid ${pinColor};">
                    <span class="map-popup-badge" style="background: ${pinColor}20; color: ${pinColor};">
                        ${c.status}
                    </span>
                    <span class="map-popup-ward"><i class="fa-solid fa-location-dot"></i> ${c.ward}</span>
                </div>
                ${c.attachment ? `<img src="${c.attachment}" alt="Defect proof" class="map-popup-img" />` : ''}
                <h4 class="map-popup-title">${c.title}</h4>
                <p class="map-popup-desc">${c.description.slice(0, 100)}${c.description.length > 100 ? '...' : ''}</p>
                <div class="map-popup-meta">
                    <div><strong>Category:</strong> ${c.category || 'General'}</div>
                    <div><strong>Priority:</strong> <span style="color: ${c.priority === 'HIGH' ? '#ef4444' : c.priority === 'MEDIUM' ? '#f59e0b' : '#3b82f6'}; font-weight: bold;">${c.priority}</span></div>
                    ${tech ? `<div><strong>Technician:</strong> 👤 ${tech.name} (${tech.specialization})</div>` : ''}
                </div>
                <div class="map-popup-actions">
                    <button class="btn btn-primary btn-sm btn-block view-details-btn" style="margin-top: 8px;">
                        <i class="fa-solid fa-eye"></i> View Full Details
                    </button>
                    <button class="btn btn-secondary btn-sm btn-block streetview-btn" style="margin-top: 6px; background: rgba(99, 102, 241, 0.18); border-color: rgba(99, 102, 241, 0.4); color: #a5b4fc; font-weight: 600;">
                        <i class="fa-solid fa-person-walking"></i> 🚶 360° Street View (Road)
                    </button>
                    <a href="https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}" target="_blank" rel="noopener noreferrer" class="map-directions-link">
                        <i class="fa-solid fa-diamond-turn-right"></i> Navigate (Google Maps)
                    </a>
                </div>
            `;

            // Attach View Details Click Listener
            const btn = popupContent.querySelector('.view-details-btn');
            if (btn) {
                btn.onclick = () => {
                    if (onOpenDetails) onOpenDetails(c._id);
                };
            }

            // Attach 360 Street View Click Listener
            const svBtn = popupContent.querySelector('.streetview-btn');
            if (svBtn) {
                svBtn.onclick = () => {
                    setStreetViewData({
                        lat: coords[0],
                        lng: coords[1],
                        title: c.title,
                        ward: c.ward
                    });
                };
            }

            const marker = L.marker(coords, { icon: customIcon }).bindPopup(popupContent);
            markersLayer.addLayer(marker);
        });

        setStats({
            total: filtered.length,
            critical: criticalCount,
            resolved: resolvedCount,
        });

        // Fit map view to pins if available
        if (bounds.length > 0 && mapInstanceRef.current) {
            try {
                mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            } catch (e) {
                // Ignore bounds fit if single point
            }
        }
    }, [complaints, selectedCategory, selectedStatus, selectedWard]);

    const getCategoryIcon = (category = '') => {
        const cat = category.toLowerCase();
        if (cat.includes('light') || cat.includes('electr')) return 'fa-lightbulb';
        if (cat.includes('road') || cat.includes('pothole')) return 'fa-road';
        if (cat.includes('water') || cat.includes('pipe') || cat.includes('sewage')) return 'fa-faucet-drip';
        if (cat.includes('sanitat') || cat.includes('garbage') || cat.includes('waste')) return 'fa-trash-can';
        if (cat.includes('health')) return 'fa-heart-pulse';
        return 'fa-triangle-exclamation';
    };

    const handleRecenter = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setView(DEFAULT_CENTER, 13);
        }
    };

    return (
        <div className="city-map-wrapper">
            {/* Map Top Control Header & Filters */}
            <div className="map-controls-panel">
                {/* Map Layer Style Switcher */}
                <div className="map-style-toggle-group">
                    <button 
                        type="button"
                        className={`map-style-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
                        onClick={() => setMapStyle('satellite')}
                        title="High-resolution Satellite Hybrid View"
                    >
                        <i className="fa-solid fa-satellite"></i> 🛰️ Satellite
                    </button>
                    <button 
                        type="button"
                        className={`map-style-btn ${mapStyle === 'streets' ? 'active' : ''}`}
                        onClick={() => setMapStyle('streets')}
                        title="Standard OpenStreetMap Streets"
                    >
                        <i className="fa-solid fa-map"></i> 🗺️ Streets
                    </button>
                    <button 
                        type="button"
                        className={`map-style-btn ${mapStyle === 'terrain' ? 'active' : ''}`}
                        onClick={() => setMapStyle('terrain')}
                        title="Topographic Terrain View"
                    >
                        <i className="fa-solid fa-mountain-sun"></i> ⛰️ Terrain
                    </button>
                </div>

                <div className="map-filter-group">
                    <label><i className="fa-solid fa-filter"></i> Category:</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="ALL">All Categories</option>
                        <option value="Roads">Roads & Potholes</option>
                        <option value="Streetlights">Streetlights & Electrical</option>
                        <option value="Water Supply">Water Supply & Pipeline</option>
                        <option value="Sanitation">Sanitation & Garbage</option>
                        <option value="Health">Public Health</option>
                    </select>
                </div>

                <div className="map-filter-group">
                    <label><i className="fa-solid fa-sliders"></i> Status:</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                        <option value="ALL">All Statuses</option>
                        <option value="OPEN">Open (New)</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="ESCALATED">Escalated (SLA Breached)</option>
                        <option value="RESOLVED">Resolved (Fixed)</option>
                    </select>
                </div>

                <div className="map-filter-group">
                    <label><i className="fa-solid fa-location-dot"></i> Ward:</label>
                    <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
                        <option value="ALL">All Wards</option>
                        <option value="Kadri South">Kadri South</option>
                        <option value="Kadri North">Kadri North</option>
                        <option value="Bejai">Bejai</option>
                        <option value="Bendoor">Bendoor</option>
                        <option value="Lalbagh">Lalbagh</option>
                    </select>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleRecenter} style={{ marginLeft: 'auto' }}>
                    <i className="fa-solid fa-crosshairs"></i> Recenter
                </button>
            </div>

            {/* Live Stats Floating Cards */}
            <div className="map-stats-strip">
                <div className="map-stat-pill">
                    <span className="stat-dot total"></span>
                    <span>Total Incidents: <strong>{stats.total}</strong></span>
                </div>
                <div className="map-stat-pill">
                    <span className="stat-dot critical"></span>
                    <span>Critical / Escalated: <strong>{stats.critical}</strong></span>
                </div>
                <div className="map-stat-pill">
                    <span className="stat-dot resolved"></span>
                    <span>AI-Verified Resolved: <strong>{stats.resolved}</strong></span>
                </div>
            </div>

            {/* Leaflet Map Canvas with Floating Pan D-Pad Controller */}
            <div className="map-canvas-wrapper">
                <div className="map-canvas-container" ref={mapContainerRef}></div>

                {/* Floating HUD D-Pad Pan & Navigation Controller */}
                <div className="map-dpad-controller">
                    <div className="dpad-header">
                        <i className="fa-solid fa-compass"></i> PAN CONTROLS
                    </div>
                    <div className="dpad-cross">
                        <button 
                            type="button" 
                            className="dpad-btn dpad-up" 
                            onClick={() => handlePan(0, -180)}
                            title="Pan Up / North [↑ / W]"
                        >
                            <i className="fa-solid fa-arrow-up"></i>
                        </button>
                        <div className="dpad-middle-row">
                            <button 
                                type="button" 
                                className="dpad-btn dpad-left" 
                                onClick={() => handlePan(-180, 0)}
                                title="Pan Left / West [← / A]"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                            </button>
                            <button 
                                type="button" 
                                className="dpad-btn dpad-center" 
                                onClick={handleRecenter}
                                title="Recenter on City Center"
                            >
                                <i className="fa-solid fa-location-crosshairs"></i>
                            </button>
                            <button 
                                type="button" 
                                className="dpad-btn dpad-right" 
                                onClick={() => handlePan(180, 0)}
                                title="Pan Right / East [→ / D]"
                            >
                                <i className="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                        <button 
                            type="button" 
                            className="dpad-btn dpad-down" 
                            onClick={() => handlePan(0, 180)}
                            title="Pan Down / South [↓ / S]"
                        >
                            <i className="fa-solid fa-arrow-down"></i>
                        </button>
                    </div>

                    {/* Quick Zoom Buttons */}
                    <div className="dpad-zoom-row">
                        <button 
                            type="button" 
                            className="dpad-zoom-btn" 
                            onClick={handleZoomIn}
                            title="Zoom In [+]"
                        >
                            <i className="fa-solid fa-plus"></i> Zoom In
                        </button>
                        <button 
                            type="button" 
                            className="dpad-zoom-btn" 
                            onClick={handleZoomOut}
                            title="Zoom Out [-]"
                        >
                            <i className="fa-solid fa-minus"></i> Zoom Out
                        </button>
                    </div>

                    {/* 360 Street View Launcher */}
                    <button 
                        type="button"
                        className="dpad-streetview-btn"
                        onClick={() => {
                            if (mapInstanceRef.current) {
                                const center = mapInstanceRef.current.getCenter();
                                setStreetViewData({
                                    lat: center.lat,
                                    lng: center.lng,
                                    title: 'Live Road Inspection Point',
                                    ward: 'City Center'
                                });
                            }
                        }}
                        title="Open 360° Road & Street View at Center"
                    >
                        <i className="fa-solid fa-person-walking"></i> 🚶 360° Road View
                    </button>
                </div>
            </div>

            {/* Map Legend */}
            <div className="map-legend">
                <div className="legend-item"><span className="legend-marker red"></span> Critical / High Priority</div>
                <div className="legend-item"><span className="legend-marker yellow"></span> In Progress (Dispatched)</div>
                <div className="legend-item"><span className="legend-marker green"></span> AI Resolved & Closed</div>
            </div>

            {/* 360° Street Level Road View Modal */}
            {streetViewData && (
                <div className="streetview-modal-backdrop" onClick={() => setStreetViewData(null)}>
                    <div className="streetview-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="streetview-modal-header">
                            <div>
                                <h3 className="streetview-modal-title">
                                    <i className="fa-solid fa-person-walking"></i> 360° Street & Road View Explorer
                                </h3>
                                <p className="streetview-modal-subtitle">
                                    {streetViewData.title} &bull; {streetViewData.ward} ({streetViewData.lat.toFixed(5)}°, {streetViewData.lng.toFixed(5)}°)
                                </p>
                            </div>
                            <div className="streetview-modal-actions">
                                <a 
                                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewData.lat},${streetViewData.lng}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="btn btn-primary btn-sm"
                                    title="Open Fullscreen in Google Maps Street View"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Google Maps Street View
                                </a>
                                <button className="btn btn-secondary btn-sm" onClick={() => setStreetViewData(null)}>
                                    <i className="fa-solid fa-xmark"></i> Close
                                </button>
                            </div>
                        </div>

                        {/* Interactive 360 Panorama Iframe */}
                        <div className="streetview-iframe-container">
                            <iframe
                                title="360 Street View Panorama"
                                src={`https://maps.google.com/maps?q=&layer=c&cbll=${streetViewData.lat},${streetViewData.lng}&cbp=11,0,0,0,0&output=svembed`}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                            ></iframe>
                        </div>

                        <div className="streetview-hint">
                            <span><i className="fa-solid fa-hand-pointer"></i> <strong>How to navigate:</strong> Click and drag to look around in 360°. Click the road arrows to move down the street!</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
