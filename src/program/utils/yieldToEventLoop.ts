/**
 * Create a function that yields to the event loop once the given time budget has passed since the last yield.
 * Call and await it regularly inside long synchronous loops to avoid blocking other work in the process.
 */
export default function createYielder(budgetMs = 10): () => Promise<void> {
	let last = performance.now();
	return async () => {
		if (performance.now() - last < budgetMs) return;
		await new Promise<void>((resolve) => setImmediate(resolve));
		last = performance.now();
	};
}
