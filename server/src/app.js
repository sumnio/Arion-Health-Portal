import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/healthRoutes.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAuthorizationProbeRouter } from './routes/authorizationProbeRoutes.js';
import { createPatientRouter } from './routes/patientRoutes.js';
import { createStaffAppointmentRouter } from './routes/staffAppointmentRoutes.js';
import { createDoctorAvailabilityRouter } from './routes/doctorAvailabilityRoutes.js';
import { createAuthModule } from './services/authModule.js';
import { createPatientAppointmentModule } from './services/patientAppointmentModule.js';
import { createSchedulingModule } from './services/schedulingModule.js';
import { createClinicalModule } from './services/clinicalModule.js';
import { createDoctorClinicalRouter } from './routes/doctorClinicalRoutes.js';
import { createPatientClinicalRouter } from './routes/patientClinicalRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

function corsOptions(origin) {
  return {
    origin(requestOrigin, callback) {
      if (!requestOrigin || requestOrigin === origin) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed by CORS.'), { status: 403, code: 'CORS_DENIED' }));
    },
    credentials: true,
  };
}

export function createApp(
  {
    corsOrigin = 'http://127.0.0.1:5173',
    nodeEnv = 'development',
    authSecret = '',
    enableAuthorizationProbes = false,
    clinicTimeZone = 'Asia/Manila',
    clinicOpenTime = '',
    clinicCloseTime = '',
    clinicName = 'Arion Health Clinic',
    clinicLocation = '123 Wellness Avenue, Quezon City (mock address)',
  } = {},
  dependencies = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(corsOrigin)));
  app.use(express.json());
  app.use(cookieParser());
  const authModule = dependencies.authModule ?? createAuthModule({ authSecret });
  const schedulingModule = dependencies.schedulingModule ?? createSchedulingModule({
    clinic: {
      timeZone: clinicTimeZone,
      openTime: clinicOpenTime,
      closeTime: clinicCloseTime,
      name: clinicName,
      location: clinicLocation,
    },
  });
  const patientAppointmentModule =
    dependencies.patientAppointmentModule ?? createPatientAppointmentModule({
      bookingAvailabilityService: schedulingModule.bookingAvailabilityService,
    });
  const clinicalModule = dependencies.clinicalModule ?? createClinicalModule({ clinic: schedulingModule.clinic });
  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ ...authModule, nodeEnv }));
  app.use('/api/doctor', createDoctorAvailabilityRouter({ authModule, schedulingModule }));
  app.use('/api/doctor', createDoctorClinicalRouter({ authModule, clinicalModule }));
  app.use(
    '/api/patient',
    createPatientRouter({ authModule, patientAppointmentModule }),
  );
  app.use('/api/patient', createPatientClinicalRouter({ authModule, clinicalModule }));
  app.use(
    '/api/staff/appointments',
    createStaffAppointmentRouter({ authModule, patientAppointmentModule }),
  );
  if (enableAuthorizationProbes) {
    app.use('/api/authz-test', createAuthorizationProbeRouter(authModule));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
