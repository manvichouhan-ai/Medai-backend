# API CONTRACT AUDIT
**Generated:** 2026-05-10
**Scope:** Complete Frontend Codebase API Analysis

---

## EXECUTIVE SUMMARY

This audit documents ALL API endpoints used in the frontend codebase, including:
- **12 API service files** in `src/api/`
- **42+ unique endpoints** across 6 different domains
- **38+ React Query hooks** in `src/hooks/queries.ts`
- **Multiple response shape inconsistencies** detected
- **Duplicate medication architecture** (legacy vs new)
- **Mixed ID field usage** (`id` vs `_id`)

---

# API INVENTORY

## AUTHENTICATION API (`src/api/auth.ts`)

### POST /auth/login
**Method:** POST  
**URL:** `/auth/login`

**Used In:**
- `src/context/AuthContext.tsx` (login function)

**Request Details:**
- Body: `{ email: string, password: string }`
- Headers: Authorization via Bearer token (auto-added by interceptor)

**Expected Payload Shape:**
```typescript
{
  email: string;
  password: string;
}
```

**Expected Response Shape:**
```typescript
{
  user: User;
  accessToken: string;
}
```
- Note: Response may return `{ user: {...} }` or user object directly

**React Query Keys:** None (direct API call)

**Status:** USED

**Problems:**
- Response shape inconsistency: backend may return `{ user: {...} }` or user object directly
- Uses `any` type in response handling (line 15-16)

---

### POST /auth/register
**Method:** POST  
**URL:** `/auth/register`

**Used In:**
- `src/context/AuthContext.tsx` (register function)

**Request Details:**
- Body: 
```typescript
{
  email: string;
  password: string;
  fullName: string;
  role?: Role;
  phone?: string;
  timezone?: string;
}
```

**Expected Response Shape:**
```typescript
{
  user: User;
  accessToken: string;
}
```

**React Query Keys:** None (direct API call)

**Status:** USED

**Problems:**
- Same response shape inconsistency as login

---

### POST /auth/refresh
**Method:** POST  
**URL:** `/auth/refresh`

**Used In:**
- None (defined but not called in codebase)

**Request Details:**
- Body: None

**Expected Response Shape:**
```typescript
{
  accessToken: string;
}
```

**React Query Keys:** None

**Status:** UNUSED

**Problems:**
- Defined but never called - potential dead code

---

### POST /auth/logout
**Method:** POST  
**URL:** `/auth/logout`

**Used In:**
- `src/context/AuthContext.tsx` (logout function)

**Request Details:**
- Body: None

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** None

**Status:** USED

**Problems:**
- Errors are silently caught and ignored (line 34)

---

### GET /users/me
**Method:** GET  
**URL:** `/users/me`

**Used In:**
- `src/context/AuthContext.tsx` (getMe function, called on app bootstrap)

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
User | { user: User }
```
- Note: May return user object directly or wrapped in `{ user: ... }`

**React Query Keys:** None

**Status:** USED

**Problems:**
- Response shape inconsistency handled via `extractUser` helper
- Uses `any` type (line 37)

---

### PATCH /users/me
**Method:** PATCH  
**URL:** `/users/me`

**Used In:**
- `src/context/AuthContext.tsx` (updateProfile function)

**Request Details:**
- Body: `Partial<User>`

**Expected Response Shape:**
```typescript
User | { user: User }
```

**React Query Keys:** None

**Status:** USED

**Problems:**
- Same response shape inconsistency as GET /users/me

---

## MEDICATIONS API (`src/api/medications.ts`)

### GET /medications
**Method:** GET  
**URL:** `/medications`

**Used In:**
- `src/hooks/queries.ts` (useMedications hook)
- Used by: `src/pages/patient/Medications.tsx`, `src/pages/patient/MedicationDetail.tsx`

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
Medication[] | { medications: Medication[] } | { data: Medication[] }
```
- Note: Multiple possible response shapes handled by fallback logic

**React Query Keys:** `["medications"]`

**Status:** USED

**Problems:**
- **MAJOR RESPONSE SHAPE CONFLICT:** Endpoint may return array directly, or wrapped in `medications`, or wrapped in `data`
- Uses `any` type (line 18)
- This is the LEGACY medication API - conflicts with new Doctor medication catalog

---

### GET /medications/today
**Method:** GET  
**URL:** `/medications/today`

**Used In:**
- `src/hooks/queries.ts` (useTodayDoses hook)
- Used by: `src/pages/patient/Today.tsx`

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
TodayMedicationDose[] | { doses: TodayMedicationDose[] } | { medications: TodayMedicationDose[] } | { data: TodayMedicationDose[] }
```

**React Query Keys:** `["medications", "today"]`

**Status:** USED

**Problems:**
- **EXTREME RESPONSE SHAPE CONFLICT:** 4 different possible response shapes
- Uses `any` type (line 24)
- Component expects `TodayDose` interface with different structure than `TodayMedicationDose` type

---

### GET /medications/:id
**Method:** GET  
**URL:** `/medications/:id`

**Used In:**
- `src/hooks/queries.ts` (useMedication hook)
- Used by: `src/pages/patient/MedicationDetail.tsx`

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
Medication | { medication: Medication }
```

**React Query Keys:** `["medications", id]`

**Status:** USED

**Problems:**
- Response shape may be wrapped or direct
- Uses `any` type (line 30)

---

### POST /medications
**Method:** POST  
**URL:** `/medications`

**Used In:**
- `src/hooks/queries.ts` (useCreateMedication hook)
- Used by: Patient medication creation flows

**Request Details:**
- Body:
```typescript
{
  name: string;
  dosage: string;
  frequency: { times: string[]; days: string[] };
  startDate: string;
  endDate?: string;
  instructions?: string;
  patientId?: string;
  prescribedBy?: string;
}
```

**Expected Response Shape:**
```typescript
Medication
```

**React Query Keys:** Mutation - invalidates `["medications"]` and `["medications", "today"]`

**Status:** USED

**Problems:**
- Legacy medication creation - conflicts with new doctor medication catalog system

---

### PATCH /medications/:id
**Method:** PATCH  
**URL:** `/medications/:id`

**Used In:**
- `src/hooks/queries.ts` (useUpdateMedication - not defined, only in doctor)
- Legacy endpoint

**Request Details:**
- Path Params: `id: string`
- Body: `Partial<MedicationCreateInput>`

**Expected Response Shape:**
```typescript
Medication
```

**React Query Keys:** None

**Status:** LEGACY

**Problems:**
- Defined but no corresponding React Query hook in queries.ts
- Conflicts with doctor medication update endpoints

---

### DELETE /medications/:id
**Method:** DELETE  
**URL:** `/medications/:id`

**Used In:**
- `src/hooks/queries.ts` (useDeleteMedication hook)

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** Mutation - invalidates `["medications"]` and `["medications", "today"]`

