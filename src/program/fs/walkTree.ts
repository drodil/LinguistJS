import { Ignore } from 'ignore';
import FS from 'node:fs';
import parseGitignore from '../parsing/parseGitignore.js';
import createYielder from '../utils/yieldToEventLoop.js';
import { normAbsPath, normPath } from './normalisedPath.js';

interface WalkInput {
	/** The common root absolute path of all folders being checked */
	commonRoot: string;
	/** The absolute path that each folder is relative to */
	folderRoots: string[];
	/** The absolute path of folders being checked */
	folders: string[];
	/** An instantiated Ignore object listing ignored files */
	ignored: Ignore;
}

interface WalkOutput {
	files: string[];
	folders: string[];
}

interface WalkState {
	allFiles: Set<string>;
	allFolders: Set<string>;
	yieldToEventLoop: () => Promise<void>;
}

/** Generate list of files in a directory. */
export default async function walkTree(data: WalkInput): Promise<WalkOutput> {
	const state: WalkState = { allFiles: new Set(), allFolders: new Set(), yieldToEventLoop: createYielder() };
	await walkFolders(data, state);
	// Return absolute files and folders lists
	return {
		files: [...state.allFiles].map((file) => file.replace(/^\./, data.commonRoot)),
		folders: [...state.allFolders],
	};
}

async function walkFolders(data: WalkInput, state: WalkState): Promise<void> {
	const { commonRoot, folderRoots, folders, ignored } = data;
	const { allFiles, allFolders, yieldToEventLoop } = state;

	// Walk tree of a folder
	if (folders.length === 1) {
		const folder = folders[0];
		const localRoot = folderRoots[0].replace(commonRoot, '').replace(/^\//, '');

		// Get list of files and folders inside this folder
		const files = FS.readdirSync(folder, { withFileTypes: true }).map((entry) => {
			// Create path relative to root
			const base = normAbsPath(folder, entry.name).replace(commonRoot, '.');
			// Add trailing slash to mark directories
			return entry.isDirectory() ? `${base}/` : base;
		});

		// Read and apply gitignores
		const gitignoreFilename = normPath(folder, '.gitignore');
		if (FS.existsSync(gitignoreFilename)) {
			const gitignoreContents = FS.readFileSync(gitignoreFilename, 'utf-8');
			const ignoredPaths = parseGitignore(gitignoreContents);
			const rootRelIgnoredPaths = ignoredPaths.map((ignorePath) =>
				// get absolute path of the ignore glob
				// use '/**/' to ensure matches in subfolders are also ignored
				normPath(folder, '**', ignorePath)
					// convert abs ignore glob to be relative to the root folder
					.replace(commonRoot + '/', '')
			);
			ignored.add(rootRelIgnoredPaths);
		}

		// Add gitattributes if present
		const gitattributesPath = normPath(folder, '.gitattributes');
		if (FS.existsSync(gitattributesPath)) {
			allFiles.add(gitattributesPath);
		}

		// Loop through files and folders
		for (const file of files) {
			await yieldToEventLoop();
			// Create absolute path for disc operations
			const path = normAbsPath(commonRoot, file);
			const localPath = localRoot ? file.replace(`./${localRoot}/`, '') : file.replace('./', '');

			// Skip if nonexistant
			const nonExistant = !FS.existsSync(path);
			if (nonExistant) continue;
			// Skip if marked in gitignore
			const isIgnored = ignored.test(localPath).ignored;
			if (isIgnored) continue;

			// Add absolute folder path to list
			allFolders.add(normAbsPath(folder));
			// Check if this is a folder or file
			if (file.endsWith('/')) {
				// Recurse into subfolders
				allFolders.add(path);
				await walkFolders({ commonRoot, folderRoots, folders: [path], ignored }, state);
			} else {
				// Add file path to list
				allFiles.add(path);
			}
		}
	}
	// Recurse into all folders
	else {
		for (const i in folders) {
			await walkFolders({ commonRoot, folderRoots: [folderRoots[i]], folders: [folders[i]], ignored }, state);
		}
	}
}
