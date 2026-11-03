# Scope of the application delivery baseline

Applications sharing the Mac mini currently maintain their own delivery conventions. We will establish a delivery baseline for their repositories with mandatory merge and production-deployment gates and common required pipeline stages; applications retain ownership of their language, framework, and test/build commands. The initial scope is application repositories deploying to the Mac mini, allowing the contract to be proven in the existing environment before extending it to other repositories or deployment targets.

## Platform boundary

The shared production-release flow covers container-based delivery. Apple/App Store distribution remains in application-owned post-release workflows consuming the verified version and source commit; applicable platform validation remains part of the shared gates.
