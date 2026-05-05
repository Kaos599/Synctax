## 2024-05-05 - Sequential IO bottleneck in Archive Generation
**Learning:** File bundling in backup generation (`writeBackupBundle` and `writePerClientBackups`) was a significant bottleneck because file reading was done synchronously in a sequential `for...of` loop (`await fs.readFile`).
**Action:** Always map sequential IO tasks (like file system read or fetch calls) to `Promise.all` while utilizing intermediate structures (or discriminated unions like `success: true as const`) when collecting results with error handling, reducing execution time linearly by N tasks.
