import { useState } from 'react';

export default function GeoBarChart({ data = [], title = 'Data', totalLabel = 'Total', type = 'location' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Country code mapping
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

    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const total = data.reduce((sum, item) => sum + item.value, 0);

    // Determine bar max width based on data length
    const getBarMaxWidth = () => {
        if (data.length <= 7) return '48px';
        if (data.length <= 14) return '40px';
        if (data.length <= 20) return '32px';
        return '28px';
    };

    // Determine label display
    const shouldShowLabel = (index) => {
        const length = data.length;
        if (length <= 14) return true;
        if (length <= 20) return index % 2 === 0;
        return index % 3 === 0;
    };

    if (!data || data.length === 0) {
        return (
            <div className="chart-container">
                <div className="chart-header">
                    <div>
                        <h3 className="chart-title">{title}</h3>
                    </div>
                </div>
                <div className="chart-empty">No data available</div>
            </div>
        );
    }

    return (
        <div className="chart-container">
            {/* Header */}
            <div className="chart-header">
                <div>
                    <h3 className="chart-title">{title}</h3>
                    <div className="chart-subtitle">{data.length} items</div>
                </div>
                <span className="chart-total">
                    {total.toLocaleString()} {totalLabel}
                </span>
            </div>

            {/* Bar Chart */}
            <div className="chart-bars">
                {data.map((item, index) => {
                    const heightPercentage = (item.value / maxValue) * 100;
                    const isHovered = hoveredIndex === index;

                    return (
                        <div
                            key={index}
                            className="chart-bar-wrapper"
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Bar Wrapper */}
                            <div className="chart-bar-inner">
                                {/* Value Label */}
                                <div
                                    className="chart-bar-value"
                                    style={{ opacity: isHovered ? 1 : 0 }}
                                >
                                    {item.value}
                                </div>

                                {/* Bar */}
                                <div
                                    className="chart-bar"
                                    style={{
                                        maxWidth: getBarMaxWidth(),
                                        height: `${Math.max(heightPercentage, 2)}%`,
                                    }}
                                >
                                    {/* Bar Fill */}
                                    <div className="chart-bar-fill"></div>
                                </div>
                            </div>

                            {/* Label */}
                            <div
                                className="chart-bar-label"
                                style={{ visibility: shouldShowLabel(index) ? 'visible' : 'hidden' }}
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
