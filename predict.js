// Predict enrollment based on stored selections and CSV data
const CSV_PATH = 'data.csv';
let chartInstance = null;
let totalTrendChart = null;
let deptTrendChart = null;
let forecastChart = null;

// Custom HTML legend plugin for scrollable legends
const htmlLegendPlugin = {
    id: 'htmlLegend',
    afterUpdate(chart, args, options) {
        const legendId = options?.containerID;
        if (!legendId) return;
        const container = document.getElementById(legendId);
        if (!container) return;

        const items = chart.options.plugins.legend.labels.generateLabels(chart);
        container.innerHTML = items.map(item => `
            <div style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:12px;color:#0f172a;">
                <span style="width:12px;height:12px;border-radius:3px;background:${item.fillStyle};display:inline-block;border:1px solid rgba(0,0,0,0.08);"></span>
                <span>${item.text}</span>
            </div>
        `).join('');
    }
};

// Shared canvas sizing helper to prevent runaway reflow
function setCanvasSize(canvas, height = 320) {
    if (!canvas) return;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    canvas.height = height;
}

function getSelectionsFromForm() {
    const academicYearSelect = document.getElementById('academicYear');
    const departmentSelect = document.getElementById('department');
    return {
        selectedYear: (academicYearSelect?.value || '').trim(),
        selectedDepartment: (departmentSelect?.value || '').trim()
    };
}

function updateSelectionText({ selectedYear, selectedDepartment }) {
    const yearEl = document.getElementById('resultYear');
    const deptEl = document.getElementById('resultCourse');
    if (yearEl) yearEl.textContent = selectedYear || '—';
    if (deptEl) deptEl.textContent = selectedDepartment || '—';
}

function setResultValue(text) {
    const valueEl = document.getElementById('resultValue');
    if (valueEl) valueEl.textContent = text;
}

function toggleResults(show) {
    const section = document.getElementById('resultsSection');
    if (!section) return;
    section.classList.toggle('hidden', !show);
}

function buildChart(departmentRows) {
    const canvas = document.getElementById('predictionChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labelsAndValues = departmentRows
        .map(row => ({ year: parseInt(row.Year, 10), value: parseInt(row.Predicted_Enrollment, 10) }))
        .filter(item => !Number.isNaN(item.year) && !Number.isNaN(item.value))
        .sort((a, b) => a.year - b.year);

    const labels = labelsAndValues.map(item => item.year);

    if (chartInstance) {
        chartInstance.destroy();
    }

    setCanvasSize(canvas, 320);
    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Predicted Enrollment',
                data: labelsAndValues.map(item => item.value),
                borderColor: '#0f766e',
                backgroundColor: 'rgba(15,118,110,0)',
                tension: 0.25,
                pointRadius: 4,
                pointBackgroundColor: '#0f766e',
                fill: false,
                // Dash forecast years (>=2026) similar to reference chart style
                segment: {
                    borderDash: ctx => (labels[ctx.p0DataIndex] >= 2026 ? [6, 6] : undefined)
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.4,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function buildForecastChart(rows) {
    const canvas = document.getElementById('forecastChart');
    const legendContainer = document.getElementById('forecastLegend');
    if (!canvas || typeof Chart === 'undefined') return;

    // Prepare series for 2021-2028 with dashed forecast for 2026-2028
    const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];

    // Historical seed values roughly from provided reference chart (can be adjusted)
    const historicalSeeds = {
        Biochemistry: [30, 25, 30, 32, 38],
        Biotechnology: [62, 58, 63, 68, 71],
        Botany: [55, 55, 60, 58, 52],
        Chemistry: [160, 95, 92, 105, 88],
        'Computer Animation': [8, 12, 6, 10, 12],
        'Computer Science': [70, 90, 94, 83, 80],
        'Data Science': [90, 75, 100, 100, 115],
        Economics: [18, 22, 16, 20, 5],
        Electronics: [18, 12, 12, 14, 22],
        'Food Science': [62, 58, 58, 70, 45],
        Mathematics: [100, 75, 73, 68, 55],
        Microbiology: [55, 38, 56, 62, 30],
        Physics: [30, 24, 34, 48, 22],
        Psychology: [88, 70, 32, 60, 42],
        Statistics: [16, 12, 32, 0, 44],
        'Visual Communication': [20, 22, 12, 14, 38],
        Zoology: [88, 70, 32, 100, 117]
    };

    // Merge CSV forecasts (2026-2028)
    const forecasts = rows.reduce((acc, row) => {
        const dept = (row.Department || '').trim();
        if (!dept) return acc;
        acc[dept] = [
            parseInt(row.Predicted_2026, 10),
            parseInt(row.Predicted_2027, 10),
            parseInt(row.Predicted_2028, 10)
        ];
        return acc;
    }, {});

    const palette = [
        '#0ea5e9','#f97316','#22c55e','#ef4444','#8b5cf6','#f59e0b','#14b8a6',
        '#94a3b8','#e11d48','#10b981','#6366f1','#16a34a','#eab308','#64748b',
        '#a855f7','#0ea5e9','#ef4444','#22c55e'
    ];

    const datasets = Object.entries(forecasts).map(([dept, forecastVals], idx) => {
        const hist = historicalSeeds[dept] || [];
        const data = [...hist, ...forecastVals].map(v => (Number.isFinite(v) ? v : null));

        // Build border styles: solid for hist, dashed for forecast segment
        const segments = {
            borderDash: ctx => {
                const i = ctx.p0DataIndex;
                return i >= hist.length - 1 ? [6, 6] : undefined;
            }
        };

        return {
            label: dept,
            data,
            borderColor: palette[idx % palette.length],
            backgroundColor: palette[idx % palette.length],
            pointRadius: 3,
            tension: 0.32,
            fill: false,
            segment: segments
        };
    });

    if (forecastChart) forecastChart.destroy();
    setCanvasSize(canvas, 340);
        forecastChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: years, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.2,
                animation: false,
                layout: { padding: { right: 12 } },
                plugins: {
                    legend: legendContainer ? { display: false } : {
                        position: 'bottom',
                        align: 'start',
                        labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
                },
                htmlLegend: legendContainer ? { containerID: 'forecastLegend' } : undefined,
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        },
        plugins: legendContainer ? [htmlLegendPlugin] : []
    });
}

