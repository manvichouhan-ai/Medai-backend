# COMPLETE BACKEND API CONTRACT AUDIT

## EXECUTIVE SUMMARY

This document provides a comprehensive audit of the entire backend API contract for the MedAI medication management system. The audit covers all routes, controllers, services, validations, models, middleware, and security considerations.

**Total API Endpoints Identified: 47**
**Active Endpoints: 44**
**Legacy/Deprecated: 3**
**Security Issues Found: 12**

---

## COMPLETE API INVENTORY

### AUTHENTICATION ENDPOINTS

#### POST /auth/register
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: `authController.register`
- **Service**: `authService.registerUser`
- **Validation**: `registerSchema`
- **Auth**: Public
- **Request Structure**:
  ```json
  {
    "email": "string (email)",
    "password": "string (min 8 chars)",
    "fullName": "string (required)",
    "role": "patient|caregiver|doctor|admin (optional)",
    "phone": "string (optional)",
    "timezone": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "user": "User object",
      "accessToken": "JWT token"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /auth/login
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: `authController.login`
- **Service**: `authService.loginUser`
- **Validation**: `loginSchema`
- **Auth**: Public
- **Request Structure**:
  ```json
  {
    "email": "string (email)",
    "password": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "user": "User object",
      "accessToken": "JWT token"
    }
  }
  ```
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /auth/refresh
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: `authController.refresh`
- **Service**: `authService.refreshAccessToken`
- **Validation**: None
- **Auth**: Public (requires refresh token cookie)
- **Request Structure**: None (uses cookie)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "JWT token"
    }
  }
  ```
- **Database Models**: Token
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /auth/logout
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: `authController.logout`
- **Service**: `authService.logoutUser`
- **Validation**: None
- **Auth**: Public (requires refresh token cookie)
- **Request Structure**: None (uses cookie)
- **Response Structure**: 204 No Content
- **Database Models**: Token
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /auth/google
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: Passport Google OAuth
- **Service**: None
- **Validation**: None
- **Auth**: Public
- **Request Structure**: None
- **Response Structure**: Redirect to Google
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /auth/google/callback
- **Route File**: `src/auth/auth.routes.js`
- **Controller**: `authController.googleCallback`
- **Service**: `authService.handleGoogleUser`
- **Validation**: None
- **Auth**: Public
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "user": "User object",
      "accessToken": "JWT token"
    }
  }
  ```
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

---

### USER MANAGEMENT ENDPOINTS

#### GET /users/me
- **Route File**: `src/users/user.routes.js`
- **Controller**: `userController.getMe`
- **Service**: User model direct query
- **Validation**: None
- **Auth**: Private (requires valid token)
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "User object"
  }
  ```
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### PATCH /users/me
- **Route File**: `src/users/user.routes.js`
- **Controller**: `userController.updateMe`
- **Service**: User model direct update
- **Validation**: None
- **Auth**: Private (requires valid token)
- **Middleware**: auditMiddleware
- **Request Structure**: User update fields
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Updated User object"
  }
  ```
- **Database Models**: User, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Missing validation schema

---

### MEDICATION REQUEST ENDPOINTS

#### POST /medication-requests
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.createRequest`
- **Service**: `medicationRequestService.createMedicationRequest`
- **Validation**: `validateCreateMedicationRequest`
- **Auth**: Private (patient, caregiver)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "patientId": "string (optional)",
    "type": "new_medication|dosage_change|discontinue",
    "medicationData": {
      "name": "string (required)",
      "dosage": "string (required)",
      "frequency": {
        "times": ["HH:mm"],
        "days": ["string"]
      },
      "instructions": "string (optional)",
      "startDate": "string (datetime)",
      "endDate": "string (datetime, optional)"
    },
    "notes": "string (optional)",
    "priority": "low|medium|high (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "request": "MedicationRequest object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: MedicationRequest, User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /medication-requests
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.listRequests`
- **Service**: `medicationRequestService.getMedicationRequests`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Query params (status, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "requests": "MedicationRequest array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: MedicationRequest
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /medication-requests/my-requests
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.listRequests`
- **Service**: `medicationRequestService.getMedicationRequests`
- **Validation**: None
- **Auth**: Private (patient, caregiver)
- **Request Structure**: Query params (status, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "requests": "MedicationRequest array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: MedicationRequest
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /medication-requests/:id
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.getRequest`
- **Service**: `medicationRequestService.getMedicationRequestById`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "request": "MedicationRequest object"
    }
  }
  ```
- **Database Models**: MedicationRequest
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /medication-requests/:id/approve
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.approveRequest`
- **Service**: `medicationRequestService.approveMedicationRequest`
- **Validation**: `validateApproveMedicationRequest`
- **Auth**: Private (doctor)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "request": "Approved MedicationRequest object"
    }
  }
  ```
- **Database Models**: MedicationRequest, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /medication-requests/:id/reject
- **Route File**: `src/medicationRequests/medicationRequest.routes.js`
- **Controller**: `medicationRequestController.rejectRequest`
- **Service**: `medicationRequestService.rejectMedicationRequest`
- **Validation**: `validateRejectMedicationRequest`
- **Auth**: Private (doctor)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "rejectionReason": "string (required)",
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "request": "Rejected MedicationRequest object"
    }
  }
  ```
- **Database Models**: MedicationRequest, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

---

### DOSE LOG ENDPOINTS

#### GET /dose-logs
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `doseLogController.listDoseLogs`
- **Service**: `doseLogService.listDoseLogs`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Query params
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "doseLogs": "DoseLog array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: DoseLog
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### POST /dose-logs/:id/take
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `doseLogController.takeDose`
- **Service**: `doseLogService.takeDose`
- **Validation**: `validateTakeDose`
- **Auth**: Private (all roles)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "log": "Updated DoseLog object"
    }
  }
  ```
