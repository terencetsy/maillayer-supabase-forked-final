import { useState } from 'react';

export default function GeoBarChart({ data = [], title = 'Data', totalLabel = 'Total', type = 'location' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Country code mapping - expanded list
    const getCountryCode = (countryName) => {
        const countryMap = {
            'United States': 'US',
            USA: 'US',
            'United Kingdom': 'GB',
            UK: 'GB',
            India: 'IN',
            Canada: 'CA',
            Australia: 'AU',
            Germany: 'DE',
            France: 'FR',
            Japan: 'JP',
            China: 'CN',
            Brazil: 'BR',
            Mexico: 'MX',
            Spain: 'ES',
            Italy: 'IT',
            Netherlands: 'NL',
            Sweden: 'SE',
            Norway: 'NO',
            Denmark: 'DK',
            Finland: 'FI',
            Poland: 'PL',
            Russia: 'RU',
            'South Korea': 'KR',
            Singapore: 'SG',
            'New Zealand': 'NZ',
            Switzerland: 'CH',
            Austria: 'AT',
            Belgium: 'BE',
            Ireland: 'IE',
            Portugal: 'PT',
            Greece: 'GR',
            'Czech Republic': 'CZ',
            Romania: 'RO',
            Hungary: 'HU',
            Turkey: 'TR',
            'South Africa': 'ZA',
            Argentina: 'AR',
            Chile: 'CL',
            Colombia: 'CO',
            Peru: 'PE',
            Thailand: 'TH',
            Vietnam: 'VN',
            Indonesia: 'ID',
            Malaysia: 'MY',
            Philippines: 'PH',
            Pakistan: 'PK',
            Bangladesh: 'BD',
            Egypt: 'EG',
            Nigeria: 'NG',
            Kenya: 'KE',
            'Saudi Arabia': 'SA',
            'United Arab Emirates': 'AE',
            UAE: 'AE',
            Israel: 'IL',
        };
        return countryMap[countryName] || null;
    };

    // Get country flag emoji
    const getCountryFlag = (countryName) => {
        const countryCode = getCountryCode(countryName);
        if (!countryCode) return '🌐';

        // Convert country code to flag emoji
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map((char) => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    };

    // Generate colorful gradient for each bar - using darker/brighter colors
    const getBarColor = (index, totalBars, isHovered) => {
        // Array of darker, more vibrant color gradients
        const colorGradients = [
            'linear-gradient(180deg, #0a0a0a 0%, #2a2a2a 100%)', // Dark black-gray
            'linear-gradient(180deg, #1a1a1a 0%, #3a3a3a 100%)', // Darker gray
            'linear-gradient(180deg, #0f0f0f 0%, #2f2f2f 100%)', // Deep black-gray
            'linear-gradient(180deg, #151515 0%, #353535 100%)', // Charcoal
            'linear-gradient(180deg, #0d0d0d 0%, #2d2d2d 100%)', // Dark slate
            'linear-gradient(180deg, #121212 0%, #323232 100%)', // Midnight
            'linear-gradient(180deg, #181818 0%, #383838 100%)', // Onyx
            'linear-gradient(180deg, #0e0e0e 0%, #2e2e2e 100%)', // Ebony
            'linear-gradient(180deg, #161616 0%, #363636 100%)', // Carbon
            'linear-gradient(180deg, #0b0b0b 0%, #2b2b2b 100%)', // Obsidian
            'linear-gradient(180deg, #131313 0%, #333333 100%)', // Jet
            'linear-gradient(180deg, #191919 0%, #393939 100%)', // Raven
            'linear-gradient(180deg, #0c0c0c 0%, #2c2c2c 100%)', // Coal
            'linear-gradient(180deg, #141414 0%, #343434 100%)', // Shadow
            'linear-gradient(180deg, #171717 0%, #373737 100%)', // Graphite
        ];

        const colorIndex = index % colorGradients.length;
        const gradient = colorGradients[colorIndex];

        // If hovered, make it slightly lighter
        if (isHovered) {
            return gradient.replace(/#0a/g, '#1a').replace(/#0b/g, '#1b').replace(/#0c/g, '#1c').replace(/#0d/g, '#1d').replace(/#0e/g, '#1e').replace(/#0f/g, '#1f').replace(/#1a/g, '#2a').replace(/#2a/g, '#3a');
        }

        return gradient;
    };

    if (!data || data.length === 0) {
        return (
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.25rem' }}>{title}</h3>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', color: '#999', fontSize: '0.875rem', fontStyle: 'italic' }}>No data available</div>
            </div>
        );
    }

    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.25rem' }}>{title}</h3>
                    <span style={{ fontSize: '0.8125rem', color: '#999' }}>{data.length} items</span>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#666', fontWeight: '500' }}>
                    {total.toLocaleString()} {totalLabel}
                </span>
            </div>

            {/* Bar Chart - Scrollable to show all countries */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    minHeight: '320px',
                    padding: '20px 0 20px 0',
                    position: 'relative',
                    borderBottom: '1px solid #f0f0f0',
                    overflowX: 'auto',
                    overflowY: 'visible',
                }}
            >
                {data.map((item, index) => {
                    const heightPercentage = (item.value / maxValue) * 100;
                    const percentage = ((item.value / total) * 100).toFixed(1);
                    const isHovered = hoveredIndex === index;

                    return (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '55px',
                                flexShrink: 0,
                            }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Bar Wrapper */}
                            <div
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    height: '228px',
                                    position: 'relative',
                                }}
                            >
                                {/* Value Label and Percentage on Hover */}
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '2px',
                                        marginBottom: '6px',
                                        opacity: isHovered ? 1 : 0,
                                        transition: 'opacity 0.2s ease',
                                        position: 'absolute',
                                        top: '-30px',
                                        backgroundColor: '#1a1a1a',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap',
                                        zIndex: 10,
                                    }}
                                >
                                    <div style={{ fontSize: '11px', fontWeight: '600' }}>
                                        {item.value} ({percentage}%)
                                    </div>
                                </div>

                                {/* Bar */}
                                <div
                                    style={{
                                        width: '42px',
                                        background: '#f5f5f5',
                                        borderRadius: '6px 6px 0 0',
                                        position: 'relative',
                                        minHeight: '8px',
                                        height: `${Math.max(heightPercentage, 4)}%`,
                                        transition: 'all 0.3s ease',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transform: isHovered ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
                                    }}
                                >
                                    {/* Bar Fill - Colorful gradients */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '100%',
                                            background: getBarColor(index, data.length, isHovered),
                                            borderRadius: '6px 6px 0 0',
                                            transition: 'all 0.3s ease',
                                            boxShadow: isHovered ? '0 6px 20px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                                            filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
                                        }}
                                    ></div>

                                    {/* Percentage inside bar (for tall bars) */}
                                    {heightPercentage > 20 && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                color: '#fff',
                                                whiteSpace: 'nowrap',
                                                zIndex: 1,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                            }}
                                        >
                                            {percentage}%
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Label (Country/City/Device name) - At bottom, no rotation */}
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: isHovered ? '#1a1a1a' : '#666',
                                    fontWeight: isHovered ? '600' : '500',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '70px',
                                    textAlign: 'center',
                                    marginTop: '8px',
                                    transition: 'all 0.2s ease',
                                }}
                                title={item.date}
                            >
                                {item.date}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
