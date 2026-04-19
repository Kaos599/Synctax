const clientResults = Array.from({length: 1000}, (_, i) => ({
  status: ["success", "partial", "skipped", "failed"][i % 4]
}));

const start1 = performance.now();
for (let i = 0; i < 10000; i++) {
  const totals = {
    clients: clientResults.length,
    success: clientResults.filter((r) => r.status === "success").length,
    partial: clientResults.filter((r) => r.status === "partial").length,
    skipped: clientResults.filter((r) => r.status === "skipped").length,
    failed: clientResults.filter((r) => r.status === "failed").length,
  };
}
const end1 = performance.now();

const start2 = performance.now();
for (let i = 0; i < 10000; i++) {
  const totals = clientResults.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { clients: clientResults.length, success: 0, partial: 0, skipped: 0, failed: 0 }
  );
}
const end2 = performance.now();

console.log(`Multiple Filter: ${end1 - start1}ms`);
console.log(`Reduce: ${end2 - start2}ms`);