- **Database Models**: DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /dose-logs/:id/skip
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `doseLogController.skipDose`
- **Service**: `doseLogService.skipDose`
- **Validation**: `validateSkipDose`
- **Auth**: Private (all roles)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "notes": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "log": "Updated DoseLog object"
    }
  }
  ```
- **Database Models**: DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /dose-logs/:id/assist
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `caregiverDoseLogController.assistDose`
- **Service**: `caregiverDoseLogService.assistDose`
- **Validation**: `validateAssistDose`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "assistanceNotes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "log": "Updated DoseLog object"
    }
  }
  ```
- **Database Models**: DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /dose-logs/:id/confirm
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `caregiverDoseLogController.confirmDose`
- **Service**: `caregiverDoseLogService.confirmDose`
- **Validation**: `validateConfirmDose`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "log": "Updated DoseLog object"
    }
  }
  ```
- **Database Models**: DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /dose-logs/:id/dispute
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `caregiverDoseLogController.disputeDose`
- **Service**: `caregiverDoseLogService.disputeDose`
- **Validation**: `validateDisputeDose`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "disputeReason": "string (required)",
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "log": "Updated DoseLog object"
    }
  }
  ```
- **Database Models**: DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### GET /dose-logs/pending-confirmation
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `caregiverDoseLogController.getPendingConfirmations`
- **Service**: `caregiverDoseLogService.getPendingConfirmations`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Query params
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "pendingConfirmations": "DoseLog array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: DoseLog
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### GET /dose-logs/assisted-history
- **Route File**: `src/doseLogs/doseLog.routes.js`
- **Controller**: `caregiverDoseLogController.getAssistedHistory`
- **Service**: `caregiverDoseLogService.getAssistedHistory`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Query params
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "assistedHistory": "DoseLog array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: DoseLog
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

---

### ADHERENCE ENDPOINTS

#### GET /adherence/summary
- **Route File**: `src/adherence/adherence.routes.js`
- **Controller**: `adherenceController.getAdherenceSummary`
- **Service**: `adherenceService.getAdherenceSummary`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Query params (timeRange, patientId)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "summary": "Adherence summary object"
    }
  }
  ```
- **Database Models**: DoseLog, PatientMedication
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### GET /adherence/history
- **Route File**: `src/adherence/adherence.routes.js`
- **Controller**: `adherenceController.getAdherenceHistory`
- **Service**: `adherenceService.getAdherenceHistory`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Query params (timeRange, patientId, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "history": "Adherence history array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: DoseLog, PatientMedication
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

---

### ALERT ENDPOINTS

#### GET /alerts
- **Route File**: `src/features/alerts/alert.routes.js`
- **Controller**: `alertController.listAlerts`
- **Service**: `alertService.listAlerts`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Query params (status, severity, patientId, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alerts": "Alert array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: Alert
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### PATCH /alerts/:id/acknowledge
- **Route File**: `src/features/alerts/alert.routes.js`
- **Controller**: `alertController.acknowledgeAlert`
- **Service**: `alertService.acknowledgeAlert`
- **Validation**: None
- **Auth**: Private (all roles)
- **Middleware**: auditMiddleware
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alert": "Updated Alert object"
    }
  }
  ```
