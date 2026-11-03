# Keep migrations compatible with the previous application

Restoring an earlier application image is unsafe if a deployment has already made database changes that the earlier application cannot use. Applications must keep migrations compatible with the previous application version, staging destructive changes across releases. Compatibility validation remains application-owned, while the shared baseline requires the contract rather than attempting to infer schema compatibility generically.
