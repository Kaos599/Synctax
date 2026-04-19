const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const start1 = performance.now();
for (let i = 0; i < 100000; i++) {
  arr.filter(x => x > 5).length;
}
const end1 = performance.now();

const start2 = performance.now();
for (let i = 0; i < 100000; i++) {
  arr.reduce((count, x) => x > 5 ? count + 1 : count, 0);
}
const end2 = performance.now();

console.log(`Filter: ${end1 - start1}ms`);
console.log(`Reduce: ${end2 - start2}ms`);