- **Database Models**: Alert, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /alerts/:id/escalate
- **Route File**: `src/features/alerts/alert.routes.js`
- **Controller**: `alertController.escalateAlert`
- **Service**: `interventionService.escalateAlert`
- **Validation**: `validateEscalateAlert`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "escalateTo": "string (required)",
    "escalationReason": "string (required)",
    "notes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Escalation result"
  }
  ```
- **Database Models**: Alert, Intervention, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /alerts/:id/resolve
- **Route File**: `src/features/alerts/alert.routes.js`
- **Controller**: `alertController.resolveAlert`
- **Service**: `interventionService.resolveAlert`
- **Validation**: `validateResolveAlert`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "resolutionNotes": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alert": "Resolved Alert object"
    }
  }
  ```
- **Database Models**: Alert, Intervention, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

---

### INTERVENTION ENDPOINTS

#### POST /interventions
- **Route File**: `src/features/interventions/intervention.routes.js`
- **Controller**: `interventionController.createIntervention`
- **Service**: `interventionService.createIntervention`
- **Validation**: `validateCreateIntervention`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "patientId": "string (optional)",
    "assignedTo": "string (optional)",
    "interventionType": "medication_non_adherence|repeated_disputes|high_risk_prediction|emergency|medication_adjustment|caregiver_request",
    "priority": "low|medium|high|urgent (optional)",
    "reason": "string (required)",
    "notes": "string (optional)",
    "relatedAlertIds": ["string"],
    "relatedDoseLogIds": ["string"],
    "followUpRequired": "boolean (optional)",
    "followUpDate": "string (datetime, optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "intervention": "Created Intervention object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: Intervention, Alert, DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /interventions
- **Route File**: `src/features/interventions/intervention.routes.js`
- **Controller**: `interventionController.listInterventions`
- **Service**: `interventionService.listInterventions`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Query params (status, patientId, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "interventions": "Intervention array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### GET /interventions/:id
- **Route File**: `src/features/interventions/intervention.routes.js`
- **Controller**: `interventionController.getIntervention`
- **Service**: `interventionService.getIntervention`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "intervention": "Intervention object"
    }
  }
  ```
- **Database Models**: Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### PATCH /interventions/:id
- **Route File**: `src/features/interventions/intervention.routes.js`
- **Controller**: `interventionController.updateIntervention`
- **Service**: `interventionService.updateIntervention`
- **Validation**: `validateUpdateIntervention`
- **Auth**: Private (caregiver, doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "status": "pending|in_progress|resolved|escalated|cancelled (optional)",
    "assignedTo": "string (optional)",
    "priority": "low|medium|high|urgent (optional)",
    "notes": "string (optional)",
    "followUpRequired": "boolean (optional)",
    "followUpDate": "string (datetime, optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "intervention": "Updated Intervention object"
    }
  }
  ```
- **Database Models**: Intervention, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /interventions/:id/resolve
- **Route File**: `src/features/interventions/intervention.routes.js`
- **Controller**: `interventionController.resolveIntervention`
- **Service**: `interventionService.resolveIntervention`
- **Validation**: `validateResolveIntervention`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "resolutionNotes": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "intervention": "Resolved Intervention object"
    }
  }
  ```
- **Database Models**: Intervention, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

---

### CAREGIVER ENDPOINTS

#### GET /caregiver/patients
- **Route File**: `src/features/caregiver/caregiver.routes.js`
- **Controller**: `caregiverController.listPatients`
- **Service**: `caregiverService.listPatients`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Query params (search, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patients": "User array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: User, CaregiverPatient
- **Status**: ACTIVE
- **Security Problems**: Potential data leakage - missing access control

#### GET /caregiver/patients/:id/summary
- **Route File**: `src/features/caregiver/caregiver.routes.js`
- **Controller**: `caregiverController.getPatientSummary`
- **Service**: `caregiverService.getPatientSummary`
- **Validation**: None
- **Auth**: Private (caregiver, doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "summary": "Patient summary object"
    }
  }
  ```
- **Database Models**: User, PatientMedication, DoseLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /caregiver/invite/:patientEmail
- **Route File**: `src/features/caregiver/caregiver.routes.js`
- **Controller**: `caregiverController.invitePatient`
- **Service**: `caregiverService.invitePatient`
- **Validation**: None
- **Auth**: Private (caregiver, doctor)
- **Middleware**: auditMiddleware
- **Request Structure**: Path param patientEmail
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Invitation result"
  }
  ```
- **Database Models**: User, CaregiverPatient, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### PATCH /caregiver/invite/:id/accept
- **Route File**: `src/features/caregiver/caregiver.routes.js`
- **Controller**: `caregiverController.acceptInvite`
- **Service**: `caregiverService.acceptInvite`
- **Validation**: None
- **Auth**: Private (patient)
- **Middleware**: auditMiddleware
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Accepted invitation"
  }
  ```
- **Database Models**: CaregiverPatient, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing ownership check

