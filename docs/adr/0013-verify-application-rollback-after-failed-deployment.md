# Verify application rollback after failed deployment

A failed deployment should attempt to restore the last verified application image when one is available, then verify the restored service's health. The attempted release remains failed and held even if rollback succeeds. Database restoration remains operator-controlled; migration compatibility with the previous application version is the prerequisite for application-image rollback.
