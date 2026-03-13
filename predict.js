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

// External tooltip to allow scrolling when there are many series
function getOrCreateTooltipEl(chart) {
    const parent = chart.canvas.parentNode;
    let el = parent.querySelector('.chartjs-tooltip');
    if (!el) {
        el = document.createElement('div');
        el.className = 'chartjs-tooltip';
        el.innerHTML = '<div class="chartjs-tooltip-inner"></div>';
        parent.appendChild(el);
    }
    return el;
}

const externalTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltipEl(chart);
    const inner = tooltipEl.querySelector('.chartjs-tooltip-inner');

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const title = tooltip.title?.[0] ?? '';
    const rows = (tooltip.dataPoints || []).map(dp => {
        const color = dp.dataset?.borderColor || dp.dataset?.backgroundColor || '#0ea5e9';
        return `
            <div class="tooltip-row">
                <span class="tooltip-color" style="background:${color};border-color:${color};"></span>
                <span>${dp.dataset?.label || ''}: ${dp.formattedValue}</span>
            </div>
        `;
    }).join('');

    if (inner) {
        inner.innerHTML = `
            <div class="tooltip-title">${title}</div>
            ${rows}
        `;
    }

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.pointerEvents = 'auto';
};

// Shared canvas sizing helper to prevent runaway reflow
function setCanvasSize(canvas, height = 320) {
    if (!canvas) return;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    canvas.height = height;
}

function ensureParentPositioned(canvas) {
    if (!canvas || !canvas.parentNode) return;
    const parent = canvas.parentNode;
    const style = window.getComputedStyle(parent);
    if (style.position === 'static') {
        parent.style.position = 'relative';
    }
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

    ensureParentPositioned(canvas);

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
                tooltip: {
                    enabled: false,
                    external: externalTooltipHandler,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function buildForecastChart(rows) {
    // Forecast chart removed per request
    return;
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
    // No-op: landing charts are static images now
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

    // Landing charts are now static images; skip dynamic rendering

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
