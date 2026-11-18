import { LanguagesScema } from '../../types/schema.js';
import * as T from '../../types/types.js';

const modelineRegex = /-\*-|(?:syntax|filetype|ft)\s*=/;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const modelineMatchers = new WeakMap<LanguagesScema, Array<{ lang: string; regexes: RegExp[] }>>();

function getModelineMatchers(langData: LanguagesScema) {
	let matchers = modelineMatchers.get(langData);
	if (matchers) return matchers;
	const toRegex = (name: string) => new RegExp(`\\b${escapeRegExp(name.toLowerCase())}(?![\\w#+*]|-\\*-)`);
	matchers = Object.entries(langData).map(([lang, data]) => ({
		lang,
		regexes: [toRegex(lang), ...(data.aliases ?? []).map(toRegex)],
	}));
	modelineMatchers.set(langData, matchers);
	return matchers;
}

export default function byModeline(file: T.VirtualFile, langData: LanguagesScema, opts: T.Options): string[] {
	if (!opts.checkModeline || opts.quick) return [];
	const firstLine = file.firstLine;
	// Check modeline declaration
	if (!firstLine || !modelineRegex.test(firstLine)) return [];

	const modelineText = firstLine.toLowerCase().split(modelineRegex)[1] ?? '';
	// Add identified language(s)
	return getModelineMatchers(langData).flatMap(({ lang, regexes }) => {
		return regexes.some((regex) => regex.test(modelineText)) ? [lang] : [];
	});
}