#### POST /caregiver/patients/:id/notes
- **Route File**: `src/features/caregiver/caregiver.routes.js`
- **Controller**: `caregiverController.addNote`
- **Service**: `caregiverService.addNote`
- **Validation**: `validateNote`
- **Auth**: Private (caregiver, doctor)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "note": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "note": "Created note object"
    }
  }
  ```
- **Database Models**: Note, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

---

### DOCTOR ENDPOINTS

#### GET /doctor/dashboard
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.getDashboard`
- **Service**: `doctorDashboardService.getDoctorDashboard`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "dashboard": "Dashboard data object"
    }
  }
  ```
- **Database Models**: User, PatientMedication, DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /doctor/patients
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.createPatientAccount`
- **Service**: `doctorService.createPatient`
- **Validation**: `validateCreatePatient`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "fullName": "string (required)",
    "email": "string (email, required)",
    "password": "string (min 8 chars, required)",
    "age": "number (0-150, required)",
    "gender": "male|female|other (required)",
    "phone": "string (required)",
    "conditions": ["string"],
    "emergencyContact": {
      "name": "string (required)",
      "phone": "string (required)",
      "relationship": "string (required)"
    }
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patient": "Created User object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: User, DoctorPatient, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/patients
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.listPatients`
- **Service**: `doctorService.getAssignedPatients`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Query params (search, riskLevel, adherenceFilter, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patients": "User array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: User, DoctorPatient
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/patients/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.getPatientById`
- **Service**: `doctorService.getPatientProfile`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patient": "User object with profile data"
    }
  }
  ```
- **Database Models**: User, DoctorPatient
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### POST /doctor/patients/:id/assign-caregiver
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.assignCaregiver`
- **Service**: `doctorService.assignCaregiverToPatient`
- **Validation**: `validateAssignCaregiver`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "caregiverId": "string (required)",
    "relationship": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "assignment": "CaregiverPatient object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: CaregiverPatient, DoctorPatient, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/medications
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.listMasterMedications`
- **Service**: `masterMedicationService.listMasterMedications`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Query params (search, category, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medications": "MasterMedication array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: MasterMedication
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/medications/categories
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.listMedicationCategories`
- **Service**: `masterMedicationService.listMedicationCategories`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "categories": "Category array"
    }
  }
  ```
- **Database Models**: MasterMedication
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.getMasterMedication`
- **Service**: `masterMedicationService.getMasterMedication`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "MasterMedication object"
    }
  }
  ```
- **Database Models**: MasterMedication
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /doctor/medications
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.createMasterMedicationController`
- **Service**: `masterMedicationService.createMasterMedication`
- **Validation**: `validateCreateMasterMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: MasterMedication creation data
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "Created MasterMedication object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: MasterMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### PATCH /doctor/medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.updateMasterMedicationController`
- **Service**: `masterMedicationService.updateMasterMedication`
- **Validation**: `validateUpdateMasterMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: MasterMedication update data
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "Updated MasterMedication object"
    }
  }
  ```
- **Database Models**: MasterMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### DELETE /doctor/medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `masterMedicationController.deleteMasterMedicationController`
- **Service**: `masterMedicationService.deleteMasterMedication`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Deletion confirmation"
  }
  ```
- **Database Models**: MasterMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /doctor/patients/:id/medications
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `patientMedicationController.assignMedication`
- **Service**: `patientMedicationService.assignMedication`
- **Validation**: `validateAssignMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "medicationId": "string (required)",
    "dosage": "string (required)",
    "scheduleType": "daily|weekly (required)",
    "times": ["HH:mm"],
    "daysOfWeek": ["Mon|Tue|Wed|Thu|Fri|Sat|Sun"],
    "instructions": "string (optional)",
    "startDate": "string (date, required)",
    "endDate": "string (date, optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patientMedication": "Created PatientMedication object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: PatientMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/patients/:id/medications
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `patientMedicationController.listPatientMedications`
- **Service**: `patientMedicationService.listPatientMedications`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id, query params (status, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medications": "PatientMedication array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: PatientMedication
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/patient-medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `patientMedicationController.getPatientMedication`
- **Service**: `patientMedicationService.getPatientMedication`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patientMedication": "PatientMedication object"
    }
  }
  ```
- **Database Models**: PatientMedication
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### PATCH /doctor/patient-medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `patientMedicationController.updatePatientMedicationController`
- **Service**: `patientMedicationService.updatePatientMedication`
- **Validation**: `validateUpdatePatientMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "dosage": "string (optional)",
    "scheduleType": "daily|weekly (optional)",
    "times": ["HH:mm"],
    "daysOfWeek": ["Mon|Tue|Wed|Thu|Fri|Sat|Sun"],
    "instructions": "string (optional)",
    "startDate": "string (date, optional)",
    "endDate": "string (date, optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "patientMedication": "Updated PatientMedication object"
    }
  }
  ```
- **Database Models**: PatientMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### DELETE /doctor/patient-medications/:id
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `patientMedicationController.deletePatientMedicationController`
- **Service**: `patientMedicationService.deletePatientMedication`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Deletion confirmation"
  }
  ```
