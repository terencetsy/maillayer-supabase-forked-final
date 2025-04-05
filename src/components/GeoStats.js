import React, { useState, useEffect } from 'react';
import { Globe, MapPin, TrendingUp, Smartphone, Monitor, Tablet, Server } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const GeoStats = ({ campaignId, brandId }) => {
    const [geoData, setGeoData] = useState({
        countries: {},
        cities: {},
        devices: {},
        browsers: {},
        operatingSystems: {},
        loading: true,
        error: null,
    });

    const [activeTab, setActiveTab] = useState('location');
    const [mapView, setMapView] = useState('countries');
    const [allEvents, setAllEvents] = useState([]);

    // Color schemes for charts
    const COUNTRY_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];
    const DEVICE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    useEffect(() => {
        if (!campaignId || !brandId) {
            setGeoData((prev) => ({ ...prev, loading: false }));
            return;
        }

        fetchAllCampaignEvents();
    }, [campaignId, brandId]);

    const fetchAllCampaignEvents = async () => {
        try {
            setGeoData((prev) => ({ ...prev, loading: true }));

            // Fetch all events (not paginated)
            let allEvents = [];
            let page = 1;
            let hasMoreEvents = true;

            while (hasMoreEvents) {
                const response = await fetch(`/api/brands/${brandId}/campaigns/${campaignId}/stats?events=true&page=${page}&limit=500`, {
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch campaign events');
                }

                const data = await response.json();
                const events = data.events || [];

                allEvents = [...allEvents, ...events];

                if (events.length < 500) {
                    hasMoreEvents = false;
                } else {
                    page++;
                }
            }

            setAllEvents(allEvents);
            processGeoData(allEvents);
        } catch (error) {
            console.error('Error fetching all campaign events:', error);
            setGeoData((prev) => ({
                ...prev,
                loading: false,
                error: 'Failed to fetch location data',
            }));
        }
    };

    const processGeoData = (events) => {
        try {
            const countries = {};
            const cities = {};
            const devices = {};
            const browsers = {};
            const operatingSystems = {};

            events.forEach((event) => {
                // Process geolocation data
                if (event.metadata?.geolocation) {
                    const geo = event.metadata.geolocation;

                    // Count countries
                    const country = geo.country || 'Unknown';
                    countries[country] = (countries[country] || 0) + 1;

                    // Count cities
                    const city = geo.city ? `${geo.city}, ${geo.countryCode}` : 'Unknown';
                    cities[city] = (cities[city] || 0) + 1;
                }

                // Process device data
                if (event.metadata?.userAgent) {
                    const ua = event.metadata.userAgent;

                    // Count device types
                    const deviceType = getDeviceType(ua);
                    devices[deviceType] = (devices[deviceType] || 0) + 1;

                    // Count browsers
                    const browser = getBrowserInfo(ua);
                    browsers[browser] = (browsers[browser] || 0) + 1;

                    // Count operating systems
                    const os = getOperatingSystem(ua);
                    operatingSystems[os] = (operatingSystems[os] || 0) + 1;
                }
            });

            setGeoData({
                countries,
                cities,
                devices,
                browsers,
                operatingSystems,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error('Error processing geo data:', error);
            setGeoData((prev) => ({
                ...prev,
                loading: false,
                error: 'Failed to process location data',
            }));
        }
    };

    // Helper functions to extract user agent data
    const getDeviceType = (userAgent) => {
        // Simple detection for demonstration
        if (!userAgent) return 'Unknown';

        if (/mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase())) {
            if (/ipad|tablet/i.test(userAgent.toLowerCase())) {
                return 'Tablet';
            }
            return 'Mobile';
        }
        return 'Desktop';
    };

    const getBrowserInfo = (userAgent) => {
        if (!userAgent) return 'Unknown';

        if (/firefox/i.test(userAgent)) return 'Firefox';
        if (/chrome/i.test(userAgent)) return 'Chrome';
        if (/safari/i.test(userAgent)) return 'Safari';
        if (/edge/i.test(userAgent)) return 'Edge';
        if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';

        return 'Other';
    };

    const getOperatingSystem = (userAgent) => {
        if (!userAgent) return 'Unknown';

        if (/windows/i.test(userAgent)) return 'Windows';
        if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
        if (/linux/i.test(userAgent)) return 'Linux';
        if (/android/i.test(userAgent)) return 'Android';
        if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';

        return 'Other';
    };

    // Sort data and prepare for charts
    const sortedCountries = Object.entries(geoData.countries).sort((a, b) => b[1] - a[1]);

    const sortedCities = Object.entries(geoData.cities).sort((a, b) => b[1] - a[1]);

    const deviceChartData = Object.entries(geoData.devices).map(([name, value]) => ({ name, value }));

    const browserChartData = Object.entries(geoData.browsers).map(([name, value]) => ({ name, value }));

    const osChartData = Object.entries(geoData.operatingSystems).map(([name, value]) => ({ name, value }));

    // Format for bar charts - take top 10
    const countryBarData = sortedCountries.slice(0, 10).map(([country, count]) => ({ name: country, value: count }));

    const cityBarData = sortedCities.slice(0, 10).map(([city, count]) => ({ name: city, value: count }));

    // Calculate total events with geo data
    const totalGeoEvents = Object.values(geoData.countries).reduce((sum, count) => sum + count, 0);

    if (geoData.loading) {
        return (
            <div className="geo-stats-loading">
                <div className="spinner-small"></div>
                <p>Loading geographic insights...</p>
            </div>
        );
    }

    if (geoData.error) {
        return (
            <div className="geo-stats-error">
                <p>Error: {geoData.error}</p>
            </div>
        );
    }

    if (totalGeoEvents === 0) {
        return (
            <div className="geo-stats-empty">
                <Globe size={24} />
                <p>No location data available yet</p>
            </div>
        );
    }

    const renderDeviceIcon = (device) => {
        switch (device) {
            case 'Mobile':
                return <Smartphone size={16} />;
            case 'Desktop':
                return <Monitor size={16} />;
            case 'Tablet':
                return <Tablet size={16} />;
            default:
                return <Server size={16} />;
        }
    };

    return (
        <div className="geo-stats-container">
            <div className="geo-stats-header">
                <Globe size={20} />
                <h3>Geographic & Device Insights</h3>
            </div>

            <div className="geo-stats-tabs">
                <button
                    className={`geo-tab ${activeTab === 'location' ? 'active' : ''}`}
                    onClick={() => setActiveTab('location')}
                >
                    <Globe size={16} />
                    <span>Location</span>
                </button>
                <button
                    className={`geo-tab ${activeTab === 'devices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('devices')}
                >
                    <Smartphone size={16} />
                    <span>Devices</span>
                </button>
                <button
                    className={`geo-tab ${activeTab === 'browsers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('browsers')}
                >
                    <Globe size={16} />
                    <span>Browsers</span>
                </button>
                <button
                    className={`geo-tab ${activeTab === 'os' ? 'active' : ''}`}
                    onClick={() => setActiveTab('os')}
                >
                    <Server size={16} />
                    <span>OS</span>
                </button>
            </div>

            {activeTab === 'location' && (
                <div className="geo-stats-content">
                    <div className="geo-view-toggle">
                        <button
                            className={`geo-view-button ${mapView === 'countries' ? 'active' : ''}`}
                            onClick={() => setMapView('countries')}
                        >
                            <Globe size={14} />
                            <span>Countries</span>
                        </button>
                        <button
                            className={`geo-view-button ${mapView === 'cities' ? 'active' : ''}`}
                            onClick={() => setMapView('cities')}
                        >
                            <MapPin size={14} />
                            <span>Cities</span>
                        </button>
                    </div>

                    <div className="geo-chart-container">
                        <div className="geo-chart">
                            <h4>{mapView === 'countries' ? 'Top Countries' : 'Top Cities'}</h4>
                            <ResponsiveContainer
                                width="100%"
                                height={300}
                            >
                                <BarChart
                                    data={mapView === 'countries' ? countryBarData : cityBarData}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={70}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar
                                        dataKey="value"
                                        fill="#4682B4"
                                    >
                                        {(mapView === 'countries' ? countryBarData : cityBarData).map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="geo-detail-list">
                            <div className="geo-card-header">
                                {mapView === 'countries' ? (
                                    <>
                                        <Globe size={16} />
                                        <h4>Country Breakdown</h4>
                                    </>
                                ) : (
                                    <>
                                        <MapPin size={16} />
                                        <h4>City Breakdown</h4>
                                    </>
                                )}
                            </div>
                            <div className="geo-card-content">
                                <ul className="geo-list">
                                    {(mapView === 'countries' ? sortedCountries : sortedCities).slice(0, 12).map(([location, count], index) => (
                                        <li
                                            key={location}
                                            className="geo-list-item"
                                        >
                                            <span className="geo-location">
                                                <span
                                                    className="geo-index"
                                                    style={{ backgroundColor: COUNTRY_COLORS[index % COUNTRY_COLORS.length] }}
                                                >
                                                    {index + 1}
                                                </span>
                                                <span className="geo-name">{location}</span>
                                            </span>
                                            <span className="geo-count">
                                                <span className="geo-number">{count}</span>
                                                <span className="geo-percentage">({Math.round((count / totalGeoEvents) * 100)}%)</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'devices' && (
                <div className="geo-stats-content">
                    <div className="geo-chart-container">
                        <div className="geo-chart">
                            <h4>Device Types</h4>
                            <ResponsiveContainer
                                width="100%"
                                height={300}
                            >
                                <PieChart>
                                    <Pie
                                        data={deviceChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                    >
                                        {deviceChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={DEVICE_COLORS[index % DEVICE_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="geo-detail-list">
                            <div className="geo-card-header">
                                <Smartphone size={16} />
                                <h4>Device Breakdown</h4>
                            </div>
                            <div className="geo-card-content">
                                <ul className="geo-list">
                                    {Object.entries(geoData.devices)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([device, count], index) => {
                                            const percentage = totalGeoEvents > 0 ? Math.round((count / totalGeoEvents) * 100) : 0;
                                            return (
                                                <li
                                                    key={device}
                                                    className="geo-list-item device-item"
                                                >
                                                    <span className="geo-location">
                                                        <span
                                                            className="geo-icon"
                                                            style={{ color: DEVICE_COLORS[index % DEVICE_COLORS.length] }}
                                                        >
                                                            {renderDeviceIcon(device)}
                                                        </span>
                                                        <span className="geo-name">{device}</span>
                                                    </span>
                                                    <span className="geo-count">
                                                        <span className="geo-number">{count}</span>
                                                        <span className="geo-percentage">({percentage}%)</span>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'browsers' && (
                <div className="geo-stats-content">
                    <div className="geo-chart-container">
                        <div className="geo-chart">
                            <h4>Browser Types</h4>
                            <ResponsiveContainer
                                width="100%"
                                height={300}
                            >
                                <PieChart>
                                    <Pie
                                        data={browserChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                    >
                                        {browserChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="geo-detail-list">
                            <div className="geo-card-header">
                                <Globe size={16} />
                                <h4>Browser Breakdown</h4>
                            </div>
                            <div className="geo-card-content">
                                <ul className="geo-list">
                                    {Object.entries(geoData.browsers)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([browser, count], index) => {
                                            const percentage = totalGeoEvents > 0 ? Math.round((count / totalGeoEvents) * 100) : 0;
                                            return (
                                                <li
                                                    key={browser}
                                                    className="geo-list-item"
                                                >
                                                    <span className="geo-location">
                                                        <span
                                                            className="geo-index"
                                                            style={{ backgroundColor: COUNTRY_COLORS[index % COUNTRY_COLORS.length] }}
                                                        >
                                                            {index + 1}
                                                        </span>
                                                        <span className="geo-name">{browser}</span>
                                                    </span>
                                                    <span className="geo-count">
                                                        <span className="geo-number">{count}</span>
                                                        <span className="geo-percentage">({percentage}%)</span>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'os' && (
                <div className="geo-stats-content">
                    <div className="geo-chart-container">
                        <div className="geo-chart">
                            <h4>Operating Systems</h4>
                            <ResponsiveContainer
                                width="100%"
                                height={300}
                            >
                                <PieChart>
                                    <Pie
                                        data={osChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                    >
                                        {osChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COUNTRY_COLORS[index % COUNTRY_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="geo-detail-list">
                            <div className="geo-card-header">
                                <Server size={16} />
                                <h4>OS Breakdown</h4>
                            </div>
                            <div className="geo-card-content">
                                <ul className="geo-list">
                                    {Object.entries(geoData.operatingSystems)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([os, count], index) => {
                                            const percentage = totalGeoEvents > 0 ? Math.round((count / totalGeoEvents) * 100) : 0;
                                            return (
                                                <li
                                                    key={os}
                                                    className="geo-list-item"
                                                >
                                                    <span className="geo-location">
                                                        <span
                                                            className="geo-index"
                                                            style={{ backgroundColor: COUNTRY_COLORS[index % COUNTRY_COLORS.length] }}
                                                        >
                                                            {index + 1}
                                                        </span>
                                                        <span className="geo-name">{os}</span>
                                                    </span>
                                                    <span className="geo-count">
                                                        <span className="geo-number">{count}</span>
                                                        <span className="geo-percentage">({percentage}%)</span>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeoStats;
