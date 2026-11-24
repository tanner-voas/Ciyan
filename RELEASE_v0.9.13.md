# Ciyan v0.9.13 — Credential security

- Optional long passphrase with version 2 AES-GCM/PBKDF2-SHA256 (600,000 iterations); legacy version 1 four-digit PIN envelopes remain readable. Existing credentials are not automatically re-encrypted. Change protection in Speech settings. Previous exports and Drive revisions keep their original protection.
- Standalone CSP restricts scripts and connections, allows required inline styles, font blobs, Azure speech and jsDelivr font downloads. Removed inline startup retry handler.
- Shared Google Drive v0.1.7 distinguishes browser sign-out and account revocation.
- Profile snapshots are not generally encrypted; only the Azure key envelope is.
- The original Panlong text and adaptations require an independent rights/provenance review before public distribution. Attribution alone does not establish permission. If authorization cannot be established, use private/bring-your-own-text distribution instead. No content has been removed by this update.