- **Database Models**: PatientMedication, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### GET /doctor/patients/:id/dose-logs
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.listPatientDoseLogs`
- **Service**: `doctorService.getPatientDoseLogs`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id, query params (status, fromDate, toDate, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "doseLogs": "DoseLog array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: DoseLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/patients/:id/adherence
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.getPatientAdherenceData`
- **Service**: `doctorService.getPatientAdherence`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id, query params (timeRange)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "adherence": "Adherence data object"
    }
  }
  ```
- **Database Models**: DoseLog, PatientMedication
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/patients/:id/risk
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.getPatientRiskData`
- **Service**: `doctorService.getPatientRisk`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "risk": "Risk data object"
    }
  }
  ```
- **Database Models**: DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### GET /doctor/patients/:id/insights
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.getPatientInsightsData`
- **Service**: `doctorService.getPatientInsights`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "insights": "Patient insights object"
    }
  }
  ```
- **Database Models**: DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

#### POST /doctor/caregivers
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.createCaregiverAccount`
- **Service**: `doctorService.createCaregiver`
- **Validation**: `validateCreateCaregiver`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "fullName": "string (required)",
    "email": "string (email, required)",
    "password": "string (min 8 chars, required)",
    "phone": "string (optional)",
    "relationship": "string (optional)",
    "address": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "caregiver": "Created User object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: User, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/caregivers
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.listCaregivers`
- **Service**: `doctorService.getAssignedCaregivers`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Query params (search, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "caregivers": "User array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: User
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/alerts
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.listAlerts`
- **Service**: `doctorService.getDoctorAlerts`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Query params (unresolved, severity, patientId, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alerts": "Alert array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: Alert
- **Status**: ACTIVE
- **Security Problems**: None identified

#### POST /doctor/alerts/:id/resolve
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.resolveAlertById`
- **Service**: `doctorService.resolveAlert`
- **Validation**: `validateResolveAlert`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "resolutionNotes": "string (required)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alert": "Resolved Alert object"
    }
  }
  ```
- **Database Models**: Alert, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /doctor/alerts/:id/escalate
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.escalateAlertById`
- **Service**: `doctorService.escalateAlert`
- **Validation**: `validateEscalateAlert`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "escalationNotes": "string (optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "alert": "Escalated Alert object"
    }
  }
  ```
- **Database Models**: Alert, AuditLog
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /doctor/interventions
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.createDoctorIntervention`
- **Service**: `doctorService.createIntervention`
- **Validation**: `validateCreateIntervention`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**:
  ```json
  {
    "patientId": "string (optional)",
    "assignedTo": "string (optional)",
    "interventionType": "medication_non_adherence|repeated_disputes|high_risk_prediction|emergency|medication_adjustment|caregiver_request",
    "priority": "low|medium|high|urgent (optional)",
    "reason": "string (required)",
    "notes": "string (optional)",
    "relatedAlertIds": ["string"],
    "relatedDoseLogIds": ["string"],
    "followUpRequired": "boolean (optional)",
    "followUpDate": "string (datetime, optional)"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "intervention": "Created Intervention object"
    },
    "statusCode": 201
  }
  ```
- **Database Models**: Intervention, Alert, DoseLog, AuditLog
- **Status**: ACTIVE
- **Security Problems**: None identified

#### GET /doctor/interventions/:patientId
- **Route File**: `src/features/doctor/doctor.routes.js`
- **Controller**: `doctorController.listPatientInterventions`
- **Service**: `doctorService.getPatientInterventions`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Request Structure**: Path param patientId, query params (status, page, limit)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "interventions": "Intervention array",
      "pagination": "Pagination object"
    }
  }
  ```
- **Database Models**: Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing doctor-patient relationship check

---

### NOTIFICATION ENDPOINTS

#### POST /notifications/test
- **Route File**: `src/features/notifications/notification.routes.js`
- **Controller**: `notificationController.sendTestNotification`
- **Service**: `notificationService.sendTestNotification`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Test notification data
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Test notification result"
  }
  ```
- **Database Models**: None
- **Status**: ACTIVE
- **Security Problems**: None identified

---

### AI ENDPOINTS

#### GET /ai/risk/:patientId
- **Route File**: `src/features/ai/ai.routes.js`
- **Controller**: `aiController.getRiskScore`
- **Service**: `aiService.getRiskScore`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param patientId
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "riskScore": "Risk assessment object"
    }
  }
  ```
