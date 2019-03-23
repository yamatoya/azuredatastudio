/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';

export class Task {
	readonly id: string;
	name: string;
	description: string;
	steps = new Array<Step>();

	constructor(name: string, description?: string, id?: string) {
		this.id = id || generateUuid();
		this.name = name;
		this.description = description || '';
	}
}

export class Step {
	readonly id: string;
	name: string;
	description: string;

	constructor(name: string, description?: string, id?: string) {
		this.id = id || generateUuid();
		this.name = name;
		this.description = description || '';
	}
}