// ----- Landing charts (before Generate Prediction) -----
const totalTrendData = {
    labels: [2021, 2022, 2023, 2024, 2025],
    values: [750, 690, 770, 890, 845]
};

const departmentTrendData = {
    labels: [2021, 2022, 2023, 2024, 2025],
    series: {
        Biochemistry: [25, 35, 45, 55, 20],
        Biotechnology: [60, 58, 52, 65, 40],
        Botany: [50, 53, 60, 54, 30],
        Chemistry: [160, 95, 92, 105, 97],
        'Computer Animation': [35, 67, 100, 82, 83],
        'Computer Science': [70, 88, 95, 85, 82],
        'Data Science': [90, 68, 100, 100, 115],
        Economics: [18, 22, 16, 20, 5],
        Electronics: [20, 16, 19, 23, 30],
        'Food Science': [62, 60, 58, 70, 45],
        Mathematics: [100, 75, 73, 68, 55],
        Microbiology: [55, 38, 56, 62, 30],
        Physics: [30, 24, 34, 48, 22],
        Psychology: [28, 16, 0, 12, 32],
        Statistics: [16, 12, 32, 0, 44],
        'Visual Communication': [20, 22, 12, 14, 38],
        Zoology: [88, 70, 32, 100, 117]
    }
};

