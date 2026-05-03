# MedAI Backend API Documentation

## Overview

This is the API documentation for the MedAI (Intelligent Medication Adherence Monitoring System) backend. The system provides comprehensive medication management, adherence tracking, caregiver coordination, and AI-powered insights.

**Base URL**: `http://localhost:3000/api`

**Authentication**: JWT Bearer Token (except for login/register endpoints)

**Rate Limiting**: Auth endpoints are rate-limited to 100 requests per 15 minutes

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### User Roles
- `patient`: Regular users who take medications
- `caregiver`: Family members or caregivers who monitor patients
- `doctor`: Healthcare providers who prescribe medications
- `admin`: System administrators

---

## Endpoints

### Health Check
- **GET** `/health`
  - **Description**: Check API health status
  - **Authentication**: None
  - **Response**: 
    ```json
    {
      "status": "ok",
      "timestamp": "2024-04-30T12:00:00.000Z"
    }
    ```

---

## Authentication Endpoints

### Register User
- **POST** `/auth/register`
- **Description**: Register a new user
- **Authentication**: None
- **Roles**: Public (no authentication required)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "fullName": "John Doe",
    "role": "patient", // optional: patient, caregiver, doctor, admin
    "phone": "+1234567890", // optional
    "timezone": "America/New_York" // optional
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "user_id",
        "email": "user@example.com",
        "fullName": "John Doe",
        "role": "patient",
        "phone": "+1234567890",
        "timezone": "America/New_York",
        "isActive": true,
        "notificationPrefs": {
          "push": true,
          "sms": false,
          "email": true,
          "reminderLeadMinutes": 15
        }
      },
      "token": "jwt_token"
    }
  }
  ```

### Login
- **POST** `/auth/login`
- **Description**: Authenticate user and get token
- **Authentication**: None
- **Roles**: Public (no authentication required)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**: Same as register response

### Refresh Token
- **POST** `/auth/refresh`
- **Description**: Refresh JWT token
- **Authentication**: None
- **Roles**: Public (no authentication required)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "token": "new_jwt_token"
    }
  }
  ```

### Logout
- **POST** `/auth/logout`
- **Description**: Logout user (invalidate token)
- **Authentication**: None
- **Roles**: Public (no authentication required)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### Google OAuth
- **GET** `/auth/google`
  - **Description**: Initiate Google OAuth flow
  - **Authentication**: None
  - **Roles**: Public (no authentication required)

- **GET** `/auth/google/callback`
  - **Description**: Google OAuth callback
  - **Authentication**: None
  - **Roles**: Public (no authentication required)

---

## User Management

### Get Current User
- **GET** `/users/me`
- **Description**: Get current user profile
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "patient",
      "phone": "+1234567890",
      "timezone": "America/New_York",
      "isActive": true,
      "notificationPrefs": {
        "push": true,
        "sms": false,
        "email": true,
        "reminderLeadMinutes": 15
      }
    }
  }
  ```

### Update Current User
- **PATCH** `/users/me`
- **Description**: Update current user profile
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Request Body** (any subset):
  ```json
  {
    "fullName": "John Smith",
    "phone": "+1234567891",
    "timezone": "America/Los_Angeles",
    "notificationPrefs": {
      "push": false,
      "sms": true,
      "email": true,
      "reminderLeadMinutes": 30
    }
  }
  ```

---

## Medication Management

### List Medications
- **GET** `/medications`
- **Description**: Get all medications for the current user
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "med_id",
        "patientId": "user_id",
        "prescribedBy": "doctor_id",
        "name": "Aspirin",
        "dosage": "100mg",
        "frequency": {
          "times": ["08:00", "20:00"],
          "days": ["all"]
        },
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T23:59:59.999Z",
        "instructions": "Take with food",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
  ```

