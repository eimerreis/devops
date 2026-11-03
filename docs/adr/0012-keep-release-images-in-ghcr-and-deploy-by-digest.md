# Keep release images in GHCR and deploy by digest

Local disk cleanup must not destroy the only copies of images needed for rollback or retry. Release builds will push version-tagged private images to GHCR and use immutable digest references for deployment and retry, updating `latest` only after successful verification. This provides durable artifact identity and recovery independent of the Mac mini's local image cache.
