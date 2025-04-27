import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DailyContactsChart = ({ brandId, listId, days = 30, status = 'all' }) => {
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState(days);

    // Colors for each status type
    const statusColors = {
        active: '#5d87ff', // Primary blue
        unsubscribed: '#f59e0b', // Warning yellow
        bounced: '#ef4444', // Error red
        complained: '#ef4444', // Also red for complaints
    };

    // Fetch daily contacts data
    useEffect(() => {
        const fetchDailyStats = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`/api/brands/${brandId}/contact-lists/${listId}/daily-stats?days=${timeRange}&status=${status}`, { credentials: 'same-origin' });

                if (!response.ok) {
                    throw new Error('Failed to fetch daily contact stats');
                }

                const data = await response.json();

                // Format dates and calculate totals
                const formattedData = data.dailyData.map((day) => ({
                    ...day,
                    formattedDate: formatDate(day.date),
                }));

                setChartData(formattedData);
                setIsLoading(false);
            } catch (err) {
                console.error('Error fetching daily stats:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        if (brandId && listId) {
            fetchDailyStats();
        }
    }, [brandId, listId, timeRange, status]);

    // Change time range handler
    const handleTimeRangeChange = (days) => {
        setTimeRange(days);
    };

    // Format date for display
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Custom tooltip component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="daily-chart-tooltip">
                    <p className="tooltip-date">{label}</p>
                    <div className="tooltip-content">
                        {payload.map((entry, index) => (
                            <div
                                className="tooltip-item"
                                key={index}
                            >
                                <span
                                    className="tooltip-color"
                                    style={{ backgroundColor: entry.color }}
                                ></span>
                                <span className="tooltip-name">{entry.name}:</span>
                                <span className="tooltip-value">{entry.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="daily-chart-container">
                <div className="daily-chart-loading">
                    <div className="spinner-small"></div>
                    <p>Loading chart data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="daily-chart-container">
                <div className="daily-chart-error">
                    <p>Failed to load chart data: {error}</p>
                </div>
            </div>
        );
    }

    if (!chartData || chartData.length === 0) {
        return (
            <div className="daily-chart-container">
                <div className="daily-chart-empty">
                    <p>No contact data available for the selected period</p>
                </div>
            </div>
        );
    }

    return (
        <div className="daily-chart-container">
            <div className="daily-chart-header">
                <h3 className="daily-chart-title">Daily Contact Activity</h3>
                <div className="daily-chart-controls">
                    <div className="time-range-selector">
                        <button
                            className={`time-range-btn ${timeRange === 7 ? 'active' : ''}`}
                            onClick={() => handleTimeRangeChange(7)}
                        >
                            7 Days
                        </button>
                        <button
                            className={`time-range-btn ${timeRange === 30 ? 'active' : ''}`}
                            onClick={() => handleTimeRangeChange(30)}
                        >
                            30 Days
                        </button>
                        <button
                            className={`time-range-btn ${timeRange === 90 ? 'active' : ''}`}
                            onClick={() => handleTimeRangeChange(90)}
                        >
                            90 Days
                        </button>
                    </div>
                </div>
            </div>

            <div className="daily-chart">
                <ResponsiveContainer
                    width="100%"
                    height={350}
                >
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#2e2e2e"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
                            axisLine={{ stroke: '#2e2e2e' }}
                            tickLine={{ stroke: '#2e2e2e' }}
                            angle={-45}
                            textAnchor="end"
                            height={70}
                            interval={Math.ceil(chartData.length / 20)}
                        />
                        <YAxis
                            tick={{ fill: 'rgba(255, 255, 255, 0.7)' }}
                            axisLine={{ stroke: '#2e2e2e' }}
                            tickLine={{ stroke: '#2e2e2e' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            wrapperStyle={{ paddingBottom: 10 }}
                            formatter={(value) => <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}>{value}</span>}
                        />
                        <Bar
                            dataKey="active"
                            name="Active"
                            fill={statusColors.active}
                            stackId="a"
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="unsubscribed"
                            name="Unsubscribed"
                            fill={statusColors.unsubscribed}
                            stackId="a"
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="bounced"
                            name="Bounced"
                            fill={statusColors.bounced}
                            stackId="a"
                            radius={[0, 0, 0, 0]}
                        />
                        <Bar
                            dataKey="complained"
                            name="Complained"
                            fill={statusColors.complained}
                            stackId="a"
                            radius={[2, 2, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="daily-chart-summary">
                {chartData.length > 0 && (
                    <div className="summary-stats">
                        <div className="summary-stat">
                            <span className="stat-label">Total Contacts:</span>
                            <span className="stat-value">{chartData.reduce((sum, day) => sum + day.count, 0)}</span>
                        </div>
                        <div className="summary-stat">
                            <span className="stat-label">Avg. Daily:</span>
                            <span className="stat-value">{Math.round(chartData.reduce((sum, day) => sum + day.count, 0) / chartData.length)}</span>
                        </div>
                        <div className="summary-stat">
                            <span className="stat-label">Active Rate:</span>
                            <span className="stat-value">
                                {Math.round(
                                    (chartData.reduce((sum, day) => sum + day.active, 0) /
                                        Math.max(
                                            1,
                                            chartData.reduce((sum, day) => sum + day.count, 0)
                                        )) *
                                        100
                                )}
                                %
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyContactsChart;