**Status:** USED

**Problems:**
- Legacy medication deletion - conflicts with doctor medication catalog deletion

---

## DOSES API (`src/api/doses.ts`)

### GET /dose-logs
**Method:** GET  
**URL:** `/dose-logs`

**Used In:**
- `src/hooks/queries.ts` (useDoseLogs hook)
- `src/api/doctor.ts` (patientDoseLogs - reuses this endpoint)
- Used by: Multiple pages

**Request Details:**
- Query Params:
```typescript
{
  from?: string;
  to?: string;
  status?: DoseStatus;
  medicationId?: string;
}
```

**Expected Response Shape:**
```typescript
DoseLog[] | { doseLogs: DoseLog[] } | { logs: DoseLog[] } | { data: DoseLog[] }
```

**React Query Keys:** `["dose-logs", params]`

**Status:** USED

**Problems:**
- **RESPONSE SHAPE CONFLICT:** 4 different possible response shapes
- Uses `any` type (line 7)
- Doctor API reuses this endpoint with patientId filter

---

### POST /dose-logs/:id/take
**Method:** POST  
**URL:** `/dose-logs/:id/take`

**Used In:**
- `src/hooks/queries.ts` (useTakeDose hook)
- Used by: `src/pages/patient/Today.tsx`

**Request Details:**
- Path Params: `id: string`
- Body: `{ notes?: string }`

**Expected Response Shape:**
```typescript
DoseLog
```

**React Query Keys:** Mutation - invalidates `["dose-logs"]`, `["medications", "today"]`, `["adherence"]`

**Status:** USED

**Problems:**
- None significant

---

### POST /dose-logs/:id/skip
**Method:** POST  
**URL:** `/dose-logs/:id/skip`

**Used In:**
- `src/hooks/queries.ts` (useSkipDose hook)
- Used by: `src/pages/patient/Today.tsx`

**Request Details:**
- Path Params: `id: string`
- Body: `{ notes: string }` (required)

**Expected Response Shape:**
```typescript
DoseLog
```

**React Query Keys:** Mutation - invalidates `["dose-logs"]`, `["medications", "today"]`

**Status:** USED

**Problems:**
- None significant

---

## ADHERENCE API (`src/api/adherence.ts`)

### GET /adherence/summary
**Method:** GET  
**URL:** `/adherence/summary`

**Used In:**
- `src/hooks/queries.ts` (useAdherenceSummary hook)
- Used by: `src/pages/patient/Today.tsx`, `src/pages/patient/Dashboard.tsx`, `src/pages/patient/Analytics.tsx`

**Request Details:**
- Query Params: `{ period: "week" | "month" | "quarter" | "year" }`

**Expected Response Shape:**
```typescript
AdherenceSummary
```

**React Query Keys:** `["adherence", "summary", period]`

**Status:** USED

**Problems:**
- None significant

---

### GET /adherence/history
**Method:** GET  
**URL:** `/adherence/history`

**Used In:**
- `src/hooks/queries.ts` (useAdherenceHistory hook)
- `src/api/doctor.ts` (adherenceHistory - reuses this endpoint)
- Used by: Multiple pages

**Request Details:**
- Query Params:
```typescript
{
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "week" | "month";
  patientId?: string; // added by doctor API
}
```

**Expected Response Shape:**
```typescript
AdherenceHistoryEntry[] | { history: AdherenceHistoryEntry[] } | { data: AdherenceHistoryEntry[] }
```

**React Query Keys:** `["adherence", "history", params]`

**Status:** USED

**Problems:**
- **RESPONSE SHAPE CONFLICT:** 3 different possible response shapes
- Uses `any` type (line 10)

---

## ALERTS API (`src/api/alerts.ts`)

### GET /alerts
**Method:** GET  
**URL:** `/alerts`

**Used In:**
- `src/hooks/queries.ts` (useAlerts hook)
- Used by: Multiple caregiver and doctor pages

**Request Details:**
- Query Params:
```typescript
{
  unread?: boolean;
  status?: AlertStatus;
  type?: AlertType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
```

**Expected Response Shape:**
```typescript
Alert[] | { alerts: Alert[] }
```

**React Query Keys:** `["alerts", params]`

**Status:** USED

**Problems:**
- Response shape may be array or wrapped in `alerts`

---

### PATCH /alerts/:id/acknowledge
**Method:** PATCH  
**URL:** `/alerts/:id/acknowledge`

**Used In:**
- `src/hooks/queries.ts` (useAcknowledgeAlert hook)
- `src/api/doctor.ts` (acknowledgeAlert - reuses this)

**Request Details:**
- Path Params: `id: string`
- Body: None

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["alerts"]`

**Status:** USED

**Problems:**
- Response type is `any`

---

### PATCH /alerts/:id/read
**Method:** PATCH  
**URL:** `/alerts/:id/read`

**Used In:**
- `src/hooks/queries.ts` (useMarkAsRead hook)

**Request Details:**
- Path Params: `id: string`
- Body: None

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["alerts"]`

**Status:** USED

**Problems:**
- Response type is `any`

---

### PATCH /alerts/read-all
**Method:** PATCH  
**URL:** `/alerts/read-all`

**Used In:**
- `src/hooks/queries.ts` (useMarkAllAsRead hook)

**Request Details:**
- Body: `{ patientId?: string }`

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** Mutation - invalidates `["alerts"]`

**Status:** USED

**Problems:**
- None significant

---

## CAREGIVER API (`src/api/caregiver.ts`)

### GET /caregiver/patients
**Method:** GET  
**URL:** `/caregiver/patients`

**Used In:**
- `src/hooks/queries.ts` (usePatients hook)
- Used by: Multiple caregiver pages

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
PatientSummary[] | { patients: PatientSummary[] } | { data: PatientSummary[] }
```

**React Query Keys:** `["caregiver", "patients"]`

**Status:** USED

**Problems:**
- **RESPONSE SHAPE CONFLICT:** 3 different possible response shapes
- Uses `any` type (line 7)

---

### GET /caregiver/patients/:id/summary
**Method:** GET  
**URL:** `/caregiver/patients/:id/summary`

**Used In:**
- `src/hooks/queries.ts` (usePatientSummary hook)
- Used by: Caregiver patient detail pages

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
PatientDetailSummary
```

**React Query Keys:** `["caregiver", "patients", id]`

**Status:** USED

**Problems:**
- None significant

---

### POST /caregiver/invite/:email
**Method:** POST  
**URL:** `/caregiver/invite/:email`

**Used In:**
- None (defined but not called in codebase)

**Request Details:**
- Path Params: `email: string` (URL encoded)
- Body: None

**Expected Response Shape:**
```typescript
{
  inviteId: string;
  patientEmail: string;
  status: string;
}
```