### Get Today's Doses
- **GET** `/medications/today`
- **Description**: Get all medication doses scheduled for today
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "medication": {
          "id": "med_id",
          "name": "Aspirin",
          "dosage": "100mg",
          "instructions": "Take with food"
        },
        "scheduledDoses": [
          {
            "time": "08:00",
            "taken": false,
            "logId": "log_id"
          },
          {
            "time": "20:00",
            "taken": false,
            "logId": null
          }
        ]
      }
    ]
  }
  ```

### Get Medication by ID
- **GET** `/medications/:id`
- **Description**: Get specific medication details
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**: Single medication object (same structure as list response)

### Create Medication
- **POST** `/medications`
- **Description**: Add a new medication
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Request Body**:
  ```json
  {
    "name": "Lisinopril",
    "dosage": "10mg",
    "frequency": {
      "times": ["09:00"],
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    },
    "startDate": "2024-05-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.999Z",
    "instructions": "Take in the morning",
    "patientId": "patient_id", // optional (defaults to current user)
    "prescribedBy": "doctor_id" // optional
  }
  ```

### Update Medication
- **PATCH** `/medications/:id`
- **Description**: Update existing medication
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Request Body**: Any subset of create medication fields

### Delete Medication
- **DELETE** `/medications/:id`
- **Description**: Delete a medication
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Medication deleted successfully"
  }
  ```

---

## Dose Logging

### List Dose Logs
- **GET** `/dose-logs`
- **Description**: Get dose logs for the current user
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `startDate`: Filter by start date (ISO string)
  - `endDate`: Filter by end date (ISO string)
  - `status`: Filter by status (pending, taken, missed, delayed)
  - `medicationId`: Filter by medication ID
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "log_id",
        "medicationId": "med_id",
        "patientId": "user_id",
        "scheduledTime": "2024-04-30T08:00:00.000Z",
        "takenAt": "2024-04-30T08:15:00.000Z",
        "status": "delayed",
        "delayMinutes": 15,
        "notes": "Took with breakfast",
        "createdAt": "2024-04-30T08:00:00.000Z",
        "updatedAt": "2024-04-30T08:15:00.000Z"
      }
    ]
  }
  ```

### Take Dose
- **POST** `/dose-logs/:id/take`
- **Description**: Mark a dose as taken
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Request Body**:
  ```json
  {
    "notes": "Took with food" // optional
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "log_id",
      "status": "taken",
      "takenAt": "2024-04-30T08:00:00.000Z",
      "delayMinutes": 0
    }
  }
  ```

### Skip Dose
- **POST** `/dose-logs/:id/skip`
- **Description**: Mark a dose as skipped
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Request Body**:
  ```json
  {
    "notes": "Forgot to take, will take later"
  }
  ```

---

## Adherence Tracking

### Get Adherence Summary
- **GET** `/adherence/summary`
- **Description**: Get adherence summary statistics
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `period`: Time period (week, month, quarter, year) - default: month
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "period": "month",
      "totalDoses": 60,
      "takenDoses": 54,
      "missedDoses": 4,
      "delayedDoses": 2,
      "adherenceRate": 90,
      "averageDelayMinutes": 12.5,
      "dailyBreakdown": [
        {
          "date": "2024-04-30",
          "total": 2,
          "taken": 2,
          "missed": 0,
          "delayed": 0,
          "rate": 100
        }
      ]
    }
  }
  ```

### Get Adherence History
- **GET** `/adherence/history`
- **Description**: Get detailed adherence history
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `startDate`: Start date (ISO string)
  - `endDate`: End date (ISO string)
  - `groupBy`: Grouping (day, week, month) - default: day
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "date": "2024-04-30",
        "medications": [
          {
            "medicationId": "med_id",
            "name": "Aspirin",
            "scheduledDoses": 2,
            "takenDoses": 2,
            "missedDoses": 0,
            "delayedDoses": 0,
            "adherenceRate": 100
          }
        ],
        "totalScheduled": 2,
        "totalTaken": 2,
        "totalMissed": 0,
        "totalDelayed": 0,
        "overallRate": 100
      }
    ]
  }
  ```

---

## Alerts

### List Alerts
- **GET** `/alerts`
- **Description**: Get alerts for the current user
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `status`: Filter by status (active, acknowledged, resolved)
  - `type`: Filter by type (missed_dose, low_adherence, medication_refill)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "alert_id",
        "patientId": "user_id",
        "type": "missed_dose",
        "message": "Missed dose: Aspirin at 08:00",
        "severity": "medium",
        "status": "active",
        "createdAt": "2024-04-30T09:00:00.000Z",
        "acknowledgedAt": null,
        "resolvedAt": null
      }
    ]
  }
  ```

