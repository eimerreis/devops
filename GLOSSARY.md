# Application Delivery

The shared delivery expectations for application repositories deploying to the Mac mini.

## Language

**Delivery baseline**:
The mandatory delivery contract shared by participating repositories, covering required pipeline stages and release rules while leaving application-specific commands under each application's ownership.
_Avoid_: DevOps baseline, pipeline template

**Participating repository**:
An application repository whose changes and production deployments are subject to the delivery baseline. The initial scope is repositories deploying applications to the Mac mini.
_Avoid_: Managed repository

**Delivery guardrail**:
A mandatory condition of the delivery baseline that must be satisfied for the merge or production deployment it governs to proceed.
_Avoid_: Recommendation, warning

**Release unit**:
A product or component whose changes are versioned and released together. A repository has one release unit by default and may explicitly declare additional independently released units.

**Baseline release**:
A published revision of the delivery baseline that a participating repository explicitly adopts.

**Baseline adoption**:
The explicit transition of a repository into participation in the delivery baseline after its compatibility has been verified.

**Changeset**:
A declaration of release intent identifying affected release units, their intended semantic version bumps, and their user-facing release notes.

**Application release**:
A published semantic version and release notes for a release unit, created after its production deployment succeeds.

**Prepared version**:
A semantic version bound to a recorded source revision for an upcoming application release whose production deployment or publication has not yet completed.

**Verified deployment**:
A production deployment whose application-owned automated health check confirms that the expected version is serving correctly.

**Release hold**:
A condition preventing later releases in a repository while a failed prepared version awaits successful recovery or explicit operator supersession.

**Application rollback**:
Restoring the last verified application image and verifying the restored service's health. Database restoration is a separate operator-controlled recovery action.

**Operator**:
The repository owner authorized to perform manual recovery, supersession, and runner-mode changes.