**React Query Keys:** None

**Status:** UNUSED

**Problems:**
- Defined but never called - potential dead code

---

### PATCH /caregiver/invite/:id/accept
**Method:** PATCH  
**URL:** `/caregiver/invite/:id/accept`

**Used In:**
- None (defined but not called in codebase)

**Request Details:**
- Path Params: `id: string`
- Body: None

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** None

**Status:** UNUSED

**Problems:**
- Defined but never called - potential dead code

---

### GET /caregiver/patients/:patientId/notes
**Method:** GET  
**URL:** `/caregiver/patients/:patientId/notes`

**Used In:**
- `src/hooks/queries.ts` (usePatientNotes hook)
- Used by: Caregiver pages

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
CaregiverNote[]
```
- **BROKEN:** Always returns empty array `[]` (line 26-28)

**React Query Keys:** `["caregiver", "patients", id, "notes"]`

**Status:** BROKEN

**Problems:**
- **HARDCODED EMPTY RETURN:** Function always returns `[]` instead of making API call
- This is a stub/mock implementation left in production code

---

### POST /caregiver/patients/:patientId/notes
**Method:** POST  
**URL:** `/caregiver/patients/:patientId/notes`

**Used In:**
- `src/hooks/queries.ts` (useAddPatientNote hook)

**Request Details:**
- Path Params: `patientId: string`
- Body: `{ message: string }`

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["caregiver", "patients", patientId, "notes"]`

**Status:** USED

**Problems:**
- Response type is `any`
- Field name mismatch: request uses `message` but type definition uses `content`

---

## DOCTOR API (`src/api/doctor.ts`)

### GET /doctor/patients
**Method:** GET  
**URL:** `/doctor/patients`

**Used In:**
- `src/hooks/queries.ts` (useDoctorPatients hook)
- Used by: `src/pages/doctor/Patients.tsx`

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
PatientSummary[] | { data: { patients: PatientSummary[] } } | { patients: PatientSummary[] } | { data: PatientSummary[] }
```
- Note: Complex nested response handling

**React Query Keys:** `["doctor", "patients"]`

**Status:** USED

**Problems:**
- **EXTREME RESPONSE SHAPE CONFLICT:** 4 different possible response shapes
- Uses `any` type (line 112)
- Comment indicates this reuses caregiver endpoint temporarily (line 109)
- Hook performs complex data transformation (lines 278-297)

---

### POST /doctor/patients
**Method:** POST  
**URL:** `/doctor/patients`

**Used In:**
- `src/hooks/queries.ts` (useCreatePatient hook)
- Used by: `src/components/doctor/PatientCreationForm.tsx`

**Request Details:**
- Body:
```typescript
{
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  age?: number;
  gender?: "male" | "female" | "other";
  conditions?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  };
}
```

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients"]`

**Status:** USED

**Problems:**
- Response type is `any`

---

### GET /doctor/patients/:id
**Method:** GET  
**URL:** `/doctor/patients/:id`

**Used In:**
- `src/hooks/queries.ts` (useDoctorPatient hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
any
```
- Note: Comment indicates this reuses caregiver endpoint temporarily

**React Query Keys:** `["doctor", "patients", id]`

**Status:** USED

**Problems:**
- Response type is `any`
- Comment indicates this is temporary (line 186)
- Page performs complex adaptation to MockPatient interface (lines 83-102)

---

### GET /doctor/caregivers
**Method:** GET  
**URL:** `/doctor/caregivers`

**Used In:**
- `src/hooks/queries.ts` (useCaregivers hook)
- Used by: Caregiver management components

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
CaregiverInfo[] | { caregivers: CaregiverInfo[] } | { data: CaregiverInfo[] }
```

**React Query Keys:** `["doctor", "caregivers"]`

**Status:** USED

**Problems:**
- **RESPONSE SHAPE CONFLICT:** 3 different possible response shapes
- Uses `any` type (line 137)

---

### POST /doctor/caregivers
**Method:** POST  
**URL:** `/doctor/caregivers`

**Used In:**
- `src/hooks/queries.ts` (useCreateCaregiver hook)
- Used by: `src/components/doctor/CaregiverCreationForm.tsx`

**Request Details:**
- Body:
```typescript
{
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  relationship?: string;
  address?: string;
}
```

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "caregivers"]`

**Status:** USED

**Problems:**
- Response type is `any`

---

### POST /doctor/patients/:patientId/assign-caregiver
**Method:** POST  
**URL:** `/doctor/patients/:patientId/assign-caregiver`

**Used In:**
- `src/hooks/queries.ts` (useAssignCaregiver hook)
- Used by: `src/components/doctor/CaregiverAssignment.tsx`

**Request Details:**
- Path Params: `patientId: string`
- Body: `{ caregiverId: string }`

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "caregivers"]` and `["doctor", "patients", patientId]`

**Status:** USED

**Problems:**
- Response type is `any`

---

### POST /doctor/patients/:patientId/medications
**Method:** POST  
**URL:** `/doctor/patients/:patientId/medications`

**Used In:**
- `src/api/doctor.ts` (createMedicationForPatient)
- `src/hooks/queries.ts` (useDoctorCreateMedication hook)

**Request Details:**
- Path Params: `patientId: string`
- Body: `MedicationCreateInput` (legacy structure)

**Expected Response Shape:**
```typescript
Medication
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medications"]`

**Status:** LEGACY

**Problems:**
- Uses legacy MedicationCreateInput structure
- Conflicts with new patient medication assignment system

---

### GET /medications (with patientId filter)
**Method:** GET  
**URL:** `/medications`

**Used In:**
- `src/api/doctor.ts` (patientMedications)
- `src/hooks/queries.ts` (useDoctorPatientMedications hook)

**Request Details:**
- Query Params: `{ patientId: string }`

**Expected Response Shape:**
```typescript
Medication[] | { medications: Medication[] } | { data: Medication[] }
```

**React Query Keys:** `["doctor", "patients", patientId, "medications"]`

**Status:** LEGACY

**Problems:**
- Reuses legacy /medications endpoint with filter
- Conflicts with new patient medication assignment system

---

### PATCH /doctor/medications/:id
**Method:** PATCH  
**URL:** `/doctor/medications/:id`

**Used In:**
- `src/api/doctor.ts` (updateMedication)
- `src/hooks/queries.ts` (useDoctorUpdateMedication hook)

**Request Details:**
- Path Params: `id: string`
- Body: `Partial<MedicationCreateInput>`

**Expected Response Shape:**
```typescript
Medication
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medications"]`

**Status:** LEGACY

**Problems:**
- Uses legacy medication structure
- Conflicts with new medication catalog system

---

### DELETE /doctor/medications/:id
**Method:** DELETE  
**URL:** `/doctor/medications/:id`

