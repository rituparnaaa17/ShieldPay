# ShieldPay Fraud Detection System

## Overview

This document outlines the comprehensive fraud detection system designed to prevent insurance fraud in ShieldPay, with specific focus on VPN-based location spoofing, document forgery, policy stacking, and claim velocity abuse.

---

## 1. Fraud Vectors & Threats

### 1.1 Primary Threat: VPN/Location Spoofing

**Scenario:** A fraudster uses VPN to appear in a disaster-affected zone (high risk, high premiums) to claim insurance fraudulently.

**Detection:**

- IP geolocation verification via VPN detection APIs (AbuseIPDB, MaxMind)
- Device fingerprinting with IP/country tracking
- Impossible travel detection (same user in different countries within 2 hours)
- Location consistency checks (policy registered location vs. claim location)

### 1.2 Document Forgery

**Scenario:** Fake Aadhaar, PAN, or DL numbers to get a new account & claim multiple times.

**Detection:**

- Identity hash duplicates across users (multiple workers can't share Aadhaar)
- KYC verification requirement (manual + AI-based)
- Document hashing prevents storing raw sensitive data

### 1.3 Policy Stacking

**Scenario:** Same person registers multiple times to buy multiple policies & claim multiple times.

**Detection:**

- Active policy count per user (should max out at 1-2)
- Beneficiary account linking (same bank account = red flag)
- Device fingerprint tracking

### 1.4 Claim Timing / Cooling-Off Period

**Scenario:** Buy policy → 5 minutes later → file claim during disaster, get covered for pre-existing injury.

**Detection:**

- 48-hour cooling-off period (block claims in first 48h)
- Claim velocity checks (max 2 claims per 30 days is normal)
- Timestamp auditing

### 1.5 Income Manipulation

**Scenario:** Claim ultra-high income to get lower premiums (inverse incentive), then claim an accident.

**Detection:**

- Statistical outlier detection (3σ away = flag)
- Income consistency checks vs. work type
- Sector-based expectation matching

### 1.6 Account Takeover & Device Anomalies

**Scenario:** Stolen credentials used to file fraudulent claims from new device.

**Detection:**

- Device fingerprinting (device ID, OS, browser, IP, ISP)
- Login anomaly detection
- Multi-device tracking per user

### 1.7 Beneficiary Fraud

**Scenario:** Multiple workers redirect claims to same bank account (syndicated fraud ring).

**Detection:**

- Beneficiary account indexing
- Count unique users per account
- Alert on >1 user per account

---

## 2. Database Schema Extensions

### Key Tables

#### `device_fingerprints`

Tracks all devices a user accesses their account from.

```sql
- device_id (hashed)
- os_name, browser_name
- ip_address, ip_country, ip_city
- is_vpn, is_proxy (boolean flags)
- last_seen timestamp
```

#### `identity_verification`

KYC & document verification status.

```sql
- kyc_status: pending | verified | rejected | expired
- aadhaar_hash, pan_hash, dl_hash (never store raw)
- verified_by, verification_date
- rejection_reason
```

#### `fraud_flags`

Active fraud alerts for a user.

```sql
- flag_type: 'vpn_detected', 'location_mismatch', 'duplicate_identity', 'claim_velocity', etc.
- severity: 'low', 'medium', 'high', 'critical'
- is_active: boolean (resolved flags are marked FALSE)
- metadata: JSONB (flexible context storage)
```

#### `fraud_risk_scores`

Aggregated fraud risk per user (updated regularly).

```sql
- overall_score: 0-100 (higher = more fraudulent)
- kyc_score, location_score, device_score, velocity_score, duplicate_score
- risk_level: 'low', 'medium', 'high', 'very_high'
- action_required: NULL | 'manual_review' | 'block' | 'request_verification'
```

#### `claim_activity`

Audit log of all claims with fraud review status.

```sql
- claim_amount, claim_status
- submitted_at, approved_at
- fraud_review: NULL (pending) | TRUE (flagged) | FALSE (clean)
```

#### `policy_changes_audit`

Log of all policy modifications for suspicious activity detection.

```sql
- change_type: 'created', 'upgraded', 'cancelled', 'claim_filed'
- old_values, new_values (JSONB for flexibility)
- changed_at timestamp
```

---

## 3. Fraud Detection Services

### `fraudService.js`

Key functions:

#### `checkVPNAndProxy(ipAddress)`

Calls VPN detection APIs (AbuseIPDB, IPQualityScore, MaxMind).
Returns: `{ isVPN, isProxy, threatScore, provider }`

**Integration example:**

```javascript
// Replace mock with real API
const response = await fetch("https://api.abuseipdb.com/api/v2/check", {
  headers: { Key: process.env.ABUSEIPDB_API_KEY },
  body: { ipAddress },
});
```

#### `recordDeviceFingerprint(userId, deviceData)`

Creates SHA256 hash of device signature, checks for VPN, stores in DB.

#### `checkLocationMismatch(userId, currentCity, currentCountry, workerCity)`

Detects:

- Country mismatches
- Impossible travel (2+ countries in <2 hours)
- City mismatch vs. registered city

Returns: `{ mismatch, riskScore, warnings, lastLocation }`

#### `checkIdentityDuplication(identifierHash, type)`

Checks if Aadhaar/PAN/DL is already registered to another user.

Returns: `{ isDuplicate, duplicateCount, otherUsers }`

#### `checkBeneficiaryFraud(userId, accountNumber)`

Finds all users linked to the same bank account.

Returns: `{ isFraudRisk, linkedUserCount, linkedUsers, riskScore }`

#### `checkClaimVelocity(userId, timeWindowDays = 30)`

Flags if user requests >2 claims in 30 days.

Returns: `{ claimCount, isSuspicious, riskScore, message }`

#### `checkPolicyStacking(userId)`

Counts active policies. >1 active policy = stacking risk.

Returns: `{ activeCount, isStackingRisk, riskScore }`

#### `checkPolicyCoolingOff(policyId)`

Blocks claims within 48 hours of policy creation.

Returns: `{ isWithinCoolingOff, hoursSinceCreation, riskScore }`

#### `checkIncomeOutlier(workType, reportedIncome)`

Statistical outlier detection (3σ = 99.7% confidence it's fake).

Returns: `{ isOutlier, zScore, avgIncomeForWorkType, riskScore }`

#### `calculateFraudRiskScore(userId, userContext)`

**PRIMARY FUNCTION** — Aggregates all checks into a weighted overall score.

**Weights:**

```javascript
- kyc_score: 25%
- location_score: 25%
- device_score: 20%
- velocity_score: 20%
- duplicate_score: 10%
```

**Output:**

```javascript
{
  userId,
  overallScore: 0-100,
  scores: { kyc, location, device, velocity, duplicate },
  riskLevel: 'low' | 'medium' | 'high' | 'very_high',
  actionRequired: null | 'manual_review' | 'request_verification' | 'block',
  flags: [ { type, severity, desc }, ... ],
  recommendation: "✅ Low risk - proceed" | "🔍 Manual review" | "⚠️ Verification needed" | "❌ Blocked"
}
```

**Risk Thresholds:**

- `low`: < 20
- `medium`: 20-40
- `high`: 40-70
- `very_high`: > 70

---

## 4. API Endpoints

### User Endpoints

#### `POST /api/fraud/risk-profile/:user_id`

Get current fraud risk profile for a user.

**Request:**

```json
{
  "device_data": {
    "deviceId": "abc123",
    "deviceName": "iPhone 14",
    "osName": "iOS",
    "browserName": "Safari",
    "ipAddress": "203.0.113.45",
    "ipCountry": "IN",
    "ipCity": "Mumbai"
  },
  "current_location": {
    "city": "Delhi",
    "country": "IN"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "overallScore": 35,
    "scores": {
      "kyc": 20,
      "location": 15,
      "device": 0,
      "velocity": 0,
      "duplicate": 0
    },
    "riskLevel": "medium",
    "actionRequired": "manual_review",
    "flags": [
      {
        "type": "unverified_kyc",
        "severity": "medium",
        "desc": "KYC Status: pending"
      }
    ],
    "recommendation": "🔍 Manual review recommended"
  }
}
```

#### `POST /api/fraud/kyc/:user_id`

Submit KYC documents.

**Request:**

```json
{
  "aadhaar_number": "123456789012",
  "pan_number": "ABCDE1234F",
  "dl_number": "KA-DL-0001-2020"
}
```

**Response:**

```json
{
  "success": true,
  "message": "KYC documents submitted for verification",
  "data": {
    "kycStatus": "pending",
    "submittedAt": "2026-04-03T10:00:00Z",
    "estimatedVerificationTime": "24-48 hours"
  }
}
```

#### `POST /api/fraud/beneficiary-check`

Check if beneficiary account is linked to multiple workers.

**Request:**

```json
{
  "user_id": "user123",
  "account_number": "9876543210"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accountNumber": "****3210",
    "linkedWorkerCount": 1,
    "isFraudRisk": false,
    "riskScore": 0,
    "recommendation": "✅ Account appears to be unique to this user"
  }
}
```

#### `POST /api/fraud/verify-claim`

Verify claim before approval (called by claims processing).

**Request:**

```json
{
  "user_id": "user123",
  "policy_id": "policy456",
  "claim_amount": 50000
}
```

**Response:**

```json
{
  "success": true,
  "claimVerification": {
    "userId": "user123",
    "policyId": "policy456",
    "claimAmount": 50000,
    "recommendation": "APPROVE - Low fraud risk",
    "fraudRiskDetected": false,
    "fraudIndicators": [],
    "detailedScores": {
      "overallRisk": 15,
      "claimVelocity": 0,
      "coolingOffRisk": 0
    }
  }
}
```

---

### Admin Endpoints

#### `PATCH /api/fraud/kyc/:user_id/approve`

Admin reviews and approves/rejects KYC.

**Request:**

```json
{
  "verified_by": "admin@shieldpay.com",
  "approved": true,
  "reviewer_notes": "All documents verified against government records"
}
```

#### `PATCH /api/fraud/flag/:flag_id/resolve`

Admin resolves a fraud flag (dispute resolution).

**Request:**

```json
{
  "resolution": "false_positive",
  "admin_notes": "User proved they were traveling legally (flight confirmation)"
}
```

---

## 5. Implementation Roadmap

### Phase 1: Core Detection (Now)

- ✅ Device fingerprinting
- ✅ Location consistency checks
- ✅ KYC tracking
- ✅ Identity duplication detection
- ✅ Claim velocity checks
- ✅ Policy stacking detection
- ✅ Beneficiary linking

### Phase 2: External APIs (Next)

- [ ] AbuseIPDB integration for real VPN detection
- [ ] MaxMind GeoIP2 for accurate location data
- [ ] OCBC/Aadhaar e-KYC API for instant verification
- [ ] Document OCR (Tesseract or AWS Textract)

### Phase 3: ML/AI Improvements (Future)

- [ ] Behavioral analytics (claim pattern ML model)
- [ ] Device risk scoring (TensorFlow)
- [ ] Anomaly detection (Isolation Forest for income outliers)
- [ ] Network analysis (detect fraud rings via graph DB)

### Phase 4: Legal/Compliance

- [ ] GDPR-compliant document storage (encrypted encryption keys)
- [ ] PII redaction for logs
- [ ] Audit trail immutability
- [ ] Dispute resolution workflow

---

## 6. Usage Examples

### Example 1: User Signs Up from VPN

```javascript
// Frontend sends deviceData with IP 8.8.8.8 (Google DNS, flagged as proxy)
const riskProfile = await calculateFraudRiskScore(userId, {
  deviceData: { ipAddress: '8.8.8.8', ipCountry: 'US', ... }
});

// Returns:
// overallScore: 35, deviceScore: 35, flags: [{ type: 'vpn_detected', severity: 'high' }]
// action: 'request_verification'
```

### Example 2: Same User in Mumbai & Delhi in 1 Hour

```javascript
// User in Mumbai at 10:00 AM, Delhi at 10:30 AM
const locationCheck = await checkLocationMismatch(
  userId,
  "Delhi",
  "IN",
  "Mumbai",
);

// Returns:
// mismatch: true, riskScore: 30, warnings: ['Impossible travel: IN → IN in 0.5h']
// (Actually same country but different cities)
```

### Example 3: User Files 3 Claims in 2 Weeks

```javascript
const velocityCheck = await checkClaimVelocity(userId, 30);

// Returns:
// claimCount: 3, isSuspicious: true, riskScore: 45
// message: '3 claims in 30 days'
```

### Example 4: Policy Stacking

```javascript
const stackingCheck = await checkPolicyStacking(userId);

// If 3 active policies:
// activeCount: 3, isStackingRisk: true, riskScore: 50
```

---

## 7. Configuration & Env Variables

```bash
# .env
# Fraud Detection API Keys
ABUSEIPDB_API_KEY=your_key_here
MAXMIND_LICENSE_KEY=your_key_here
AADHAAR_E_KYC_API_KEY=your_key_here

# Fraud Thresholds
FRAUD_BLOCK_THRESHOLD=70
FRAUD_MANUAL_REVIEW_THRESHOLD=40
CLAIM_VELOCITY_WINDOW_DAYS=30
CLAIM_COOLING_OFF_HOURS=48
```

---

## 8. Monitoring & Alerts

### Real-Time Alerts

1. **User submits KYC from VPN** → Flag as medium risk
2. **Multiple workers same beneficiary** → Flag as high risk
3. **Claim within 48h of policy** → Flag as medium risk
4. **>2 claims per month** → Flag as high risk
5. **Overall score >70** → Auto-block

### Dashboards (Future)

- Fraud risk by city/zone
- Top fraud indicators
- False positive rate
- Resolution time SLA

---

## 9. Testing

### Unit Tests

```bash
npm test -- fraudService.test.js
```

### Integration Tests

```bash
npm test -- fraud.integration.test.js
```

### Load Testing (VPN Detection API)

```bash
# Test API response times
npm run load-test -- fraud/risk-profile
```

---

## 10. FAQ

**Q: How often is fraud risk recalculated?**
A: Every transaction (quote, policy, claim). Can be optimized to hourly/daily for scale.

**Q: What if a legitimate user triggers fraud flags?**
A: Dispute resolution workflow — admin can mark flags as 'false_positive'.

**Q: How long is KYC data stored?**
A: Document hashes permanently, but raw documents deleted after 7 days.

**Q: Can fraudsters bypass the system?**
A: No single method is 100% foolproof. We use **defense in depth** — 7+ independent checks make it very expensive to fraud.

---

## 11. References

- NIST Fraud Prevention Guide: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nist.sp.800-53r5.pdf
- Insurance Fraud Bureau: https://www.ifb.org.uk/
- AbuseIPDB VPN Detection: https://www.abuseipdb.com/
- MaxMind GeoIP: https://www.maxmind.com/
