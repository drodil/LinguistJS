import { getFileExtension } from '../../program/fs/normalisedPath.js';
import firstLine from '../../program/utils/firstLine.js';
import * as T from '../../types/types.js';

export function normaliseFiles(files: T.VirtualFile[]): T.VirtualFile[] {
	return files.map((file) => ({
		...file,
		extension: file.extension ?? getFileExtension(file.path),
		firstLine: file.firstLine ?? (file.content === undefined ? undefined : firstLine(file.content)),
		size: file.size ?? file.content?.length,
	}));
}
