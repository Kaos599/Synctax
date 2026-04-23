## 2025-03-05 - Predictable Temporary Filenames
**Vulnerability:** Use of `Math.random()` to generate temporary filenames during atomic file writing.
**Learning:** `Math.random()` is not a CSPRNG, making temporary filenames predictable. This exposes the application to temporary file collision attacks or symlink attacks in environments where multiple processes might execute concurrently.
**Prevention:** Always use Node's native `crypto.randomBytes(size).toString('hex')` or `crypto.randomUUID()` when generating unique and unpredictable file names, especially for files intended to safely hold sensitive data.