**Used In:**
- `src/api/doctor.ts` (deleteMedication)
- `src/hooks/queries.ts` (useDoctorDeleteMedication hook)

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medications"]`

**Status:** LEGACY

**Problems:**
- Conflicts with new medication catalog deletion
- Same URL pattern as medication catalog but different semantic meaning

---

### GET /dose-logs (with patientId filter)
**Method:** GET  
**URL:** `/dose-logs`

**Used In:**
- `src/api/doctor.ts` (patientDoseLogs)
- `src/hooks/queries.ts` (useDoctorPatientDoseLogs hook)

**Request Details:**
- Query Params: `{ patientId: string, from?: string, to?: string, status?: string }`

**Expected Response Shape:**
```typescript
DoseLog[] | { doseLogs: DoseLog[] } | { logs: DoseLog[] } | { data: DoseLog[] }
```

**React Query Keys:** `["doctor", "patients", patientId, "doses", params]`

**Status:** USED

**Problems:**
- Reuses generic /dose-logs endpoint
- Same response shape conflicts as generic endpoint

---

### GET /doctor/alerts
**Method:** GET  
**URL:** `/doctor/alerts`

**Used In:**
- `src/api/doctor.ts` (alerts)
- `src/hooks/queries.ts` (useDoctorAlerts hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Query Params: `{ status?: string, severity?: string }`

**Expected Response Shape:**
```typescript
Alert[] | { alerts: Alert[] }
```

**React Query Keys:** `["doctor", "alerts", params]`

**Status:** USED

**Problems:**
- Response shape may be array or wrapped
- May need doctor-specific filtering (comment on line 238)

---

### GET /ai/risk/:patientId
**Method:** GET  
**URL:** `/ai/risk/:patientId`

**Used In:**
- `src/api/doctor.ts` (risk)
- `src/api/ai.ts` (risk - duplicate)
- `src/hooks/queries.ts` (useRisk hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`, `src/pages/patient/Dashboard.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
RiskScore
```

**React Query Keys:** `["ai", "risk", patientId]`

**Status:** USED

**Problems:**
- **DUPLICATE:** Defined in both `doctor.ts` and `ai.ts`

---

### GET /ai/insights/:patientId
**Method:** GET  
**URL:** `/ai/insights/:patientId`

**Used In:**
- `src/api/doctor.ts` (insights)
- `src/api/ai.ts` (insights - duplicate)
- `src/hooks/queries.ts` (useInsights hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`, `src/pages/patient/Dashboard.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
AIInsightsResponse
```

**React Query Keys:** `["ai", "insights", patientId]`

**Status:** USED

**Problems:**
- **DUPLICATE:** Defined in both `doctor.ts` and `ai.ts`

---

### GET /adherence/history (with patientId filter)
**Method:** GET  
**URL:** `/adherence/history`

**Used In:**
- `src/api/doctor.ts` (adherenceHistory)
- `src/hooks/queries.ts` (useDoctorPatientAdherence hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Query Params: `{ patientId: string, startDate?: string, endDate?: string, groupBy?: "day" | "week" | "month" }`

**Expected Response Shape:**
```typescript
AdherenceHistoryEntry[] | { history: AdherenceHistoryEntry[] } | { data: AdherenceHistoryEntry[] }
```

**React Query Keys:** `["doctor", "patients", patientId, "adherence", params]`

**Status:** USED

**Problems:**
- Reuses generic /adherence/history endpoint
- Same response shape conflicts as generic endpoint

---

### POST /doctor/intatentions
**Method:** POST  
**URL:** `/doctor/intatentions`

**Used In:**
- `src/api/doctor.ts` (createIntervention)
- `src/hooks/queries.ts` (useCreateIntervention hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Body:
```typescript
{
  patientId: string;
  type: string;
  detail: string;
  notes?: string;
}
```

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "interventions"]` and `["doctor", "patients", patientId, "interventions"]`

**Status:** BROKEN

**Problems:**
- **TYPO IN URL:** `intatentions` should be `interventions` (line 300)
- Response type is `any`

---

### GET /doctor/interventions/:patientId
**Method:** GET  
**URL:** `/doctor/interventions/:patientId`

**Used In:**
- `src/api/doctor.ts` (interventions)
- `src/hooks/queries.ts` (useDoctorInterventions hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
Intervention[] | { interventions: Intervention[] } | { data: Intervention[] }
```

**React Query Keys:** `["doctor", "patients", patientId, "interventions"]`

**Status:** USED

**Problems:**
- **RESPONSE SHAPE CONFLICT:** 3 different possible response shapes
- Uses `any` type (line 312)

---

### PATCH /alerts/:id/acknowledge
**Method:** PATCH  
**URL:** `/alerts/:id/acknowledge`

**Used In:**
- `src/api/doctor.ts` (acknowledgeAlert - reuses from alerts API)

**Request Details:**
- Path Params: `id: string`
- Body: None

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** None (doctor API doesn't have hook for this)

**Status:** DUPLICATE

**Problems:**
- **DUPLICATE:** Already defined in `alerts.ts`
- Doctor-specific action but reuses generic endpoint

---

### PATCH /alerts/:id/resolve
**Method:** PATCH  
**URL:** `/alerts/:id/resolve`

**Used In:**
- `src/api/doctor.ts` (resolveAlert)
- `src/hooks/queries.ts` (useResolveAlert hook)

**Request Details:**
- Path Params: `id: string`
- Body: `{ notes?: string }`

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "alerts"]` and `["alerts"]`

**Status:** USED

**Problems:**
- Response type is `any`
- Doctor-specific endpoint

---

### PATCH /alerts/:id/escalate
**Method:** PATCH  
**URL:** `/alerts/:id/escalate`

**Used In:**
- `src/api/doctor.ts` (escalateAlert)
- `src/hooks/queries.ts` (useEscalateAlert hook)

**Request Details:**
- Path Params: `id: string`
- Body: `{ notes?: string }`

**Expected Response Shape:**
```typescript
any
```

**React Query Keys:** Mutation - invalidates `["doctor", "alerts"]` and `["alerts"]`

**Status:** USED

**Problems:**
- Response type is `any`
- Doctor-specific endpoint

---

### GET /doctor/medications (Medication Catalog)
**Method:** GET  
**URL:** `/doctor/medications`

**Used In:**
- `src/api/doctor.ts` (medicationCatalog)
- `src/hooks/queries.ts` (useDoctorMedications hook)
- Used by: `src/pages/doctor/Medications.tsx`, `src/components/doctor/AssignMedicationModal.tsx`

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
MedicationCatalog[] | { medications: MedicationCatalog[] } | { data: MedicationCatalog[] }
```

**React Query Keys:** `["doctor", "medication-catalog"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL as PATCH/DELETE /doctor/medications/:id but different semantic meaning
- **RESPONSE SHAPE CONFLICT:** 3 different possible response shapes
- Uses `any` type (line 355)
- This is the NEW medication catalog system - conflicts with legacy medication APIs

---

### POST /doctor/medications (Medication Catalog)
**Method:** POST  
**URL:** `/doctor/medications`

**Used In:**
- `src/api/doctor.ts` (createMedicationCatalog)
- `src/hooks/queries.ts` (useDoctorCreateMedicationCatalog hook)
- Used by: `src/pages/doctor/Medications.tsx`

**Request Details:**
- Body:
```typescript
{
  name: string;
  genericName?: string;
  category: string;
  strength: string;
  form: "tablet" | "capsule" | "syrup" | "injection" | "other";
  manufacturer?: string;
  description?: string;
  sideEffects?: string[];
}
```

**Expected Response Shape:**
```typescript
MedicationCatalog
```

**React Query Keys:** Mutation - invalidates `["doctor", "medication-catalog"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL as GET /doctor/medications but different semantic meaning (GET for catalog, POST for creating catalog item)
- This is the NEW medication catalog system

---

### PATCH /doctor/medications/:id (Medication Catalog)
**Method:** PATCH  
**URL:** `/doctor/medications/:id`

**Used In:**
- `src/api/doctor.ts` (updateMedicationCatalog)
- `src/hooks/queries.ts` (useDoctorUpdateMedicationCatalog hook)
- Used by: `src/pages/doctor/Medications.tsx`

**Request Details:**
- Path Params: `id: string`
- Body:
```typescript
{
  name?: string;
  genericName?: string;
  category?: string;
  strength?: string;
  form?: "tablet" | "capsule" | "syrup" | "injection" | "other";
  manufacturer?: string;
  description?: string;
  sideEffects?: string[];
}
```

**Expected Response Shape:**
```typescript
MedicationCatalog
```

**React Query Keys:** Mutation - invalidates `["doctor", "medication-catalog"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL pattern as legacy medication update but different semantic meaning
- This is the NEW medication catalog system

---

### DELETE /doctor/medications/:id (Medication Catalog)
**Method:** DELETE  
**URL:** `/doctor/medications/:id`

**Used In:**
- `src/api/doctor.ts` (deleteMedicationCatalog)
- `src/hooks/queries.ts` (useDoctorDeleteMedicationCatalog hook)
- Used by: `src/pages/doctor/Medications.tsx`

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** Mutation - invalidates `["doctor", "medication-catalog"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL pattern as legacy medication delete but different semantic meaning
- This is the NEW medication catalog system

---

### GET /doctor/patients/:patientId/medications (Patient Assignments)
**Method:** GET  
**URL:** `/doctor/patients/:patientId/medications`

**Used In:**
- `src/api/doctor.ts` (patientMedicationAssignments)
- `src/hooks/queries.ts` (usePatientAssignedMedications hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
{
  medications: PatientMedicationAssignment[];
} | 
{
  data: {
    medications: PatientMedicationAssignment[];
  };
}
```

**React Query Keys:** `["doctor", "patients", patientId, "medication-assignments"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL as POST /doctor/patients/:patientId/medications (legacy)
- **RESPONSE SHAPE CONFLICT:** 2 different possible response shapes
- Hook performs complex unwrapping logic (lines 527-535)
- This is the NEW patient medication assignment system

---

### POST /doctor/patients/:patientId/medications (Patient Assignments)
**Method:** POST  
**URL:** `/doctor/patients/:patientId/medications`

**Used In:**
- `src/api/doctor.ts` (assignMedicationToPatient)
- `src/hooks/queries.ts` (useAssignMedicationToPatient hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Path Params: `patientId: string`
- Body:
```typescript
{
  medicationId: string;
  dosage: string;
  scheduleType: "daily" | "weekly";
  times: string[];
  daysOfWeek?: string[];
  instructions?: string;
  startDate: string;
  endDate?: string;
}
```

**Expected Response Shape:**
```typescript
PatientMedicationAssignment
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medication-assignments"]`

**Status:** USED

**Problems:**
- **URL CONFLICT:** Same URL as GET /doctor/patients/:patientId/medications
- **URL CONFLICT:** Same URL as legacy POST /doctor/patients/:patientId/medications
- This is the NEW patient medication assignment system

---

### PATCH /doctor/patient-medications/:id
**Method:** PATCH  
**URL:** `/doctor/patient-medications/:id`

**Used In:**
- `src/api/doctor.ts` (updatePatientMedicationAssignment)
- `src/hooks/queries.ts` (useUpdatePatientMedicationAssignment hook)

**Request Details:**
- Path Params: `id: string`
- Body:
```typescript
{
  dosage?: string;
  scheduleType?: "daily" | "weekly";
  times?: string[];
  daysOfWeek?: string[];
  instructions?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}
```

**Expected Response Shape:**
```typescript
PatientMedicationAssignment
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medication-assignments"]`

**Status:** USED

**Problems:**
- None significant (part of new system)

---

### DELETE /doctor/patient-medications/:id
**Method:** DELETE  
**URL:** `/doctor/patient-medications/:id`

**Used In:**
- `src/api/doctor.ts` (deletePatientMedicationAssignment)
- `src/hooks/queries.ts` (useDeletePatientMedicationAssignment hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`

**Request Details:**
- Path Params: `id: string`

**Expected Response Shape:**
```typescript
void
```

**React Query Keys:** Mutation - invalidates `["doctor", "patients", patientId, "medication-assignments"]`

**Status:** USED

**Problems:**
- None significant (part of new system)

---

## AI API (`src/api/ai.ts`)

### GET /ai/risk/:patientId
**Method:** GET  
**URL:** `/ai/risk/:patientId`

**Used In:**
- `src/api/ai.ts` (risk)
- **DUPLICATE** of `src/api/doctor.ts` (risk)
- `src/hooks/queries.ts` (useRisk hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`, `src/pages/patient/Dashboard.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
RiskScore
```

**React Query Keys:** `["ai", "risk", patientId]`

**Status:** DUPLICATE

**Problems:**
- **DUPLICATE:** Already defined in `doctor.ts`
- Identical implementation

---

### GET /ai/insights/:patientId
**Method:** GET  
**URL:** `/ai/insights/:patientId`

**Used In:**
- `src/api/ai.ts` (insights)
- **DUPLICATE** of `src/api/doctor.ts` (insights)
- `src/hooks/queries.ts` (useInsights hook)
- Used by: `src/pages/doctor/PatientDetail.tsx`, `src/pages/patient/Dashboard.tsx`

**Request Details:**
- Path Params: `patientId: string`

**Expected Response Shape:**
```typescript
AIInsightsResponse
```

**React Query Keys:** `["ai", "insights", patientId]`

**Status:** DUPLICATE

**Problems:**
- **DUPLICATE:** Already defined in `doctor.ts`
- Identical implementation

---

### POST /ai/run-predictions
**Method:** POST  
**URL:** `/ai/run-predictions`

**Used In:**
- None (defined but not called in codebase)

**Request Details:**
- Body: None

**Expected Response Shape:**
```typescript
{
  message: string;
}
```

**React Query Keys:** None

**Status:** UNUSED

**Problems:**
- Defined but never called - potential dead code

---

## REPORTS API (`src/api/reports.ts`)

### GET /reports/patient/:id
**Method:** GET  
**URL:** `/reports/patient/:id`

**Used In:**
- `src/api/reports.ts` (patient)
- `src/hooks/queries.ts` (usePatientReport hook)
- Used by: `src/pages/doctor/Report.tsx`

**Request Details:**
- Path Params: `id: string`
- Query Params: `{ startDate?: string, endDate?: string, format?: "json" | "pdf" }`

**Expected Response Shape:**
```typescript
PatientReport
```

**React Query Keys:** `["reports", "patient", id, params]`

**Status:** USED

**Problems:**
- None significant

---

### GET /reports/export/:id (URL generation only)
**Method:** GET  
**URL:** `/reports/export/:id`

**Used In:**
- `src/api/reports.ts` (exportUrl - returns URL string, not fetch)
- Used by: Report export functionality

**Request Details:**
- Path Params: `id: string`
- Query Params: `{ format: "pdf" | "csv" | "excel", startDate?: string, endDate?: string }`

**Expected Response Shape:**
```typescript
string (URL)
```

**React Query Keys:** None

**Status:** USED

**Problems:**
- None significant

---

### GET /reports/export/:id (fetch)
**Method:** GET  
**URL:** `/reports/export/:id`

**Used In:**
- `src/api/reports.ts` (exportDownload)
- Uses direct `fetch` instead of axios
- Used by: Report download functionality

**Request Details:**
- Path Params: `id: string`
- Query Params: `{ format: "pdf" | "csv" | "excel", startDate?: string, endDate?: string }`
- Headers: `{ Authorization: "Bearer <token>" }` (manual header)

**Expected Response Shape:**
```typescript
Blob
```

**React Query Keys:** None

**Status:** USED

**Problems:**
- Uses direct `fetch` instead of axios (line 17)
- Manually constructs Authorization header (line 18)
- Bypasses axios interceptors and error handling

---

## ADMIN API (`src/api/admin.ts`)

### GET /admin/metrics
**Method:** GET  
**URL:** `/admin/metrics`

**Used In:**
- `src/hooks/queries.ts` (useAdminMetrics hook)
- Used by: `src/pages/admin/Metrics.tsx`

**Request Details:**
- Query Params: None

**Expected Response Shape:**
```typescript
AdminMetrics
```

**React Query Keys:** `["admin", "metrics"]`

**Status:** USED

**Problems:**
- None significant

---

## NOTIFICATIONS API (`src/api/notifications.ts`)

### POST /notifications/test
**Method:** POST  
**URL:** `/notifications/test`

**Used In:**
- None (defined but not called in codebase)

**Request Details:**
- Body: None

**Expected Response Shape:**
```typescript
{
  message: string;
}
```

**React Query Keys:** None

**Status:** UNUSED

**Problems:**
- Defined but never called - potential dead code

---

# API FLOW MAPS

## Patient Today Page (`src/pages/patient/Today.tsx`)
**API Calls:** 2 parallel queries + 2 mutations

**Flow:**
1. **Parallel on mount:**
   - `GET /medications/today` (useTodayDoses) - refetches every 30s
   - `GET /adherence/summary?period=week` (useAdherenceSummary) - stale for 5min

2. **User actions:**
   - `POST /dose-logs/:id/take` (useTakeDose) - invalidates dose-logs, today doses, adherence
   - `POST /dose-logs/:id/skip` (useSkipDose) - invalidates dose-logs, today doses

**Total APIs:** 4

---

## Doctor Patient Detail Page (`src/pages/doctor/PatientDetail.tsx`)
**API Calls:** 8 parallel queries + 3 mutations

**Flow:**
1. **Parallel on mount:**
   - `GET /doctor/patients/:id` (useDoctorPatient)
   - `GET /medications?patientId=:id` (useDoctorPatientMedications) - legacy
   - `GET /dose-logs?patientId=:id` (useDoctorPatientDoseLogs)
   - `GET /doctor/alerts` (useDoctorAlerts) - refetches every 60s
   - `GET /ai/risk/:id` (useRisk)
   - `GET /ai/insights/:id` (useInsights)
   - `GET /adherence/history?patientId=:id` (useDoctorPatientAdherence)
   - `GET /doctor/interventions/:id` (useDoctorInterventions)
   - `GET /doctor/patients/:id/medications` (usePatientAssignedMedications) - new system

2. **User actions:**
   - `POST /doctor/intatentions` (useCreateIntervention) - TYPO in URL
   - `POST /doctor/patients/:id/medications` (useAssignMedicationToPatient) - new system
   - `DELETE /doctor/patient-medications/:id` (useDeletePatientMedicationAssignment)

**Total APIs:** 11

**Problems:**
- Mixes legacy and new medication systems
- Uses both `GET /medications?patientId=` and `GET /doctor/patients/:id/medications`
- Has typo in intervention endpoint

---

## Doctor Patients List Page (`src/pages/doctor/Patients.tsx`)
**API Calls:** 1 query

**Flow:**
1. **On mount:**
   - `GET /doctor/patients` (useDoctorPatients) - stale for 5min

**Total APIs:** 1

**Problems:**
- Hook performs complex data transformation to adapt to MockPatient interface

---

## Doctor Medications Catalog Page (`src/pages/doctor/Medications.tsx`)
**API Calls:** 1 query + 3 mutations

**Flow:**
1. **On mount:**
   - `GET /doctor/medications` (useDoctorMedications) - medication catalog

2. **User actions:**
   - `POST /doctor/medications` (useDoctorCreateMedicationCatalog)
   - `PATCH /doctor/medications/:id` (useDoctorUpdateMedicationCatalog)
   - `DELETE /doctor/medications/:id` (useDoctorDeleteMedicationCatalog)

**Total APIs:** 4

**Problems:**
- URL conflicts with legacy medication endpoints

---

## Authentication Flow (`src/context/AuthContext.tsx`)
**API Calls:** 3 endpoints

**Flow:**
1. **On app bootstrap (if token exists):**
   - `GET /users/me` (AuthApi.getMe)

2. **Login:**
   - `POST /auth/login` (AuthApi.login)

3. **Register:**
   - `POST /auth/register` (AuthApi.register)

4. **Logout:**
   - `POST /auth/logout` (AuthApi.logout)

5. **Update profile:**
   - `PATCH /users/me` (AuthApi.updateMe)

**Total APIs:** 5

**Problems:**
- Response shape inconsistencies handled via extractUser helper

---

# DUPLICATE APIS

## AI Risk Score
- `src/api/doctor.ts` - `risk()` function
- `src/api/ai.ts` - `risk()` function
- **Identical implementation**
- **Recommendation:** Remove from `doctor.ts`, use only `ai.ts`

## AI Insights
- `src/api/doctor.ts` - `insights()` function
- `src/api/ai.ts` - `insights()` function
- **Identical implementation**
- **Recommendation:** Remove from `doctor.ts`, use only `ai.ts`

## Alert Acknowledge
- `src/api/alerts.ts` - `acknowledge()` function
- `src/api/doctor.ts` - `acknowledgeAlert()` function
- **Doctor version is just a wrapper around alerts version**
- **Recommendation:** Use only alerts version, doctor can call it directly

---

# DEAD APIS

## Unused Authentication Endpoints
- `POST /auth/refresh` - Defined but never called
- **Status:** DEAD
- **Recommendation:** Implement token refresh logic or remove

## Unused Caregiver Endpoints
- `POST /caregiver/invite/:email` - Defined but never called
- `PATCH /caregiver/invite/:id/accept` - Defined but never called
- **Status:** DEAD
- **Recommendation:** Implement invite flow or remove

## Unused AI Endpoints
- `POST /ai/run-predictions` - Defined but never called
- **Status:** DEAD
- **Recommendation:** Implement manual prediction trigger or remove

## Unused Notifications Endpoints
- `POST /notifications/test` - Defined but never called
- **Status:** DEAD
- **Recommendation:** Implement test notification feature or remove

---

# BROKEN APIS

## Caregiver Notes GET
- **Endpoint:** `GET /caregiver/patients/:patientId/notes`
- **File:** `src/api/caregiver.ts` line 26-28
- **Issue:** Function always returns `[]` instead of making API call
- **Status:** BROKEN - Hardcoded stub implementation
- **Recommendation:** Implement actual API call

## Doctor Intervention Create
- **Endpoint:** `POST /doctor/intatentions`
- **File:** `src/api/doctor.ts` line 300
- **Issue:** Typo in URL - `intatentions` should be `interventions`
- **Status:** BROKEN - Will fail on backend
- **Recommendation:** Fix typo to `/doctor/interventions`

---

# LEGACY APIS

## Legacy Medication System
The following endpoints are part of the OLD medication system and conflict with the NEW medication catalog/assignment system:

### Old Patient Medications
- `GET /medications` - Legacy medication list
- `GET /medications/today` - Legacy today's doses
- `GET /medications/:id` - Legacy medication detail
- `POST /medications` - Legacy medication creation
- `PATCH /medications/:id` - Legacy medication update
- `DELETE /medications/:id` - Legacy medication deletion

### Old Doctor Medication Operations
- `POST /doctor/patients/:patientId/medications` - Legacy patient medication creation (conflicts with new assignment system)
- `GET /medications?patientId=:id` - Legacy patient medications with filter
- `PATCH /doctor/medications/:id` - Legacy medication update (conflicts with catalog)
- `DELETE /doctor/medications/:id` - Legacy medication deletion (conflicts with catalog)

**Status:** LEGACY

**Problems:**
- Conflicts with new MedicationCatalog system
- Conflicts with new PatientMedicationAssignment system
- Mixed usage throughout codebase
- Different data structures

**Recommendation:** 
1. Migrate all usage to new system
2. Deprecate and remove old endpoints
3. Update backend to use new system exclusively

---

# RESPONSE SHAPE CONFLICTS

## Critical Conflicts

### GET /medications
**Possible responses:**
1. `Medication[]` (direct array)
2. `{ medications: Medication[] }` (wrapped)
3. `{ data: Medication[] }` (data wrapper)

**Impact:** High - Used throughout patient medication features

---

### GET /medications/today
**Possible responses:**
1. `TodayMedicationDose[]` (direct array)
2. `{ doses: TodayMedicationDose[] }` (wrapped)
3. `{ medications: TodayMedicationDose[] }` (medications wrapper)
4. `{ data: TodayMedicationDose[] }` (data wrapper)

**Impact:** High - Used in patient Today page

---

### GET /dose-logs
**Possible responses:**
1. `DoseLog[]` (direct array)
2. `{ doseLogs: DoseLog[] }` (wrapped)
3. `{ logs: DoseLog[] }` (logs wrapper)
4. `{ data: DoseLog[] }` (data wrapper)

**Impact:** High - Used by doctor, patient, and caregiver features

---

### GET /adherence/history
**Possible responses:**
1. `AdherenceHistoryEntry[]` (direct array)
2. `{ history: AdherenceHistoryEntry[] }` (wrapped)
3. `{ data: AdherenceHistoryEntry[] }` (data wrapper)

**Impact:** Medium - Used in analytics and reporting

---

### GET /caregiver/patients
**Possible responses:**
1. `PatientSummary[]` (direct array)
2. `{ patients: PatientSummary[] }` (wrapped)
3. `{ data: PatientSummary[] }` (data wrapper)

**Impact:** Medium - Used in caregiver patient list

---

### GET /doctor/patients
**Possible responses:**
1. `PatientSummary[]` (direct array)
2. `{ data: { patients: PatientSummary[] } }` (nested)
3. `{ patients: PatientSummary[] }` (wrapped)
4. `{ data: PatientSummary[] }` (data wrapper)

**Impact:** High - Used in doctor patient list

---

### GET /doctor/patients/:id/medications (Assignments)
**Possible responses:**
1. `{ medications: PatientMedicationAssignment[] }` (wrapped)
2. `{ data: { medications: PatientMedicationAssignment[] } }` (nested)

**Impact:** High - Used in doctor patient detail

---

### GET /doctor/interventions/:patientId
**Possible responses:**
1. `Intervention[]` (direct array)
2. `{ interventions: Intervention[] }` (wrapped)
3. `{ data: Intervention[] }` (data wrapper)

**Impact:** Medium - Used in doctor patient detail

---

# PAYLOAD CONFLICTS

## ID Field Inconsistency
Throughout the codebase, there's inconsistent usage of `id` vs `_id`:

**Type definitions:** Both `id` and `_id` are optional on most types
**API responses:** May return either field
**Frontend handling:** Uses `normalizeId` helper to standardize

**Affected types:**
- User
- Medication
- MedicationCatalog
- PatientMedicationAssignment
- DoseLog
- Alert
- Intervention

**Impact:** High - Requires normalization logic everywhere

**Recommendation:** Standardize on one field name (prefer `id`) throughout backend and frontend

---

## Field Name Mismatches

### Caregiver Notes
- **Request:** `{ message: string }` (API call)
- **Type definition:** `content: string` (CaregiverNote interface)
- **Impact:** Type mismatch

---

## Medication Schedule Structure

### Legacy MedicationCreateInput
```typescript
{
  frequency: { times: string[]; days: string[] };
}
```

### New PatientMedicationAssignmentCreateInput
```typescript
{
  scheduleType: "daily" | "weekly";
  times: string[];
  daysOfWeek?: string[];
}
```

**Impact:** High - Two different structures for similar concept

**Recommendation:** Standardize on new structure

---

# UNSAFE `any` USAGE

The following endpoints use `any` type, losing type safety:

1. **Auth API:**
   - `POST /auth/login` (line 15)
   - `GET /users/me` (line 37)
   - `PATCH /users/me` (line 41)

2. **Medications API:**
   - `GET /medications` (line 18)
   - `GET /medications/today` (line 24)
   - `GET /medications/:id` (line 30)
   - `POST /medications` (line 34)
   - `PATCH /medications/:id` (line 38)

3. **Doses API:**
   - `GET /dose-logs` (line 7)
   - `POST /dose-logs/:id/take` (line 13)
   - `POST /dose-logs/:id/skip` (line 17)

4. **Adherence API:**
   - `GET /adherence/history` (line 10)

5. **Alerts API:**
   - `GET /alerts` (line 25)
   - `PATCH /alerts/:id/acknowledge` (line 31)
   - `PATCH /alerts/:id/read` (line 35)

6. **Caregiver API:**
   - `GET /caregiver/patients` (line 7)
   - `POST /caregiver/patients/:patientId/notes` (line 30)

7. **Doctor API:**
   - `GET /doctor/patients` (line 112)
   - `POST /doctor/patients` (line 127)
   - `GET /doctor/patients/:id` (line 189)
   - `GET /doctor/caregivers` (line 137)
   - `POST /doctor/caregivers` (line 132)
   - `POST /doctor/patients/:patientId/assign-caregiver` (line 150)
   - `GET /doctor/medications` (line 355)
   - `GET /doctor/interventions/:patientId` (line 312)
   - `PATCH /alerts/:id/acknowledge` (line 329)
   - `PATCH /alerts/:id/resolve` (line 337)
   - `PATCH /alerts/:id/escalate` (line 345)
   - `POST /doctor/intatentions` (line 300) - also has typo

**Total:** 28+ instances of `any` usage

**Impact:** High - Loss of type safety, potential runtime errors

**Recommendation:** Define proper response types for all endpoints

---

# RECOMMENDED SINGLE SOURCE OF TRUTH

## API Structure Reorganization

### 1. Consolidate AI APIs
**Remove from:** `src/api/doctor.ts`
**Keep in:** `src/api/ai.ts`
- `GET /ai/risk/:patientId`
- `GET /ai/insights/:patientId`

### 2. Consolidate Alert Operations
**Remove from:** `src/api/doctor.ts`
**Keep in:** `src/api/alerts.ts`
- `PATCH /alerts/:id/acknowledge`
- Add doctor-specific actions to alerts API:
  - `PATCH /alerts/:id/resolve`
  - `PATCH /alerts/:id/escalate`

### 3. Standardize Medication System
**Phase out legacy system:**
- Remove all `src/api/medications.ts` endpoints
- Remove legacy doctor medication operations

**Use new system exclusively:**
- `src/api/doctor.ts` - MedicationCatalog operations
- `src/api/doctor.ts` - PatientMedicationAssignment operations

### 4. Fix Response Shapes
**Standardize on single response format:**
```typescript
{
  success: boolean;
  data: T;
  error?: string;
}
```

**Or for arrays:**
```typescript
{
  success: boolean;
  data: T[];
  error?: string;
}
```

**Update axios interceptor** to handle this consistently (already partially implemented in `src/lib/api.ts` line 39-42)

### 5. Standardize ID Fields
**Choose one field name:** `id`
**Update backend** to always return `id`
**Remove `_id` from type definitions**
**Remove `normalizeId` helper** (no longer needed)

### 6. Fix Broken Endpoints
- Implement `GET /caregiver/patients/:patientId/notes` actual API call
- Fix typo: `POST /doctor/intatentions` → `POST /doctor/interventions`

### 7. Remove Dead Code
- `POST /auth/refresh` - implement or remove
- `POST /caregiver/invite/:email` - implement or remove
- `PATCH /caregiver/invite/:id/accept` - implement or remove
- `POST /ai/run-predictions` - implement or remove
- `POST /notifications/test` - implement or remove

### 8. Add Proper TypeScript Types
Replace all `any` types with proper response interfaces

### 9. Standardize Field Names
- Caregiver notes: change `message` to `content` in request
- Medication schedule: use new structure consistently

---

## Recommended API File Structure

```
src/api/
├── index.ts (re-exports all)
├── auth.ts (authentication only)
├── users.ts (user profile operations - split from auth)
├── medications.ts (NEW - medication catalog only)
├── patient-medications.ts (NEW - patient assignments only)
├── doses.ts (dose logs)
├── adherence.ts (adherence data)
├── alerts.ts (all alert operations including doctor-specific)
├── patients.ts (patient data - shared across roles)
├── caregivers.ts (caregiver operations)
├── doctors.ts (doctor-specific operations)
├── ai.ts (AI operations)
├── reports.ts (reports)
├── admin.ts (admin operations)
└── notifications.ts (notifications)
```

---

## Priority Action Items

### Critical (Fix Immediately)
1. Fix typo: `POST /doctor/intatentions` → `POST /doctor/interventions`
2. Implement actual API call for `GET /caregiver/patients/:patientId/notes`
3. Decide on medication system (legacy vs new) and migrate

### High Priority
4. Standardize response shapes across all endpoints
5. Remove duplicate AI APIs
6. Replace `any` types with proper interfaces
7. Standardize ID field usage

### Medium Priority
8. Remove or implement dead endpoints
9. Consolidate alert operations
10. Reorganize API file structure

### Low Priority
11. Fix field name mismatches
12. Add comprehensive error types
13. Improve API documentation

---

## Summary Statistics

- **Total API Endpoints:** 42+
- **API Service Files:** 12
- **React Query Hooks:** 38+
- **Response Shape Conflicts:** 8 major conflicts
- **Duplicate APIs:** 3 sets
- **Dead APIs:** 5 endpoints
- **Broken APIs:** 2 endpoints
- **Legacy APIs:** 10+ endpoints (medication system)
- **Unsafe `any` Usage:** 28+ instances
- **ID Field Inconsistency:** Affects 6+ types

**Overall Assessment:** The codebase has significant API inconsistencies, duplicate implementations, and a mixed legacy/new medication architecture that needs consolidation. Critical bugs exist (typos, stub implementations) that should be fixed immediately.
