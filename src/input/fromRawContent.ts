import { getFileExtension } from '../program/fs/normalisedPath.js';
import firstLine from '../program/utils/firstLine.js';
import * as T from '../types/types.js';

export default function fromRawContent(contents: Record<string, string>, vendorPaths: string[] = []): T.VirtualFile[] {
	const vendorRegexes = vendorPaths.map((pathPtn) => RegExp(pathPtn, 'i'));
	return Object.entries(contents).map(([path, content]) => {
		const extension = getFileExtension(path);
		const metadata: T.VirtualFile['metadata'] = {};
		if (vendorRegexes.some((regex) => regex.test(path))) {
			metadata.vendored = true;
		}
		return {
			path,
			content,
			firstLine: firstLine(content),
			size: Buffer.byteLength(content, 'utf-8'),
			extension,
			isBinary: false,
			metadata: Object.keys(metadata).length ? metadata : undefined,
		};
	});
}