### Acknowledge Alert
- **PATCH** `/alerts/:id/acknowledge`
- **Description**: Acknowledge an alert
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "alert_id",
      "status": "acknowledged",
      "acknowledgedAt": "2024-04-30T09:30:00.000Z"
    }
  }
  ```

---

## Caregiver Management

### List Patients
- **GET** `/caregiver/patients`
- **Description**: Get list of patients assigned to caregiver
- **Authentication**: Required
- **Roles**: caregiver, doctor, admin
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "patient_id",
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "relationship": "son",
        "adherenceRate": 85,
        "lastActive": "2024-04-30T08:00:00.000Z"
      }
    ]
  }
  ```

### Get Patient Summary
- **GET** `/caregiver/patients/:id/summary`
- **Description**: Get comprehensive patient summary
- **Authentication**: Required
- **Roles**: caregiver, doctor, admin
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "patient": {
        "id": "patient_id",
        "fullName": "John Doe",
        "email": "john@example.com"
      },
      "medications": [
        {
          "id": "med_id",
          "name": "Aspirin",
          "dosage": "100mg",
          "adherenceRate": 90
        }
      ],
      "adherenceSummary": {
        "weeklyRate": 85,
        "monthlyRate": 88,
        "totalDoses": 60,
        "takenDoses": 53
      },
      "recentAlerts": [
        {
          "id": "alert_id",
          "type": "missed_dose",
          "message": "Missed morning dose",
          "createdAt": "2024-04-30T09:00:00.000Z"
        }
      ]
    }
  }
  ```

### Invite Patient
- **POST** `/caregiver/invite/:patientEmail`
- **Description**: Invite a patient to connect
- **Authentication**: Required
- **Roles**: caregiver, doctor
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "inviteId": "invite_id",
      "patientEmail": "patient@example.com",
      "status": "pending"
    }
  }
  ```

### Accept Invite
- **PATCH** `/caregiver/invite/:id/accept`
- **Description**: Accept a caregiver invitation
- **Authentication**: Required
- **Roles**: patient
- **Response**:
  ```json
  {
    "success": true,
    "message": "Invitation accepted"
  }
  ```

### Add Note
- **POST** `/caregiver/patients/:id/notes`
- **Description**: Add a note about a patient
- **Authentication**: Required
- **Roles**: caregiver, doctor
- **Request Body**:
  ```json
  {
    "message": "Patient reported feeling better after medication adjustment"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "note_id",
      "message": "Patient reported feeling better after medication adjustment",
      "createdAt": "2024-04-30T10:00:00.000Z"
    }
  }
  ```

---

## Notifications

### Send Test Notification
- **POST** `/notifications/test`
- **Description**: Send a test push notification
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Test notification sent"
  }
  ```

---

## AI Insights

### Get Risk Score
- **GET** `/ai/risk/:patientId`
- **Description**: Get AI-powered risk assessment for a patient
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "patientId": "patient_id",
      "overallRisk": 0.25,
      "riskLevel": "low",
      "factors": [
        {
          "factor": "adherence_trend",
          "weight": 0.4,
          "score": 0.3,
          "description": "Recent improvement in adherence"
        },
        {
          "factor": "medication_complexity",
          "weight": 0.3,
          "score": 0.2,
          "description": "Low medication complexity"
        }
      ],
      "recommendations": [
        "Continue current medication schedule",
        "Maintain current reminder settings"
      ],
      "calculatedAt": "2024-04-30T12:00:00.000Z"
    }
  }
  ```