function buildLandingCharts() {
    if (typeof Chart === 'undefined') return;

    const totalCanvas = document.getElementById('totalTrendChart');
    const deptCanvas = document.getElementById('deptTrendChart');

    const totalCtx = totalCanvas?.getContext('2d');
    const deptCtx = deptCanvas?.getContext('2d');

    if (totalCtx) {
        if (totalTrendChart) totalTrendChart.destroy();
        setCanvasSize(totalCanvas, 220);
        totalTrendChart = new Chart(totalCtx, {
            type: 'line',
            data: {
                labels: totalTrendData.labels,
                datasets: [{
                    label: 'Total Enrollment',
                    data: totalTrendData.values,
                    borderColor: '#0f766e',
                    backgroundColor: 'rgba(15,118,110,0.16)',
                    pointBackgroundColor: '#0f766e',
                    pointRadius: 4,
                    tension: 0.32,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.2,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: { precision: 0 }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    if (deptCtx) {
        if (deptTrendChart) deptTrendChart.destroy();
        setCanvasSize(deptCanvas, 220);
        const palette = [
            '#0ea5e9','#f97316','#22c55e','#ef4444','#8b5cf6','#f59e0b','#14b8a6',
            '#94a3b8','#e11d48','#10b981','#6366f1','#16a34a','#eab308','#64748b',
            '#a855f7','#0ea5e9','#ef4444','#22c55e'
        ];

        const datasets = Object.entries(departmentTrendData.series).map(([name, values], idx) => ({
            label: name,
            data: values,
            borderColor: palette[idx % palette.length],
            backgroundColor: palette[idx % palette.length],
            pointRadius: 3,
            tension: 0.32,
            fill: false
        }));

        deptTrendChart = new Chart(deptCtx, {
            type: 'line',
            data: {
                labels: departmentTrendData.labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.2,
                layout: { padding: { right: 12 } },
                animation: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'start',
                        labels: {
                            boxWidth: 12,
                            padding: 12,
                            font: { size: 11 }
                        }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function renderPrediction(rows, selections) {
    const { selectedYear, selectedDepartment } = selections;
    if (!selectedYear || !selectedDepartment) {
        setResultValue('Pick an academic year and department to see predictions.');
        toggleResults(true);
        return;
    }

    const targetDept = selectedDepartment.toLowerCase();
    const targetYear = selectedYear.trim();

    // Support both tall format (Department,Year,Predicted_Enrollment) and wide format (Predicted_2026, Predicted_2027, Predicted_2028)
    const cleanedRows = rows.map(row => {
        const dept = (row.Department || '').trim();
        if (row.Year !== undefined && row.Predicted_Enrollment !== undefined) {
            return [{
                Department: dept,
                Year: (row.Year || '').toString().trim(),
                Predicted_Enrollment: (row.Predicted_Enrollment || '').toString().trim()
            }];
        }

        const entries = [];
        const wideKeys = [
            { key: 'Predicted_2026', year: '2026' },
            { key: 'Predicted_2027', year: '2027' },
            { key: 'Predicted_2028', year: '2028' }
        ];
        wideKeys.forEach(({ key, year }) => {
            if (row[key] !== undefined) {
                entries.push({
                    Department: dept,
                    Year: year,
                    Predicted_Enrollment: (row[key] || '').toString().trim()
                });
            }
        });
        return entries;
    }).flat();

    const departmentRows = cleanedRows.filter(r => r.Department.toLowerCase() === targetDept);
    const match = departmentRows.find(r => r.Year === targetYear);

    if (match && match.Predicted_Enrollment) {
        setResultValue(`${match.Predicted_Enrollment} Students`);
    } else {
        setResultValue('No prediction data available.');
    }

    toggleResults(true);
    buildChart(departmentRows);
    buildForecastChart(rows);
}

function loadCsvAndRender(selections) {
    setResultValue('Loading prediction...');
    toggleResults(true);
    Papa.parse(CSV_PATH, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const rows = Array.isArray(results.data) ? results.data : [];
            renderPrediction(rows, selections);
        },
        error: () => {
            setResultValue('No prediction data available.');
            toggleResults(true);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const academicYearSelect = document.getElementById('academicYear');
    const departmentSelect = document.getElementById('department');
    const generateButton = document.getElementById('generatePrediction');

    // Build landing charts immediately
    buildLandingCharts();

    const handlePredict = () => {
        const selections = getSelectionsFromForm();
        updateSelectionText(selections);
        loadCsvAndRender(selections);
    };

    generateButton?.addEventListener('click', handlePredict);
    academicYearSelect?.addEventListener('change', () => {
        if (!document.body.classList.contains('auto-preview')) return;
        handlePredict();
    });
    departmentSelect?.addEventListener('change', () => {
        if (!document.body.classList.contains('auto-preview')) return;
        handlePredict();
    });

    // Optional: auto preview on load using defaults
    handlePredict();
});