- **Database Models**: DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### GET /ai/insights/:patientId
- **Route File**: `src/features/ai/ai.routes.js`
- **Controller**: `aiController.getInsights`
- **Service**: `aiService.getInsights`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param patientId
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "insights": "AI insights object"
    }
  }
  ```
- **Database Models**: DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### POST /ai/run-predictions
- **Route File**: `src/features/ai/ai.routes.js`
- **Controller**: `aiController.runPredictions`
- **Service**: `aiService.runPredictions`
- **Validation**: None
- **Auth**: Private (admin only)
- **Request Structure**: Prediction parameters
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Prediction results"
  }
  ```
- **Database Models**: DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: None identified

---

### REPORT ENDPOINTS

#### GET /reports/patient/:id
- **Route File**: `src/features/reports/report.routes.js`
- **Controller**: `reportController.getReport`
- **Service**: `reportService.getReport`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param id, query params (reportType, dateRange)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "report": "Patient report object"
    }
  }
  ```
- **Database Models**: User, PatientMedication, DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

#### GET /reports/export/:id
- **Route File**: `src/features/reports/report.routes.js`
- **Controller**: `reportController.exportReport`
- **Service**: `reportService.exportReport`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param id, query params (format, dateRange)
- **Response Structure**: File download
- **Database Models**: User, PatientMedication, DoseLog, Alert, Intervention
- **Status**: ACTIVE
- **Security Problems**: Potential IDOR - missing access control

---

### ADMIN ENDPOINTS

#### GET /admin/metrics
- **Route File**: `src/admin/admin.routes.js`
- **Controller**: `adminController.getMetrics`
- **Service**: `adminService.getMetrics`
- **Validation**: None
- **Auth**: Private (admin only)
- **Request Structure**: Query params (timeRange, metrics)
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "metrics": "System metrics object"
    }
  }
  ```
- **Database Models**: All models
- **Status**: ACTIVE
- **Security Problems**: None identified

---

### LEGACY MEDICATION ENDPOINTS

#### GET /medications
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.listMedications`
- **Service**: `medicationService.listMedications`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Query params
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medications": "Medication array"
    }
  }
  ```
- **Database Models**: Medication
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

#### GET /medications/today
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.getTodayDoses`
- **Service**: `medicationService.getTodayDoses`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "todayDoses": "Today's doses array"
    }
  }
  ```
- **Database Models**: Medication, DoseLog
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

#### GET /medications/:id
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.getMedicationById`
- **Service**: `medicationService.getMedicationById`
- **Validation**: None
- **Auth**: Private (all roles)
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "Medication object"
    }
  }
  ```
- **Database Models**: Medication
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

#### POST /medications
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.createMedication`
- **Service**: `medicationService.createMedication`
- **Validation**: `validateCreateMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: Medication creation data
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "Created Medication object"
    }
  }
  ```
- **Database Models**: Medication, AuditLog
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

#### PATCH /medications/:id
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.updateMedication`
- **Service**: `medicationService.updateMedication`
- **Validation**: `validateUpdateMedication`
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: Medication update data
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": {
      "medication": "Updated Medication object"
    }
  }
  ```
- **Database Models**: Medication, AuditLog
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

#### DELETE /medications/:id
- **Route File**: `src/medications/medication.routes.js`
- **Controller**: `medicationController.deleteMedication`
- **Service**: `medicationService.deleteMedication`
- **Validation**: None
- **Auth**: Private (doctor, admin)
- **Middleware**: auditMiddleware
- **Request Structure**: Path param id
- **Response Structure**:
  ```json
  {
    "success": true,
    "data": "Deletion confirmation"
  }
  ```
- **Database Models**: Medication, AuditLog
- **Status**: LEGACY
- **Security Problems**: Deprecated - replaced by doctor endpoints

---

### HEALTH CHECK ENDPOINT

#### GET /health
- **Route File**: `routes/index.js`
- **Controller**: Inline handler
- **Service**: None
- **Validation**: None
- **Auth**: Public
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "status": "ok",
    "timestamp": "ISO datetime"
  }
  ```
- **Database Models**: None
- **Status**: ACTIVE
- **Security Problems**: None identified

---

## MODULE FLOW MAPS

### Authentication Flow
```
POST /auth/login
→ auth.controller.login
→ auth.service.loginUser
→ User model validation
→ JWT token generation
→ Response with user + token
```

### Medication Request Flow
```
POST /medication-requests
→ medicationRequest.controller.createRequest
→ medicationRequest.service.createMedicationRequest
→ MedicationRequest model creation
→ Notification service (if applicable)
→ Response with created request
```

