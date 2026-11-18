const cache = new Map<string, RegExp>();

/** Convert a PCRE regex into JS. Results are cached, so the returned regex must not be used with stateful (`g`/`y`) flags. */
export default function pcre(regex: string): RegExp {
	let converted = cache.get(regex);
	if (!converted) {
		converted = convertPcre(regex);
		cache.set(regex, converted);
	}
	return converted;
}

function convertPcre(regex: string): RegExp {
	let finalRegex = regex;
	const replace = (search: string | RegExp, replace: string) => finalRegex = finalRegex.replace(search, replace);
	const finalFlags = new Set<string>();
	// Convert inline flag declarations
	const inlineMatches = regex.matchAll(/\?(-)?([a-z]):/g);
	const startMatches = regex.matchAll(/\(\?(-)?([a-z]+)\)/g);
	for (const [match, isNegative, flags] of [...inlineMatches, ...startMatches]) {
		replace(match, '');
		const func = (flag: string) => isNegative ? finalFlags.delete(flag) : finalFlags.add(flag);
		[...flags].forEach(func);
	}
	// Remove PCRE-only syntax
	replace(/([*+]){2}/g, '$1');
	replace(/\(\?>/g, '(?:');
	replace(/\\g\<[^>]+\>/g, '.*?'); // referenced named groups not supported
	// Remove start/end-of-file markers
	if (/\\[AZ]/.test(finalRegex)) {
		replace(/\\A/g, '^');
		replace(/\\Z/g, '$');
		finalFlags.delete('m');
	}
	else {
		finalFlags.add('m');
	}
	// Reformat free-spacing mode
	if (finalFlags.has('x')) {
		finalFlags.delete('x');
		replace(/#.+/g, '');
		replace(/^\s+|\s+$|\n/gm, '');
		replace(/\s+/g, ' ');
	}
	// Return final regex
	return RegExp(finalRegex, [...finalFlags].join(''));
}
