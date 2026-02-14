/**
 * Event types owned by the Documentation domain.
 */

import type { DocCreateRequest, DocType } from "./types";

export interface DocEventMap {
	/** Command: create a documentation file. */
	"doc.create": DocCreateRequest;

	/** Emitted when a documentation file was successfully created or updated. */
	"doc.created": {
		path: string;
		created: boolean;
		updated?: boolean;
		docType: DocType;
		name: string;
		source?: string;
	};

	/** Emitted when a doc.create was requested but the file already exists. */
	"doc.exists": {
		path: string;
		docType: DocType;
		name: string;
		source?: string;
	};

	/** Emitted when a doc creation failed. */
	"doc.failed": {
		docType: DocType;
		name: string;
		error: string;
		source?: string;
	};

	/** Command: delete a documentation file. */
	"doc.delete": {
		path: string;
		source?: string;
	};

	/** Emitted when a documentation file was deleted. */
	"doc.deleted": {
		path: string;
		source?: string;
	};
}
