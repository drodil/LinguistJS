import { getFileExtension } from '../../program/fs/normalisedPath.js';
import { LanguagesScema } from '../../types/schema.js';
import * as T from '../../types/types.js';

interface ExtensionEntry {
	ext: string;
	lang: string;
	/** Position in the language data, used to keep results in language order */
	order: number;
}

interface ExtensionIndex {
	/** Entries keyed by their lowercased extension, which always starts with a dot */
	byExtension: Map<string, ExtensionEntry[]>;
	/** Entries that cannot be looked up by a dot-prefixed suffix */
	other: ExtensionEntry[];
}

const extensionIndexes = new WeakMap<LanguagesScema, ExtensionIndex>();

function isComplexExt(ext: string): boolean {
	return /\..+\./.test(ext);
}

function getExtensionIndex(langData: LanguagesScema): ExtensionIndex {
	let index = extensionIndexes.get(langData);
	if (index) return index;
	index = { byExtension: new Map(), other: [] };
	let order = 0;
	for (const [lang, data] of Object.entries(langData)) {
		for (const ext of data.extensions ?? []) {
			const entry = { ext, lang, order: order++ };
			const key = ext.toLowerCase();
			if (!key.startsWith('.')) {
				index.other.push(entry);
				continue;
			}
			const entries = index.byExtension.get(key);
			if (entries) entries.push(entry);
			else index.byExtension.set(key, [entry]);
		}
	}
	extensionIndexes.set(langData, index);
	return index;
}

export default function byExtension(file: T.VirtualFile, langData: LanguagesScema): string[] {
	// Check if extension is a match
	const extension = file.extension ?? getFileExtension(file.path);
	if (!extension) return [];

	const { byExtension: byExt, other } = getExtensionIndex(langData);
	const lowerPath = file.path.toLowerCase();
	const possible: ExtensionEntry[] = [];
	// Any extension matching the end of the path is a suffix starting at one of its dots
	for (let dot = lowerPath.indexOf('.'); dot !== -1; dot = lowerPath.indexOf('.', dot + 1)) {
		const entries = byExt.get(lowerPath.slice(dot));
		if (entries) possible.push(...entries);
	}
	for (const entry of other) {
		if (lowerPath.endsWith(entry.ext.toLowerCase())) possible.push(entry);
	}
	possible.sort((a, b) => a.order - b.order);

	// Apply more specific extension if available
	const hasComplexExt = possible.some((entry) => isComplexExt(entry.ext));
	return possible
		.filter((entry) => {
			const complex = isComplexExt(entry.ext);
			if (hasComplexExt && !complex) return false;
			if (!hasComplexExt && complex) return false;
			return true;
		})
		.map((entry) => entry.lang);
}
