# Cíyán v0.9.3 — restore the graded edition selector

* v0.9.2 reused the same ZIP URLs while changing chapter digests. A stale HTTP/cache response could fail the integrity check and leave the reader on its previous saved chapter. The selector previously required the current digest, so it disappeared in that state.
* Pass 46 archives now use distinct filenames, and chapter download requests bypass the browser's HTTP cache. The current archive bytes, digests, graded modules, source text, terminology and vocabulary counts are unchanged.
* Recognized prior hosted chapters retain the edition selector and show an explicit Update chapter action. Selecting the graded edition retries the migration before projecting the new text. Failed downloads keep the saved original readable when available; the saved graded preference is retained. Errors are surfaced instead of silently dropping the option.
* The upgrade does not clear study progress, bookmarks, user imports or caches. Both standalone and AppLauncher deployments receive the same assets. No launcher changes are required.
* Regression coverage uses exact v0.9.1 chapter bytes, a failed download, and a subsequent successful edition switch, verifying persisted preferences, reading position and term progress.