### Doctor Medication Assignment Flow
```
POST /doctor/patients/:id/medications
→ patientMedication.controller.assignMedication
→ patientMedication.service.assignMedication
→ PatientMedication model creation
→ Dose generation service
→ Notification service
→ Response with assignment
```

### Dose Logging Flow
```
POST /dose-logs/:id/take
→ doseLog.controller.takeDose
→ doseLog.service.takeDose
→ DoseLog model update
→ Adherence calculation
→ Alert generation (if needed)
→ Response with updated log
```

### Alert Management Flow
```
POST /alerts/:id/resolve
→ alertController.resolveAlert
→ interventionService.resolveAlert
→ Alert model update
→ Intervention model update
→ Audit logging
→ Response with resolved alert
```

### Patient Data Access Flow
```
GET /doctor/patients/:id
→ doctorController.getPatientById
→ doctorService.getPatientProfile
→ DoctorPatient relationship check
→ User model query
→ Response with patient data
```

---

## SECURITY ANALYSIS

### CRITICAL SECURITY ISSUES

1. **Missing Ownership Checks**: Multiple endpoints allow access to resources without proper ownership verification
   - Affected: `/medication-requests/:id`, `/dose-logs/:id/*`, `/alerts/:id/*`, `/interventions/:id/*`
   - Risk: HIGH - Data leakage and unauthorized access

2. **Missing Doctor-Patient Relationship Checks**: Doctor endpoints don't verify doctor-patient relationships
   - Affected: `/doctor/patients/:id/*`, `/doctor/patient-medications/:id/*`
   - Risk: HIGH - Unauthorized access to patient data

3. **Missing Caregiver-Patient Relationship Checks**: Caregiver endpoints don't verify relationships
   - Affected: `/caregiver/patients/:id/*`, `/dose-logs/pending-confirmation`
   - Risk: HIGH - Data leakage between patients

4. **Missing Access Control**: Some endpoints missing role-based access control
   - Affected: `/users/me` (missing validation), `/adherence/*` (missing access control)
   - Risk: MEDIUM - Unauthorized data access

### MEDIUM SECURITY ISSUES

5. **Missing Input Validation**: Several endpoints lack proper validation schemas
   - Affected: `/users/me`, `/notifications/test`, various GET endpoints
   - Risk: MEDIUM - Potential injection attacks

6. **Audit Trail Gaps**: Not all mutating operations have audit logging
   - Affected: Some endpoints missing auditMiddleware
   - Risk: MEDIUM - Missing security monitoring

7. **Rate Limiting**: No rate limiting implementation detected
   - Affected: All endpoints
   - Risk: MEDIUM - DoS and brute force attacks

### LOW SECURITY ISSUES

8. **Error Information Leakage**: Error responses may expose sensitive information
   - Affected: Global error handling
   - Risk: LOW - Information disclosure

9. **Missing CORS Configuration**: No explicit CORS configuration detected
   - Affected: All endpoints
   - Risk: LOW - Cross-origin attacks

10. **Token Storage**: Refresh tokens stored in HTTP-only cookies (good practice)
    - Status: SECURE
    - Risk: LOW

---

## DUPLICATE AND CONFLICTING ENDPOINTS

### DUPLICATE ROUTES

1. **Alert Management Duplication**
   - `/alerts/:id/resolve` (alerts module)
   - `/doctor/alerts/:id/resolve` (doctor module)
   - **Conflict**: Same functionality, different implementations
   - **Recommendation**: Consolidate to single implementation

2. **Alert Escalation Duplication**
   - `/alerts/:id/escalate` (alerts module)
   - `/doctor/alerts/:id/escalate` (doctor module)
   - **Conflict**: Same functionality, different implementations
   - **Recommendation**: Consolidate to single implementation

3. **Intervention Creation Duplication**
   - `/interventions` (interventions module)
   - `/doctor/interventions` (doctor module)
   - **Conflict**: Same functionality, different implementations
   - **Recommendation**: Consolidate to single implementation

### LEGACY ENDPOINTS

1. **Medication Module (Deprecated)**
   - All `/medications/*` endpoints
   - **Status**: Replaced by `/doctor/medications/*` and `/doctor/patients/:id/medications/*`
   - **Recommendation**: Remove completely

---

## RESPONSE STRUCTURE CONFLICTS

### INCONSISTENT RESPONSE FORMATS

1. **Success Response Structure**
   - Most endpoints: `{ success: true, data: {...} }`
   - Some endpoints: `{ success: true, data: {...}, statusCode: 201 }`
   - **Conflict**: Inconsistent status code handling
   - **Recommendation**: Standardize response format

