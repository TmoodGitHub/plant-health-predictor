const state = {
  files: [],
  currentResult: null,
  isAnalyzing: false,
};

const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const previewGrid = document.getElementById('previewGrid');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingOverlay = document.getElementById(
  'loadingOverlay',
);
const resultsSection = document.getElementById(
  'resultsSection',
);
const historyGrid = document.getElementById('historyGrid');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

uploadZone.addEventListener('click', () =>
  fileInput.click(),
);
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const dropped = Array.from(e.dataTransfer.files).filter(
    (f) => f.type.startsWith('image/'),
  );
  addFiles(dropped);
});

fileInput.addEventListener('change', () => {
  addFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

const addFiles = (newFiles) => {
  const combined = [...state.files, ...newFiles].slice(
    0,
    10,
  );
  state.files = combined;
  renderPreviews();
  updateAnalyzeBtn();
};

const removeFile = (index) => {
  state.files.splice(index, 1);
  renderPreviews();
  updateAnalyzeBtn();
};

const renderPreviews = () => {
  previewGrid.innerHTML = '';
  state.files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
            <img src="${url}" alt="Plant image ${index + 1}" />
            <div class="preview-label">Image ${index + 1}</div>
            <button class="remove-btn" onclick="removeFile(${index})">x</button>
        `;
    previewGrid.appendChild(item);
  });
};

const updateAnalyzeBtn = () => {
  const count = state.files.length;
  analyzeBtn.disabled = count < 2 || state.isAnalyzing;
  analyzeBtn.querySelector('.btn-text').textContent =
    count === 0
      ? 'Upload at least 2 images to analyze'
      : count === 1
        ? 'Upload at least 1 more image'
        : `Analyze ${count} image${count > 1 ? 's' : ''}`;
};

const runAnalysis = async () => {
  if (state.files.length < 2 || state.isAnalyzing) return;
  state.isAnalyzing = true;
  updateAnalyzeBtn();

  resultsSection.classList.remove('active');
  loadingOverlay.classList.add('active');

  const formData = new FormData();
  state.files.forEach((file) =>
    formData.append('images', file),
  );

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Analysis failed');
    }

    state.currentResult = data.entry;
    renderResults(data.entry.result);
    loadHistory();
  } catch (error) {
    alert(`Analysis failed: ${error.message}`);
  } finally {
    state.isAnalyzing = false;
    loadingOverlay.classList.remove('active');
    updateAnalyzeBtn();
  }
};

const renderResults = (result) => {
  const {
    plant_identification: plant,
    overall_health_score: score,
    health_status,
    observations,
    patterns_detected,
    prediction,
    recommended_actions,
    confidence_level,
    confidence_reasoning,
  } = result;

  // score ring
  const circumference = 2 * Math.PI * 40;
  const offset =
    circumference - (score / 10) * circumference;
  document.getElementById(
    'scoreRingCircle',
  ).style.strokeDashoffset = offset;
  document.getElementById(
    'scoreRingCircle',
  ).style.strokeDasharray = circumference;
  document.getElementById('scoreValue').textContent = score;

  // plant ID
  document.getElementById('plantName').textContent =
    `${plant.common_name} (${plant.scientific_name})`;
  document.getElementById('plantFamily').textContent =
    `Family: ${plant.family} - ID Confidence: ${plant.confidence}`;

  // health badge
  const badge = document.getElementById('healthBadge');
  badge.textContent = health_status;
  badge.className = `health-badge ${health_status.toLowerCase()}`;

  // observations
  document.getElementById('observationsList').innerHTML =
    observations.map((o) => `<li>${o}</li>`).join('');

  // patterns
  document.getElementById('patternsList').innerHTML =
    patterns_detected.map((p) => `<li>${p}</li>`).join('');

  // prediction
  document.getElementById('predictionText').textContent =
    prediction;

  // actions
  document.getElementById('actionsList').innerHTML =
    recommended_actions
      .map((a) => `<li>${a}</li>`)
      .join('');

  // confidence
  document.getElementById('confidenceLabel').textContent =
    confidence_level;
  document.getElementById(
    'confidenceReasoning',
  ).textContent = confidence_reasoning;
  const confidenceMap = { High: 100, Medium: 60, Low: 30 };
  document.getElementById('confidenceBarFill').style.width =
    `${confidenceMap[confidence_level] || 50}%`;

  resultsSection.classList.add('active');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
};

const exportPDF = () => {
  if (!state.currentResult) return;

  const { result } = state.currentResult;
  const plant = result.plant_identification;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addLine = (text, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += size * 0.5;
    });
    y += 2;
  };

  addLine('PLANT HEALTH ANALYSIS REPORT', 16, true);
  addLine(`Generated: ${new Date().toLocaleString()}`, 9);
  y += 4;

  addLine('PLANT IDENTIFICATION', 13, true);
  addLine(`Common Name: ${plant.common_name}`);
  addLine(`Scientific Name: ${plant.scientific_name}`);
  addLine(`Family: ${plant.family}`);
  addLine(`ID Confidence: ${plant.confidence}`);
  addLine(
    `Identifying Features: ${plant.identifying_features}`,
  );
  y += 4;

  addLine('HEALTH SUMMARY', 13, true);
  addLine(
    `Overall Score: ${result.overall_health_score}/10`,
  );
  addLine(`Status: ${result.health_status}`);
  y += 4;

  addLine('OBSERVATIONS', 13, true);
  result.observations.forEach((o, i) =>
    addLine(`${i + 1}. ${o}`),
  );
  y += 4;

  addLine('PATTERNS DETECTED', 13, true);
  result.patterns_detected.forEach((p, i) =>
    addLine(`${i + 1}. ${p}`),
  );
  y += 4;

  addLine('PREDICTION (Next 7-14 Days)', 13, true);
  addLine(result.prediction);
  y += 4;

  addLine('RECOMMENDED ACTIONS', 13, true);
  result.recommended_actions.forEach((a, i) =>
    addLine(`${i + 1}. ${a}`),
  );
  y += 4;

  addLine('CONFIDENCE', 13, true);
  addLine(`Level: ${result.confidence_level}`);
  addLine(`Reasoning: ${result.confidence_reasoning}`);

  doc.save(
    `plant-health-${plant.common_name.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
  );
};

const loadHistory = async () => {
  try {
    const res = await fetch('/api/analyze/history');
    const data = await res.json();

    if (!data.success || data.history.length === 0) {
      historyGrid.innerHTML = `<p style="color: var(--text-secondary)">No analyses yet.</p>`;
      return;
    }

    historyGrid.innerHTML = data.history
      .map(
        (entry) => `
      <div class="history-card" onclick="loadHistoryEntry('${entry.id}')">
        <div class="plant-name">${entry.plant_name}</div>
        <div class="history-meta">
          ${new Date(entry.timestamp).toLocaleString()} - 
          ${entry.imageCount} image${entry.imageCount > 1 ? 's' : ''}
        </div>
        <div class="history-score">
          <span class="health-badge ${entry.health_status.toLowerCase()}">
            ${entry.health_status}
          </span>
          <span style="font-weight: 600; color: var(--primary-light)">
            ${entry.overall_health_score}/10
          </span>
        </div>
      </div>
    `,
      )
      .join('');
  } catch (error) {
    console.error('Failed to load history:', error);
  }
};

const loadHistoryEntry = async (id) => {
  try {
    const res = await fetch(`/api/analyze/history/${id}`);
    const data = await res.json();
    if (data.success) {
      state.currentResult = data.entry;
      renderResults(data.entry.result);
    }
  } catch (error) {
    console.error('Failed to load entry:', error);
  }
};

analyzeBtn.addEventListener('click', runAnalysis);
exportBtn.addEventListener('click', exportPDF);

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all analysis history?')) return;
  try {
    await fetch('/api/analyze/history', {
      method: 'DELETE',
    });
    loadHistory();
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
});

updateAnalyzeBtn();
loadHistory();
