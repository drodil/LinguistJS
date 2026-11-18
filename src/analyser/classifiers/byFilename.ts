import Path from 'node:path';
import { LanguagesScema } from '../../types/schema.js';
import * as T from '../../types/types.js';

const filenameIndexes = new WeakMap<LanguagesScema, Map<string, string[]>>();

/** Map each lowercased filename to the languages using it, in language order. */
function getFilenameIndex(langData: LanguagesScema): Map<string, string[]> {
	let index = filenameIndexes.get(langData);
	if (index) return index;
	index = new Map();
	for (const [lang, data] of Object.entries(langData)) {
		for (const name of new Set(data.filenames?.map((filename) => filename.toLowerCase()))) {
			const langs = index.get(name);
			if (langs) langs.push(lang);
			else index.set(name, [lang]);
		}
	}
	filenameIndexes.set(langData, index);
	return index;
}

export default function byFilename(file: T.VirtualFile, langData: LanguagesScema): string[] {
	const filename = Path.basename(file.path).toLowerCase();
	// Check if filename is a match
	return [...(getFilenameIndex(langData).get(filename) ?? [])];
}