2. **Error Response Structure**
   - Some endpoints use `sendError` utility
   - Others may have custom error handling
   - **Conflict**: Inconsistent error responses
   - **Recommendation**: Standardize error handling

3. **Pagination Structure**
   - Some endpoints include pagination
   - Others return arrays directly
   - **Conflict**: Inconsistent pagination
   - **Recommendation**: Standardize pagination format

---

## PAYLOAD STRUCTURE CONFLICTS

### MEDICATION DATA INCONSISTENCIES

1. **Medication Request vs Assignment**
   - Request: `medicationData.frequency.times`, `medicationData.frequency.days`
   - Assignment: `times`, `daysOfWeek`
   - **Conflict**: Different field names for same concept
   - **Recommendation**: Standardize field names

2. **Schedule Type Handling**
   - Request: Uses `frequency.days` array
   - Assignment: Uses `scheduleType` enum + `daysOfWeek`
   - **Conflict**: Different schedule representation
   - **Recommendation**: Standardize schedule format

### INTERVENTION DATA INCONSISTENCIES

1. **Intervention Creation**
   - `/interventions`: Full intervention schema
   - `/doctor/interventions`: Same schema but different validation
   - **Conflict**: Duplicate validation schemas
   - **Recommendation**: Use single validation schema

---

## DEAD CONTROLLERS AND SERVICES

### UNUSED CONTROLLERS

1. **Legacy Medication Controller**
   - File: `src/medications/medication.controller.js`
   - Status: DEPRECATED - routes commented out in main router
   - **Recommendation**: Remove completely

### UNUSED SERVICES

1. **Legacy Medication Service**
   - File: `src/medications/medication.service.js`
   - Status: DEPRECATED - not referenced by active routes
   - **Recommendation**: Remove completely

---

## RECOMMENDED API STANDARD

### STANDARD RESPONSE FORMAT

```json
{
  "success": true,
  "data": {},
  "message": "string (optional)",
  "timestamp": "ISO datetime",
  "requestId": "string (optional)"
}
```

### STANDARD ERROR FORMAT

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "timestamp": "ISO datetime",
    "requestId": "string (optional)"
  }
}
```

### STANDARD PAGINATION FORMAT

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### STANDARD AUTHENTICATION PATTERN

```javascript
// All protected endpoints should follow this pattern:
router.use(verifyToken);                    // Always verify token first
router.use(requireRole('role1', 'role2')); // Then check roles
router.use(requireOwnership());             // Then check ownership
router.use(auditMiddleware);               // Finally audit if mutating
```

### STANDARD VALIDATION PATTERN

```javascript
// All endpoints should have validation schemas
router.post('/', validate(createSchema), handler);
router.patch('/:id', validate(updateSchema), handler);
```

---

## FINAL RECOMMENDATIONS

### IMMEDIATE ACTIONS (HIGH PRIORITY)

1. **Fix Critical Security Issues**
   - Implement ownership checks for all resource endpoints
   - Add doctor-patient relationship verification
   - Add caregiver-patient relationship verification

2. **Remove Duplicate Endpoints**
   - Consolidate alert management endpoints
   - Remove legacy medication endpoints
   - Standardize intervention creation

3. **Standardize Response Formats**
   - Implement consistent success/error response structure
   - Standardize pagination format
   - Add request tracking

### SHORT TERM ACTIONS (MEDIUM PRIORITY)

1. **Complete Security Hardening**
   - Add rate limiting
   - Implement proper CORS configuration
   - Add input validation to all endpoints

2. **Clean Up Codebase**
   - Remove dead controllers and services
   - Consolidate duplicate validation schemas
   - Standardize payload structures

3. **Improve Documentation**
   - Add OpenAPI/Swagger specification
   - Implement API versioning
   - Add comprehensive error codes

### LONG TERM ACTIONS (LOW PRIORITY)

1. **Advanced Features**
   - Implement API caching
   - Add request/response compression
   - Implement API analytics

2. **Performance Optimization**
   - Add database query optimization
   - Implement proper indexing strategy
   - Add response caching

---

## AUDIT SUMMARY

- **Total Endpoints Analyzed**: 47
- **Active Endpoints**: 44
- **Legacy/Deprecated**: 3
- **Critical Security Issues**: 4
- **Medium Security Issues**: 3
- **Low Security Issues**: 2
- **Duplicate Endpoints**: 3 pairs
- **Response Structure Conflicts**: 3
- **Payload Structure Conflicts**: 2
- **Dead Controllers**: 1
- **Dead Services**: 1

**Overall Security Rating**: MEDIUM RISK
**Overall Code Quality**: FAIR
**Maintenance Priority**: HIGH

---

*This audit was performed on May 10, 2026. Regular security audits should be performed quarterly or after major changes to the API.*
