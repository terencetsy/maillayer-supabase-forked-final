import { useState } from 'react';

export default function ContactsBarChart({ data = [], title = 'Daily Activity', totalLabel = 'Total' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Aggregate data based on length
    const getAggregatedData = () => {
        if (!data || data.length === 0) return [];

        const dataLength = data.length;

        // For 7-14 days: show daily
        if (dataLength <= 14) {
            return data;
        }

        // For 15-45 days: show daily but limit display
        if (dataLength <= 45) {
            return data;
        }

        // For 46-90 days: aggregate by week
        if (dataLength <= 90) {
            const weeks = [];
            for (let i = 0; i < data.length; i += 7) {
                const weekData = data.slice(i, i + 7);
                const weekTotal = weekData.reduce((sum, day) => sum + day.value, 0);
                const weekStart = weekData[0].date;
                weeks.push({
                    date: weekStart,
                    value: weekTotal,
                    isWeek: true,
                });
            }
            return weeks;
        }

        // For 90+ days: aggregate by 2 weeks
        const biWeeks = [];
        for (let i = 0; i < data.length; i += 14) {
            const biWeekData = data.slice(i, i + 14);
            const biWeekTotal = biWeekData.reduce((sum, day) => sum + day.value, 0);
            const biWeekStart = biWeekData[0].date;
            biWeeks.push({
                date: biWeekStart,
                value: biWeekTotal,
                isBiWeek: true,
            });
        }
        return biWeeks;
    };

    const aggregatedData = getAggregatedData();
    const maxValue = Math.max(...aggregatedData.map((item) => item.value), 1);

    // Check if data contains dates or plain text
    const isDateData = (dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date instanceof Date && !isNaN(date) && dateStr.includes('-');
    };

    // Format date or return plain text
    const formatLabel = (dateStr, item) => {
        // If it's not a date (like country, device, browser name), return as is
        if (!isDateData(dateStr)) {
            return dateStr;
        }

        // Otherwise format as date
        const date = new Date(dateStr);
        if (item.isWeek) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (item.isBiWeek) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Calculate total
    const total = data.reduce((sum, item) => sum + item.value, 0);

    // Determine label display
    const shouldShowLabel = (index) => {
        const length = aggregatedData.length;
        if (length <= 14) return true;
        if (length <= 30) return index % 2 === 0;
        return index % 3 === 0;
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

    const barMaxWidth = aggregatedData.length <= 14 ? '40px' : aggregatedData.length <= 30 ? '32px' : '28px';
    const gap = aggregatedData.length <= 14 ? '8px' : aggregatedData.length <= 30 ? '6px' : '4px';

    return (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a1a1a', marginBottom: '0.25rem' }}>{title}</h3>
                    <span style={{ fontSize: '0.8125rem', color: '#999' }}>
                        {data.length} {isDateData(data[0]?.date) ? 'days' : 'items'}
                        {aggregatedData[0]?.isWeek && ' (weekly)'}
                        {aggregatedData[0]?.isBiWeek && ' (bi-weekly)'}
                    </span>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#666', fontWeight: '500' }}>
                    {total.toLocaleString()} {totalLabel}
                </span>
            </div>

            {/* Bar Chart */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: gap,
                    height: '240px',
                    padding: '20px 0',
                    position: 'relative',
                    borderBottom: '1px solid #f0f0f0',
                }}
            >
                {aggregatedData.map((item, index) => {
                    const heightPercentage = (item.value / maxValue) * 100;
                    const isHovered = hoveredIndex === index;

                    return (
                        <div
                            key={index}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: 0,
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
                                    height: '200px',
                                    position: 'relative',
                                }}
                            >
                                {/* Value Label */}
                                <div
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#1a1a1a',
                                        marginBottom: '4px',
                                        opacity: isHovered ? 1 : 0,
                                        transition: 'opacity 0.2s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {item.value}
                                </div>

                                {/* Bar */}
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: barMaxWidth,
                                        background: isHovered ? '#f0f0f0' : '#f5f5f5',
                                        borderRadius: '4px 4px 0 0',
                                        position: 'relative',
                                        minHeight: '4px',
                                        height: `${Math.max(heightPercentage, 2)}%`,
                                        transition: 'all 0.3s ease',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {/* Bar Fill */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '100%',
                                            background: isHovered ? 'linear-gradient(180deg, #1a1a1a 0%, #4a4a4a 100%)' : 'linear-gradient(180deg, #666 0%, #999 100%)',
                                            borderRadius: '4px 4px 0 0',
                                            transition: 'all 0.3s ease',
                                            boxShadow: isHovered ? '0 0 20px rgba(26, 26, 26, 0.3)' : 'none',
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Label */}
                            <div
                                style={{
                                    fontSize: '10px',
                                    color: '#999',
                                    fontWeight: '500',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                    textAlign: 'center',
                                    visibility: shouldShowLabel(index) ? 'visible' : 'hidden',
                                }}
                                title={formatLabel(item.date, item)}
                            >
                                {formatLabel(item.date, item)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