### Get Insights
- **GET** `/ai/insights/:patientId`
- **Description**: Get AI-powered insights and recommendations
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "patientId": "patient_id",
      "insights": [
        {
          "type": "pattern",
          "title": "Weekend Adherence Drop",
          "description": "Patient tends to miss doses on weekends",
          "confidence": 0.85,
          "recommendation": "Consider weekend-specific reminder adjustments"
        }
      ],
      "predictions": [
        {
          "type": "adherence",
          "period": "next_week",
          "predictedRate": 0.88,
          "confidence": 0.75
        }
      ],
      "generatedAt": "2024-04-30T12:00:00.000Z"
    }
  }
  ```

### Run Predictions
- **POST** `/ai/run-predictions`
- **Description**: Trigger AI prediction job
- **Authentication**: Required
- **Roles**: admin only
- **Response**:
  ```json
  {
    "success": true,
    "message": "Prediction job started"
  }
  ```

---

## Reports

### Get Patient Report
- **GET** `/reports/patient/:id`
- **Description**: Generate comprehensive patient report
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `startDate`: Report start date (ISO string)
  - `endDate`: Report end date (ISO string)
  - `format`: Report format (json, pdf) - default: json
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "patient": {
        "id": "patient_id",
        "fullName": "John Doe"
      },
      "period": {
        "startDate": "2024-04-01T00:00:00.000Z",
        "endDate": "2024-04-30T23:59:59.999Z"
      },
      "summary": {
        "overallAdherence": 87.5,
        "totalMedications": 3,
        "totalDoses": 90,
        "takenDoses": 79,
        "missedDoses": 8,
        "delayedDoses": 3
      },
      "medications": [
        {
          "name": "Aspirin",
          "adherenceRate": 92,
          "totalDoses": 30,
          "takenDoses": 28
        }
      ],
      "trends": {
        "weeklyAdherence": [85, 88, 92, 87, 90, 86, 89],
        "bestDay": "Wednesday",
        "worstDay": "Saturday"
      }
    }
  }
  ```

### Export Report
- **GET** `/reports/export/:id`
- **Description**: Export patient report in various formats
- **Authentication**: Required
- **Roles**: All authenticated users (patient, caregiver, doctor, admin)
- **Query Parameters**:
  - `format`: Export format (pdf, csv, excel)
  - `startDate`: Report start date (ISO string)
  - `endDate`: Report end date (ISO string)
- **Response**: File download or export URL

---

## Admin Endpoints

### Get System Metrics
- **GET** `/admin/metrics`
- **Description**: Get system-wide metrics and statistics
- **Authentication**: Required
- **Roles**: admin only
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "users": {
        "total": 1250,
        "active": 1180,
        "byRole": {
          "patient": 1000,
          "caregiver": 150,
          "doctor": 80,
          "admin": 20
        }
      },
      "medications": {
        "total": 3500,
        "active": 3200
      },
      "adherence": {
        "averageRate": 82.5,
        "weeklyTrend": "increasing"
      },
      "system": {
        "uptime": "99.9%",
        "apiCalls24h": 15420,
        "errorRate": 0.02
      }
    }
  }
  ```

---

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'patient' | 'caregiver' | 'doctor' | 'admin';
  phone?: string;
  timezone: string;
  isActive: boolean;
  googleId?: string;
  fcmToken?: string;
  notificationPrefs: {
    push: boolean;
    sms: boolean;
    email: boolean;
    reminderLeadMinutes: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Medication Model
```typescript
interface Medication {
  id: string;
  patientId: string;
  prescribedBy?: string;
  name: string;
  dosage: string;
  frequency: {
    times: string[]; // ["08:00", "20:00"]
    days: string[];  // ["monday", "tuesday", ...] or ["all"]
  };
  startDate: string;
  endDate?: string;
  instructions?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### DoseLog Model
```typescript
interface DoseLog {
  id: string;
  medicationId: string;
  patientId: string;
  scheduledTime: string;
  takenAt?: string;
  status: 'pending' | 'taken' | 'missed' | 'delayed';
  delayMinutes: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Alert Model
```typescript
interface Alert {
  id: string;
  patientId: string;
  type: 'missed_dose' | 'low_adherence' | 'medication_refill';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}
```

---

## Error Responses

All endpoints return errors in the following format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Missing or invalid token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server error

---

## WebSocket Events

The system uses Socket.IO for real-time updates. Connect to: `ws://localhost:3000`

### Events
- `medication_reminder`: When a medication dose is due
- `dose_taken`: When a dose is marked as taken
- `dose_missed`: When a dose is missed
- `alert_created`: When a new alert is created
- `adherence_update`: When adherence statistics change

### Authentication
WebSocket connections require JWT authentication:
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

---

## Development Notes

### Environment Variables
- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `REDIS_URL`: Redis connection string

### Rate Limiting
- Auth endpoints: 100 requests per 15 minutes
- Other endpoints: No rate limiting (configurable)

### CORS
- Origin: Configurable via `CORS_ORIGIN` environment variable
- Credentials: Supported

### Security
- Helmet.js for security headers
- JWT tokens with expiration
- Password hashing with bcrypt
- Input validation with Zod schemas
- Audit logging for sensitive operations
