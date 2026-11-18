import Path from 'node:path';
import createYielder from '../../program/utils/yieldToEventLoop.js';
import * as T from '../../types/types.js';

const categoryKeys: T.Category[] = ['data', 'markup', 'programming', 'prose'];

function pickBestLanguage(classifications: string[]): string | null {
	// Assign first language as a default option
	return classifications[0] ?? null;
}

/** Count the total and non-blank lines without allocating an array of all lines. */
function countLines(content: string): { total: number; content: number } {
	let total = 0;
	let nonBlank = 0;
	let start = 0;
	while (true) {
		const newline = content.indexOf('\n', start);
		const end = newline === -1 ? content.length : newline;
		total++;
		if (/\S/.test(content.slice(start, end))) nonBlank++;
		if (newline === -1) break;
		start = newline + 1;
	}
	return { total, content: nonBlank };
}

function makeRelPath(path: string): string {
	let relPath = normPath(Path.relative(process.cwd(), path));
	if (!relPath.startsWith('../') && !relPath.startsWith('./')) {
		relPath = `./${relPath}`;
	}
	return relPath;
}

function normPath(filePath: string): string {
	return filePath.replace(/\\\\/g, '/');
}

export async function aggregateResults(
	files: T.VirtualFile[],
	classifications: Record<string, string[]>,
	heuristicResolutions: Record<string, string | undefined>,
	langData: { [language: string]: T.LanguageMetadata },
	opts: T.Options
): Promise<T.Results> {
	const results: T.Results = {
		files: { count: 0, bytes: 0, lines: { total: 0, content: 0 }, results: {} },
		languages: { count: 0, bytes: 0, lines: { total: 0, content: 0 }, results: {} },
		unknown: { count: 0, bytes: 0, lines: { total: 0, content: 0 }, extensions: {}, filenames: {} },
		repository: {},
	};

	// Skip specified categories
	const allowedCategories = opts.categories ?? categoryKeys;
	const hiddenCategories = categoryKeys.filter((category) => !allowedCategories.includes(category));

	const yieldToEventLoop = createYielder();
	for (const file of files) {
		await yieldToEventLoop();
		// Narrow down file associations to the best fit
		const candidates = classifications[file.path] ?? [];
		// If no heuristics, assign a language
		const bestLanguage = heuristicResolutions[file.path] ?? pickBestLanguage(candidates);
		const selectedLanguage = bestLanguage
			? opts.childLanguages
				? bestLanguage // use the child language
				: (langData[bestLanguage]?.group ?? bestLanguage) // use the parent language, if it exists
			: null;
		// Load language bytes size
		const size = file.size ?? file.content?.length ?? 0;
		// Calculate lines of code
		const loc = opts.calculateLines === false ? { total: NaN, content: NaN } : countLines(file.content ?? '');
		const outputPath = opts.relativePaths && Path.isAbsolute(file.path) ? makeRelPath(file.path) : file.path;

		if (!selectedLanguage) {
			const extension = file.extension || Path.extname(file.path);
			const unknownType = extension ? 'extensions' : 'filenames';
			const name = extension || Path.basename(file.path);
			results.files.results[outputPath] = null;
			results.files.bytes += size;
			results.files.lines.total += Number.isNaN(loc.total) ? 0 : loc.total;
			results.files.lines.content += Number.isNaN(loc.content) ? 0 : loc.content;
			results.unknown[unknownType][name] ??= 0;
			results.unknown[unknownType][name] += size;
			results.unknown.bytes += size;
			results.unknown.lines.total += loc.total || 0;
			results.unknown.lines.content += loc.content || 0;
			continue;
		}

		const languageMeta = langData[selectedLanguage];
		const category = languageMeta?.type;
		const allowed = !hiddenCategories.includes(category ?? 'programming') || file.attributes?.detectable === true;
		if (!allowed) {
			continue;
		}

		if (!results.repository[selectedLanguage]) {
			results.repository[selectedLanguage] = {
				type: languageMeta?.type ?? 'programming',
				color: languageMeta?.color,
			};
			if (opts.childLanguages) {
				results.repository[selectedLanguage].parent = languageMeta?.group;
			}
		}

		results.files.results[outputPath] = selectedLanguage;

		// Apply to files totals
		results.files.bytes += size;
		results.files.lines.total += Number.isNaN(loc.total) ? 0 : loc.total;
		results.files.lines.content += Number.isNaN(loc.content) ? 0 : loc.content;
		results.languages.results[selectedLanguage] ??= { count: 0, bytes: 0, lines: { total: 0, content: 0 } };
		results.languages.results[selectedLanguage].count += 1;
		results.languages.results[selectedLanguage].bytes += size;
		results.languages.results[selectedLanguage].lines.total += Number.isNaN(loc.total) ? 0 : loc.total;
		results.languages.results[selectedLanguage].lines.content += Number.isNaN(loc.content) ? 0 : loc.content;
		results.languages.bytes += size;
		results.languages.lines.total += Number.isNaN(loc.total) ? 0 : loc.total;
		results.languages.lines.content += Number.isNaN(loc.content) ? 0 : loc.content;
	}

	if (opts.calculateLines === false) {
		results.files.lines = { total: NaN, content: NaN };
	}

	results.files.count = Object.keys(results.files.results).length;
	results.languages.count = Object.keys(results.languages.results).length;
	results.unknown.count = Object.keys({ ...results.unknown.extensions, ...results.unknown.filenames }).length;

	return results;
}
