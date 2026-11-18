import { LanguagesScema } from '../../types/schema.js';
import * as T from '../../types/types.js';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const categoryPriority: Record<string, number> = {
	programming: 0,
	markup: 1,
	prose: 2,
	data: 3,
};

const interpreterMatchers = new WeakMap<LanguagesScema, Array<{ lang: string; regexes: RegExp[] }>>();

function getInterpreterMatchers(langData: LanguagesScema) {
	let matchers = interpreterMatchers.get(langData);
	if (matchers) return matchers;
	matchers = Object.entries(langData).map(([lang, data]) => ({
		lang,
		regexes: (data.interpreters ?? []).map((interpreter) => new RegExp(`\\b${escapeRegExp(interpreter)}\\b`)),
	}));
	interpreterMatchers.set(langData, matchers);
	return matchers;
}

export default function byShebang(file: T.VirtualFile, langData: LanguagesScema, opts: T.Options): string[] {
	if (!opts.checkShebang || opts.quick) return [];
	const firstLine = file.firstLine;
	if (!firstLine || !firstLine.startsWith('#!')) return [];

	const matches = getInterpreterMatchers(langData).flatMap(({ lang, regexes }) => {
		// Check for interpreter match
		const matchesInterpretor = regexes.some((regex) => regex.test(firstLine));
		return matchesInterpretor ? [lang] : [];
	});

	return [...new Set(matches)].sort((a, b) => {
		const aType = langData[a]?.type;
		const bType = langData[b]?.type;
		const aPriority = categoryPriority[aType ?? ''] ?? 4;
		const bPriority = categoryPriority[bType ?? ''] ?? 4;
		return aPriority - bPriority;
	});
}
