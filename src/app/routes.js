// Only routes approved in SITEMAP.md. Dynamic pages use contextual links.
export const routeGroups = {
  "public": [
    {
      "path": "/",
      "title": "Welcome to Arion Health Portal"
    },
    {
      "path": "/login",
      "title": "Login"
    },
    {
      "path": "/register",
      "title": "Register"
    },
    {
      "path": "/unauthorized",
      "title": "Unauthorized"
    }
  ],
  "patient": [
    {
      "path": "/patient/dashboard",
      "title": "Patient Dashboard"
    },
    {
      "path": "/patient/profile",
      "title": "My Profile"
    },
    {
      "path": "/patient/book",
      "title": "Book Appointment"
    },
    {
      "path": "/patient/appointments",
      "title": "My Appointments"
    },
    {
      "path": "/patient/appointments/:id",
      "title": "Appointment Details"
    },
    {
      "path": "/patient/records",
      "title": "My Records"
    },
    {
      "path": "/patient/records/:id",
      "title": "Medical Record Details"
    },
    {
      "path": "/patient/certificates",
      "title": "My Certificates"
    },
    {
      "path": "/patient/certificates/:id",
      "title": "Certificate Details"
    }
  ],
  "doctor": [
    {
      "path": "/doctor/dashboard",
      "title": "Doctor Dashboard"
    },
    {
      "path": "/doctor/schedule",
      "title": "My Schedule"
    },
    {
      "path": "/doctor/patients",
      "title": "Patients"
    },
    {
      "path": "/doctor/patients/:id",
      "title": "Patient Details"
    },
    {
      "path": "/doctor/patients/:id/add-record",
      "title": "Add Medical Record"
    },
    {
      "path": "/doctor/records/:id/certificate/new",
      "title": "Issue Medical Certificate"
    }
  ],
  "staff": [
    {
      "path": "/staff/dashboard",
      "title": "Staff Dashboard"
    },
    {
      "path": "/staff/analytics",
      "title": "Analytics"
    },
    {
      "path": "/staff/calendar",
      "title": "Full Calendar"
    },
    {
      "path": "/staff/queue",
      "title": "Appointment Queue"
    },
    {
      "path": "/staff/patients",
      "title": "Patients"
    },
    {
      "path": "/staff/patients/:id",
      "title": "Patient Details"
    },
    {
      "path": "/staff/doctors",
      "title": "Doctors"
    },
    {
      "path": "/staff/doctors/:id/schedule",
      "title": "Manage Schedule"
    },
    {
      "path": "/staff/patients/new",
      "title": "Register Walk-in Patient"
    },
    {
      "path": "/staff/patients/:id/walk-in",
      "title": "Register Existing Patient Walk-in"
    }
  ],
  "admin": [
    {
      "path": "/admin/dashboard",
      "title": "Admin Dashboard"
    },
    {
      "path": "/admin/analytics",
      "title": "Analytics"
    },
    {
      "path": "/admin/patients",
      "title": "Manage Patients"
    },
    {
      "path": "/admin/doctors",
      "title": "Manage Doctors"
    },
    {
      "path": "/admin/staff",
      "title": "Manage Staff"
    }
  ]
};

export const roles = ['patient', 'doctor', 'staff', 'admin'];

