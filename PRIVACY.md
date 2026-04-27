# Privacy and Patient Data Policy

This project is intended for hospitals and may process patient health information. Production deployments should follow applicable healthcare and privacy requirements such as India DPDP readiness, HIPAA-like controls where contractually required, and GDPR where EU data exists.

## Data minimization

- Collect only fields required for care, billing, reporting, or compliance.
- Avoid storing sensitive documents unless necessary.
- Use tenant-scoped exports and never cross-tenant exports.

## Patient data access

- Access should be role-based and tenant-scoped.
- Patient views and edits should be audited.
- Platform support access should be exceptional and logged.

## Retention and deletion

Each hospital should define retention requirements for:

- patient records
- investigation reports
- audit logs
- billing records
- pharmacy records
- uploaded documents

Audit logs should generally be retained and protected from normal deletion.
