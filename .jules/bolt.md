## 2024-05-15 - Fast commandExistsOnPath check
**Learning:** Sequential path checking when resolving executables can add significant time due to sequential file IO `fs.access` queries.
**Action:** Use a fast implementation based on `Promise.all` combined with an outer check across multiple file path queries simultaneously to quickly resolve executables instead of a sequential file loop, as multiple I/O path lookups can be expensive.
