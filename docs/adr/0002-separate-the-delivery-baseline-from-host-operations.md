# Separate the delivery baseline from host operations

Host maintenance and shared application delivery have different compatibility requirements and release lifecycles. The delivery baseline will live in a separate repository, while `mac-mini` retains ownership of host operations. This adds a repository to maintain but lets baseline consumers upgrade independently of changes to the Mac mini's setup.
