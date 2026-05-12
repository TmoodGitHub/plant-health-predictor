# Plant Health Predictor

An AI-powered plant health analysis tool that accepts multiple
photos of a plant taken over time and returns a structured
health report, pattern analysis, and prediction.

Built with Node.js, Express, and the Anthropic Claude API
(claude-opus-4-5 vision model).

---

## What It Does

- Accepts 2-10 plant images in chronological order
- Identifies the plant by common name, scientific name, and family
- Analyzes each image individually for health indicators
- Detects patterns across all images over time
- Predicts the plant trajectory over the next 7-14 days
- Recommends specific actions for the owner
- Saves analysis history locally for future reference
- Exports a downloadable health report

---

## Tech Stack

- **Backend:** Node.js, Express
- **AI:** Anthropic Claude API (claude-opus-4-5 vision model)
- **File Handling:** Multer (disk storage, session-based organization)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Persistence:** JSON flat file (no database required)

---

## Prerequisites

- Node.js v18 or higher
- An Anthropic API key (get one at https://console.anthropic.com)

---

## Getting Started

**1. Clone the repo**

```bash
git clone https://github.com/TmoodGitHub/plant-health-predictor.git
cd plant-health-predictor
```

**2. Install dependencies**

```bash
npm install
```

**3. Set up environment variables**

```bash
cp .env.example .env
```

Open `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_key_here
PORT=3000
```

**4. Run the app**

```bash
node server.js
```

**5. Open in your browser**

```
http://localhost:3000
```

---

## How To Use

1. Upload 2-10 photos of the same plant
2. Order them chronologically - oldest first, newest last
3. Click **Analyze**
4. Review the health report, patterns, and prediction
5. Export the report as a text file if needed
6. Past analyses are saved and accessible in the history panel

---

## Project Structure

```
plant-health-predictor/
├── server.js              - App entry point
├── routes/
│   └── analyze.js         - API route handlers
├── middleware/
│   └── upload.js          - Multer file upload config
├── prompts/
│   └── analyze.js         - Claude prompt builder
├── storage/
│   └── history.js         - Analysis history manager
├── uploads/               - Saved images per session
├── public/
│   ├── index.html         - App shell
│   ├── css/styles.css     - Styles
│   └── js/app.js          - Frontend logic
├── .env.example           - Required environment variables
└── README.md
```

---

## API Endpoints

| Method   | Endpoint                   | Description           |
| -------- | -------------------------- | --------------------- |
| `POST`   | `/api/analyze`             | Run a new analysis    |
| `GET`    | `/api/analyze/history`     | Get all past analyses |
| `GET`    | `/api/analyze/history/:id` | Get a single analysis |
| `DELETE` | `/api/analyze/history`     | Clear all history     |
| `GET`    | `/api/health`              | Server health check   |

---

## Notes

- Images are stored locally under `/uploads` organized by session ID
- Analysis history is saved to `storage/analysis_history.json`
- Neither uploads nor history are pushed to GitHub via `.gitignore`
- Maximum 10 images per analysis, 5MB per image
- Supported formats: JPEG, PNG, WEBP
