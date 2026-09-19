# Security Design — U1

No new security mechanism to design. The CLI performs a plain HTTP request
to the existing local API; no new auth, no new secrets, no new trust
boundary. Input validation for `--engine` (BR1.2) is the only boundary
check this unit owns, and it's a closed enum check, not a security-critical
validation.
