# Hold releases after a prepared-version failure

To prevent unresolved deployment and publication state while later changes alter release bookkeeping, subsequent releases will be held until the prepared version succeeds or an operator explicitly supersedes it. Supersession leaves the failed version unpublished, preserves its history, carries its unreleased notes into the replacement, and permits version-number gaps. Native concurrency serialization alone does not provide this hold, so the shared workflows need an explicit cross-run guard and a defined operator recovery procedure.
