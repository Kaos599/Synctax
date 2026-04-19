const results = Array.from({length: 1000}, (_, i) => ({ok: i % 2 === 0}));

const start1 = performance.now();
for (let i = 0; i < 10000; i++) {
  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
}
const end1 = performance.now();

const start2 = performance.now();
for (let i = 0; i < 10000; i++) {
  const { successCount, failCount } = results.reduce(
    (acc, r) => {
      r.ok ? acc.successCount++ : acc.failCount++;
      return acc;
    },
    { successCount: 0, failCount: 0 }
  );
}
const end2 = performance.now();

console.log(`Double Filter: ${end1 - start1}ms`);
console.log(`Reduce: ${end2 - start2}ms`);
