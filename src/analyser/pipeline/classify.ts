import { LanguagesScema } from '../../types/schema.js';
import createYielder from '../../program/utils/yieldToEventLoop.js';
import * as T from '../../types/types.js';
import byAttributes from '../classifiers/byAttributes.js';
import byExtension from '../classifiers/byExtension.js';
import byFilename from '../classifiers/byFilename.js';
import byModeline from '../classifiers/byModeline.js';
import byShebang from '../classifiers/byShebang.js';

function dedupeClassifications(classifications: string[]): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const classification of classifications) {
		if (!seen.has(classification)) {
			seen.add(classification);
			ordered.push(classification);
		}
	}
	return ordered;
}

export async function classifyFiles(files: T.VirtualFile[], langData: LanguagesScema, opts: T.Options): Promise<Record<string, string[]>> {
	const classifications: Record<string, string[]> = {};
	const yieldToEventLoop = createYielder();
	for (const file of files) {
		await yieldToEventLoop();
		// Search each language
		// Note: order here is important; the first match will be the one chosen
		const candidates: string[] = [
			...byAttributes(file, langData),
			...byModeline(file, langData, opts),
			...byFilename(file, langData),
			...byShebang(file, langData, opts),
			...byExtension(file, langData),
		];
		classifications[file.path] = dedupeClassifications(candidates);
	}
	return classifications;
}
