/** Get the first line of a string without splitting the whole content. */
export default function firstLine(content: string): string {
	const newline = content.indexOf('\n');
	if (newline === -1) return content;
	return content.slice(0, content[newline - 1] === '\r' ? newline - 1 : newline);
}
