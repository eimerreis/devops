# Adopt shared workflow updates explicitly

Shared workflow behavior should change only through explicit, reviewed adoption in each application. Dependabot will open upgrade pull requests against tagged baseline releases, preserving exact SHA pins, with owner review and no auto-merge in v1. This trades immediate propagation for reviewable, reproducible changes; current-major maintenance and upgrade pull requests replace a live minimum-version or expiry gate.
