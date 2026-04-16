# 🛡️ ShieldPay

**Autonomous Parametric Income Protection for Gig Economy Workers**

ShieldPay is a fully automated, data-driven parametric insurance platform designed specifically for the modern gig economy. Delivery partners and gig workers lose income when extreme weather (heavy rain, floods, hazardous AQI, heatwaves) makes it unsafe to work. 

Traditional insurance requires manual claims, adjusters, and weeks to pay out. ShieldPay monitors hyper-local weather sensors in real-time, automatically triggering income protection payouts to affected workers' wallets the moment conditions become hazardous—**zero paperwork required**.

To ensure platform viability, ShieldPay is guarded by a **Strict Fraud Enforcement Engine** that utilizes live GPS geofencing, PPCS (Predictive Pattern Confidence Scoring), and XGBoost machine learning to permanently halt fraudulent claims before they are even processed.

---

## 🏗️ Architecture & Tech Stack

ShieldPay is built using a cleanly decoupled, three-tier architecture:

### 1. Frontend (`/frontend`)
The visual dashboard and UI for gig workers.
- **Framework:** Next.js (App Router), React
- **Styling:** Tailwind CSS, glassmorphism UI design
- **Components:** Radix UI, Recharts (for earnings graphs), Lucide React (icons)
- **Features:** Live tracking map, dynamic premium quotes, fraud/blocked claim explanations.

### 2. Backend (`/backend`)
The core processing hub, schedulers, and REST API.
- **Runtime:** Node.js, Express.js
- **Database:** PostgreSQL managed by Prisma ORM
- **Automation:** Node-Cron (30-minute interval sensor polling)
- **Features:** Parametric trigger pipeline, policy management, Strict Fraud Enforcement Engine layer.

### 3. Machine Learning (`/ml`)
Advanced fraud pattern detection.
- **Runtime:** Python, FastAPI (uvicorn)
- **Algorithms:** XGBoost (Extreme Gradient Boosting), Scikit-Learn
- **Data processing:** Pandas, Joblib
- **Features:** Multi-dimensional synthetic vector evaluation classifying claim risk probability.

---

## 🚀 Core Systems

### ⛈️ Automated Parametric Pipeline
Unlike traditional insurance where the user reports a loss, ShieldPay knows when a loss occurs.
- A **30-minute polling cron job** (`triggerScheduler.js`) hits OpenWeatherMap APIs to fetch live weather and AQI for all registered active zones (e.g., Koramangala, Indiranagar).
- If conditions exceed defined thresholds (e.g., Rainfall > 35mm/h, AQI > 300), a **Trigger Event** is instantiated.
- The pipeline queries all active policies mapping to the affected zone, checks if the worker's shift overlaps the timeline, calculates the hypothetical hourly net loss, and **automatically drafts a claim**.

### 💸 Dynamic Premium Pricing Engine
Not all zones or workers represent the same risk. Premiums are generated dynamically in real-time via `/api/policies/quote`:
- **Zone Risk Multipliers:** Historically flooded zones command higher base premiums.
- **Exposure Hours:** Gig workers driving 12h/day cost more to insure than weekend gig workers.
- **Tier Matching:** Base vs. Pro tiers dictate coverage caps.

### 🛑 Strict Fraud Enforcement Engine
Because claims are completely automated, they are ripe for abuse (e.g., GPS spoofing, automated scripts). Every single claim is routed through `fraudEngine.js`:
#### Phase 1: Hard Block Constraints (No DB write if failed)
- **Live Geofencing:** Device GPS must match registered zone. Distance > 5km mismatch yields an immediate `ZONE_NOT_VERIFIED` block.
- **Duplicate Checking:** Re-triggering the same event within a 6-hour window is barred.
- **Inception Age:** Policies less than 24h old cannot claim (prevents buying a policy while it's already raining).
#### Phase 2: Soft Scoring & PPCS Calculation
- **PPCS (Predictive Pattern Confidence Score):** A trusted score (0-100) evaluating device hygiene.
  - GPS Jitter < 0.05 (too perfect) penalizes score (indicative of root spoofing).
  - Lack of motion continuity penalizes score.
- **Claim Velocity:** Checks for spikes in individual claim frequencies across rolling 7-day windows.
#### Phase 3: ML Verification
- Remaining claims hit the Python XGBoost microservice, looking for clustered network behaviors or non-linear fraud signatures. 

---

## 🎭 Scenarios

### Scenario 1: The Honest Delivery Partner
* **Event:** Rajesh is a Zomato rider in Koramangala. A severe monsoon hits (Rainfall 60mm/h).
* **System Action:** The Cron Scheduler detects the rain via external APIs and creates a "Level 2 Rain" trigger.
* **Pipeline:** Rajesh's policy is active. His GPS confirms he is in Koramangala. 
* **Result:** The Fraud Engine logs a PPCS of 95 (healthy movement). The ML model returns 2% risk. Status = `APPROVE`. Rajesh gets a push notification that ₹850 was just routed to his wallet for the hours he couldn't work.

### Scenario 2: The Opportunistic Spoofer
* **Event:** Same monsoon in Koramangala. Akash is sitting at home in Mumbai but uses a Mock GPS root app to fake his location to Koramangala to harvest free payouts.
* **System Action:** Auto-pipeline triggers a draft claim for Akash.
* **Pipeline:** Fraud Engine evaluates Akash's device. 
* **Result:** The PPCS calculation notices the GPS coordinates have virtually zero natural jitter, and the device accelerometer reads zero motion continuity despite "driving". The Fraud Engine halts processing entirely. The claim is **never created**, saving database costs. Akash's dashboard shows a Red Blocked UI flagged for `LOW_GPS_JITTER`.

---

## 🔌 API Reference (Notable Endpoints)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/claims/auto-process` | Initiates the parametric pipeline. Blocks fraudulent payloads returning HTTP 403. |
| `GET`  | `/api/claims/fraud-log` | JWT Protected. Audit trail of every engine decision, including pre-claim blocks. |
| `POST` | `/api/policies/quote`| Accepts user metadata and calculates dynamic weekly recurring premiums. |
| `GET` | `/api/weather/live` | Geocodes Lat/Lon and returns live weather and AQI data. |

---

## 💻 Local Setup & Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rituparnaaa17/ShieldPay.git
   cd ShieldPay
   ```

2. **Boot the Backend / Database Sync:**
   ```bash
   cd backend
   npm install
   # Ensure PostgreSQL is running. Check backend/.env for DB URL
   npx prisma db push
   npx prisma generate
   npm run dev
   # Runs on http://localhost:5000
   ```

3. **Boot the Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   # Runs on http://localhost:3000
   ```

4. **Boot the ML Service (Optional):**
   ```bash
   cd ../ml
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   # Runs on http://localhost:8000
   ```

*ShieldPay — Security and stability for the workers that keep the city moving.*